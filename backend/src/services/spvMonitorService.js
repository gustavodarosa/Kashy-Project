// backend/src/services/spvMonitorService.js

const ElectrumClient = require('electrum-client');
const cashaddr = require('cashaddrjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/user');
const Transaction = require('../models/transaction'); // Ensure this path is correct
const { FULCRUM_SERVERS } = require('../config/fullcrumConfig');
// Assuming you have bch-js installed and configured
const BCHJS = require('@psf/bch-js');
const bchjs = new BCHJS(); // Or configure with API key if needed

// --- Configuration ---
const RECONNECT_DELAY_MS = 10000;
const ELECTRUM_PROTOCOL_VERSION = '1.4';

// ======= UTILITIES ======= //
function addressToScriptPubKey(address) {
    try {
      const decoded = cashaddr.decode(address);
      const type = decoded.type; // 'P2PKH' or 'P2SH'
      const hash = decoded.hash;

      if (type === 'P2PKH') {
        return `76a914${Buffer.from(hash).toString('hex')}88ac`; // P2PKH script
      } else if (type === 'P2SH') {
        return `a914${Buffer.from(hash).toString('hex')}87`; // P2SH script
      } else {
        throw new Error(`Unsupported address type: ${type}`);
      }
    } catch (error) {
      console.error(`SPV: Error converting address ${address} to scriptPubKey: ${error.message}`);
      throw error;
    }
  }

function scriptPubKeyToScriptHash(scriptHex) {
    if (!scriptHex || typeof scriptHex !== 'string' || scriptHex.length === 0) {
        throw new Error(`Invalid scriptHex input for scriptPubKeyToScriptHash: ${scriptHex}`);
    }
    try {
        const scriptBuffer = Buffer.from(scriptHex, 'hex');
        if (scriptBuffer.length === 0 && scriptHex.length > 0) {
             throw new Error('Invalid hex string provided for scriptPubKey');
        }
        const hash = crypto.createHash('sha256').update(scriptBuffer).digest();
        return Buffer.from(hash.reverse()).toString('hex');
    } catch (error) {
        console.error(`SPV: Error converting scriptPubKey ${scriptHex} to scriptHash: ${error.message}`);
        throw error;
    }
}


function scriptPubKeyHexToAddress(scriptHex) {
    try {
        if (!scriptHex) return null;
        const scriptBuffer = Buffer.from(scriptHex, 'hex');
        // Use bch-js to decode the script
        const chunks = bchjs.Script.decode(scriptBuffer); // Use the instantiated bchjs

        // Check for standard P2PKH: OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
        if (chunks.length === 5 &&
            chunks[0] === 118 && // OP_DUP
            chunks[1] === 169 && // OP_HASH160
            Buffer.isBuffer(chunks[2]) && chunks[2].length === 20 && // pubKeyHash (20 bytes)
            chunks[3] === 136 && // OP_EQUALVERIFY
            chunks[4] === 172) { // OP_CHECKSIG
            const hash160 = chunks[2];
            // Convert hash160 to CashAddress (assuming mainnet)
            return bchjs.Address.hash160ToCash(hash160); // Simpler call
        }

        // Check for standard P2SH: OP_HASH160 <scriptHash> OP_EQUAL
        if (chunks.length === 3 &&
            chunks[0] === 169 && // OP_HASH160
            Buffer.isBuffer(chunks[1]) && chunks[1].length === 20 && // scriptHash (20 bytes)
            chunks[2] === 135) { // OP_EQUAL
            const hash160 = chunks[1];
            // Convert hash160 to CashAddress (assuming mainnet)
            return bchjs.Address.scriptHashToCash(hash160); // Simpler call
        }

        console.warn(`SPV: Could not decode scriptPubKeyHex ${scriptHex} to a standard address type.`);
        return null; // Return null if it's not a recognized standard script

    } catch (error) {
        console.error(`SPV: Error in scriptPubKeyHexToAddress for hex ${scriptHex}:`, error);
        return null;
    }
}



class SpvMonitorService {
    constructor() {
        this.client = null;
        this.currentServer = null;
        this.subscriptions = new Map(); // Map<scriptHash, { userId, bchAddress, lastStatus }>
        this.reconnectTimeout = null;
        this.isConnecting = false;
        this.isRunning = false;
        this.io = null; // Property to hold the io instance
    }

    setIoServer(ioInstance) {
        this.io = ioInstance;
        console.log("SPV: Socket.IO server instance received.");
    }

    // --- Connection Management ---
    async connect() {
        if (this.client && this.client.status === 1) return;
        if (this.isConnecting) return;

        this.isConnecting = true;
        clearTimeout(this.reconnectTimeout);
        console.log('SPV: Attempting to connect to Fulcrum server...');
        let potentialClient = null;

        for (const server of FULCRUM_SERVERS) {
            const serverId = `${server.host}:${server.port} (${server.protocol})`;
            try {
                potentialClient = new ElectrumClient(server.port, server.host, server.protocol);
                console.log(`SPV: Trying ${serverId}...`);

                const connectPromise = potentialClient.connect('kashy-spv-monitor', ELECTRUM_PROTOCOL_VERSION);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 10000));
                await Promise.race([connectPromise, timeoutPromise]);

                await potentialClient.server_version('kashy-spv-monitor', ELECTRUM_PROTOCOL_VERSION);

                console.log(`SPV: ✅ Successfully connected to ${server.host}`);
                this.client = potentialClient;
                this.currentServer = server;
                this.isConnecting = false;

                this.client.onClose = () => {
                    console.error(`SPV: ❌ Disconnected from ${this.currentServer?.host}. Attempting reconnect...`);
                    this.client = null;
                    this.currentServer = null;
                    this.subscriptions.forEach(sub => sub.lastStatus = null);
                    if (this.isRunning) {
                        this.scheduleReconnect();
                    }
                };

                this.attachSubscriptionListener();
                await this.resubscribeAll();
                return;

            } catch (err) {
                console.warn(`SPV: ⚠️ Failed to connect or handshake with ${serverId}: ${err.message}. Trying next...`);
                if (potentialClient) await potentialClient.close();
            }
        }

        console.error('SPV: 😓 Could not connect to any Fulcrum server.');
        this.isConnecting = false;
        if (this.isRunning) {
            this.scheduleReconnect();
        }
     }

    scheduleReconnect() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        console.log(`SPV: Scheduling reconnect in ${RECONNECT_DELAY_MS / 1000} seconds...`);
        this.reconnectTimeout = setTimeout(() => {
            if (this.isRunning) {
               this.connect();
            }
        }, RECONNECT_DELAY_MS);
     }

    attachSubscriptionListener() {
        if (!this.client) return;
        this.client.subscribe.on('blockchain.scripthash.subscribe', (params) => {
            if (params && params.length === 2) {
                const [scriptHash, status] = params;
                this.handleSubscriptionUpdate(scriptHash, status);
            } else {
                console.warn("SPV: Received unexpected subscription update format:", params);
            }
        });
         console.log("SPV: Attached global subscription update listener.");
     }

    // --- Subscription Management ---
    async subscribe(userId, bchAddress) {
        if (!userId || !bchAddress) {
            console.warn("SPV: Attempted to subscribe with missing userId or bchAddress.");
            return;
        }
        console.log(`SPV: Starting subscribe process for User: ${userId}, Address: ${bchAddress}`);

        let scriptPubKey;
        let scriptHash;
        try {
            scriptPubKey = addressToScriptPubKey(bchAddress);
            if (!scriptPubKey || typeof scriptPubKey !== 'string' || scriptPubKey.length === 0) {
                throw new Error(`addressToScriptPubKey returned invalid value: ${scriptPubKey}`);
            }
            scriptHash = scriptPubKeyToScriptHash(scriptPubKey);
            if (!scriptHash || typeof scriptHash !== 'string' || scriptHash.length !== 64) {
                throw new Error(`scriptPubKeyToScriptHash returned invalid value: ${scriptHash}`);
            }
        } catch (error) {
            console.error(`SPV: ❌ CRITICAL ERROR calculating script hash for ${bchAddress} (User: ${userId}): ${error.message}`);
            console.error(error.stack);
            return;
        }

        if (!this.subscriptions.has(scriptHash)) {
            console.log(`SPV: Tracking subscription for ${bchAddress} (User: ${userId}, ScriptHash: ${scriptHash})`);
            this.subscriptions.set(scriptHash, { userId, bchAddress, lastStatus: null });
        } else {
             this.subscriptions.get(scriptHash).userId = userId; // Update userId just in case
             console.log(`SPV: Updated userId for existing scriptHash ${scriptHash}`);
        }

        if (this.client && this.client.status === 1) {
            await this.performSubscription(scriptHash);
        } else {
            console.log(`SPV: Client not connected. Subscription for ${bchAddress} will be activated upon connection.`);
        }
     }

    async performSubscription(scriptHash) {
        if (!this.client || this.client.status !== 1) {
             console.warn(`SPV: Cannot perform subscription for ${scriptHash}, client not connected.`);
             return;
        }
        if (!this.subscriptions.has(scriptHash)) {
            console.warn(`SPV: Attempted to perform subscription for untracked scriptHash: ${scriptHash}`);
            return;
        }
        const subInfo = this.subscriptions.get(scriptHash);
        console.log(`SPV: Subscribing to server for ${subInfo.bchAddress} (ScriptHash: ${scriptHash})`);
        try {
            const currentStatus = await this.client.request('blockchain.scripthash.subscribe', [scriptHash]);
            console.log(`SPV: Initial status for ${subInfo.bchAddress}: ${currentStatus}`);
            await this.handleSubscriptionUpdate(scriptHash, currentStatus);
        } catch (error) {
            console.error(`SPV: ❌ Error subscribing to ${scriptHash} (${subInfo.bchAddress}):`, error);
        }
     }

    async resubscribeAll() {
        if (!this.client || this.client.status !== 1) {
            console.warn("SPV: Cannot resubscribe, client not connected.");
            return;
        }
        console.log(`SPV: Resubscribing to ${this.subscriptions.size} tracked addresses...`);
        const scriptHashesToResubscribe = Array.from(this.subscriptions.keys());
        for (const scriptHash of scriptHashesToResubscribe) {
            await this.performSubscription(scriptHash);
        }
        console.log("SPV: Resubscribe process completed.");
     }

    // --- Update Handling ---
    async handleSubscriptionUpdate(scriptHash, status) {
        const subInfo = this.subscriptions.get(scriptHash);
        if (!subInfo) {
          console.warn(`SPV: Update received for untracked scriptHash: ${scriptHash}`);
          return;
        }

        if (status === subInfo.lastStatus) {
            // console.log(`SPV: Status unchanged for ${subInfo.bchAddress} (${scriptHash}). Skipping update.`);
            return;
        }
        console.log(`SPV: 🚨 Status change detected for ${subInfo.bchAddress} (User: ${subInfo.userId}). Old: ${subInfo.lastStatus}, New: ${status}`);
        subInfo.lastStatus = status; // Update status *before* processing

        // Process wallet info update (fetches details, saves to DB)
        await this.updateUserWalletInfo(subInfo.userId, subInfo.bchAddress, scriptHash);

        // Emit WebSocket event AFTER processing
        if (this.io) {
            console.log(`SPV: Emitting 'walletUpdate' to user room: ${subInfo.userId}`);
            this.io.to(subInfo.userId).emit('walletUpdate', {
                message: `Wallet update detected for ${subInfo.bchAddress}`
            });
        } else {
            console.warn("SPV: Socket.IO instance (this.io) not set. Cannot emit 'walletUpdate'.");
        }
      }

    // --- THIS IS THE CORE FUNCTION THAT WAS MODIFIED ---
    async updateUserWalletInfo(userId, bchAddress, scriptHash) {
        console.log(`SPV: Updating wallet info for User: ${userId}, Address: ${bchAddress}`);
        
        let user;

        try {
            user = await User.findById(userId);
            if (!user) {
                console.error(`SPV: User ${userId} not found during update for ${bchAddress}.`);
                return;
            }

            if (!this.client || this.client.status !== 1) {
                console.warn(`SPV: Client disconnected before fetching balance/history for ${bchAddress}. Will retry on reconnect.`);
                if (this.subscriptions.has(scriptHash)) {
                    this.subscriptions.get(scriptHash).lastStatus = null;
                }
                return;
            }

            // 1. Fetch Balance
            const balanceResult = await this.client.request('blockchain.scripthash.get_balance', [scriptHash]);
            const currentBalanceSatoshis = balanceResult.confirmed + balanceResult.unconfirmed;
            const oldBalanceSatoshis = user.balance || 0;

            // 2. Calculate Overall Change (logging only)
            const calculatedAmountSatoshis = currentBalanceSatoshis - oldBalanceSatoshis;

            // 3. Fetch History Hashes
            const history = await this.client.request('blockchain.scripthash.get_history', [scriptHash]);
            const processedTxIds = new Set(user.processedTxIds || []);
            let balanceChanged = false;
            let newTxProcessedCount = 0;

            // 4. Identify and Process New Transactions
            const newTransactionsInfo = history.filter(tx => !processedTxIds.has(tx.tx_hash));

            if (newTransactionsInfo.length > 0) {
                console.log(`SPV: Found ${newTransactionsInfo.length} new transaction(s) for ${bchAddress}:`, newTransactionsInfo.map(tx => tx.tx_hash));
                console.log(`SPV: Calculated overall balance change since last check: ${calculatedAmountSatoshis} sats.`);

                // --- Loop through each new transaction ---
                for (const txInfo of newTransactionsInfo) {
                    // --- Define txid and blockHeight INSIDE the loop ---
                    const { tx_hash: txid, height: blockHeight } = txInfo;
                    let txDetails = null;

                    try {
                        // --- FETCH FULL TRANSACTION DETAILS ---
                        console.log(`SPV: Fetching details for txid: ${txid}`);
                        txDetails = await this.client.request('blockchain.transaction.get', [txid, true]);
                        console.log(`SPV_DEBUG: Full transaction details for ${txid}:`, JSON.stringify(txDetails, null, 2));
                        console.log(`SPV: Fetched details for ${txid}`);

                        // --- Determine Type, From/To Addresses, Amount ---
                        let determinedFromAddress = null;
                        let determinedToAddress = null;
                        let transactionType = 'internal';
                        let amountRelevantToUser = 0;

                        // Calculate user's input/output values
                        let userTotalInput = 0;
                        txDetails.vin.forEach(vin => {
                            if (vin.prevout?.scriptPubKey?.addresses?.[0] === bchAddress) {
                                userTotalInput += vin.prevout.value * 1e8;
                            }
                        });
                        let userTotalOutput = 0;
                        txDetails.vout.forEach(vout => {
                            if (vout.scriptPubKey?.addresses?.[0] === bchAddress) {
                                userTotalOutput += vout.value * 1e8;
                            }
                        });
                        amountRelevantToUser = Math.round(userTotalOutput - userTotalInput);

                        // Determine type and addresses based on amount
                        if (amountRelevantToUser > 0) {
                            transactionType = 'incoming';
                            const input = txDetails.vin.find(vin => vin.prevout?.scriptPubKey?.addresses?.[0] !== bchAddress);

                            // First, try the easy way (using the addresses field)
                            if (input?.txid && input?.vout !== undefined) {
                                try {
                                    console.log(`SPV_DEBUG [${txid}]: Fetching input transaction details for txid: ${input.txid}`);
                                    const inputTxDetails = await this.client.request('blockchain.transaction.get', [input.txid, true]);
                                    const inputVout = inputTxDetails.vout[input.vout];
                                    determinedFromAddress = inputVout?.scriptPubKey?.addresses?.[0] || null;
                            
                                    if (!determinedFromAddress && inputVout?.scriptPubKey?.hex) {
                                        console.log(`SPV_DEBUG [${txid}]: Attempting to decode scriptPubKey hex from input transaction: ${inputVout.scriptPubKey.hex}`);
                                        determinedFromAddress = scriptPubKeyHexToAddress(inputVout.scriptPubKey.hex);
                                    }
                            
                                    if (!determinedFromAddress) {
                                        console.warn(`SPV_DEBUG [${txid}]: Could not determine address from input transaction details.`);
                                    }
                                } catch (error) {
                                    console.error(`SPV_DEBUG [${txid}]: Error fetching input transaction details for txid: ${input.txid}`, error);
                                }
                            } else {
                                console.warn(`SPV_DEBUG [${txid}]: No addresses or scriptPubKey hex available in input.`);
                                determinedFromAddress = null;
                            }

                            // --- ADD DEBUG LOG HERE ---
                            // Log details if the primary method failed
                            if (determinedFromAddress === null) {
                                console.log(`SPV_DEBUG [${txid}]: Could not find sender via addresses field. Input data:`, JSON.stringify(input, null, 2));
                                // Log all inputs for context if the specific one wasn't found or didn't have the address
                                console.log(`SPV_DEBUG [${txid}]: All VIN details:`, JSON.stringify(txDetails.vin, null, 2));

                                // --- Optional Fallback Logic (Uncomment if Step 1 debugging shows it's needed) ---
                                /*
                                if (input?.prevout?.scriptPubKey?.hex) {
                                    console.log(`SPV_DEBUG [${txid}]: Address field missing, attempting to decode scriptPubKey hex: ${input.prevout.scriptPubKey.hex}`);
                                    determinedFromAddress = scriptPubKeyHexToAddress(input.prevout.scriptPubKey.hex);
                                    // If decoding still fails, determinedFromAddress will become null again
                                    if(determinedFromAddress === null) {
                                         console.warn(`SPV_DEBUG [${txid}]: Failed to decode scriptPubKey hex to address.`);
                                    }
                                }
                                */
                            }
                            // --- END DEBUG LOG / FALLBACK ---

                            determinedToAddress = bchAddress;
                        } else if (amountRelevantToUser < 0) {
                            transactionType = 'outgoing';
                            determinedFromAddress = bchAddress;
                            const output = txDetails.vout.find(vout => vout.scriptPubKey?.addresses?.[0] !== bchAddress);
                            determinedToAddress = output?.scriptPubKey?.addresses?.[0] || 'Destino Desconhecido'; // Fallback for outgoing
                        } else {
                            transactionType = 'internal';
                            determinedFromAddress = bchAddress;
                            determinedToAddress = bchAddress;
                        }

                        console.log(`SPV: [${txid}] Type: ${transactionType}, Amount (User): ${amountRelevantToUser} sats, From: ${determinedFromAddress}, To: ${determinedToAddress}`);

                        // --- MOVE Transaction creation and saving INSIDE the loop ---
                        const newDbTransaction = new Transaction({
                            userId: user._id,
                            txid: txid, // Now txid is defined
                            type: transactionType,
                            amountSatoshis: Math.abs(amountRelevantToUser),
                            address: bchAddress,
                            blockHeight: blockHeight || 0,
                            timestamp: txDetails.time ? new Date(txDetails.time * 1000) : new Date(),
                            fromAddress: determinedFromAddress,
                            toAddress: determinedToAddress,
                        });

                        await newDbTransaction.save(); // Save the transaction for *this* txid
                        console.log(`SPV: Saved transaction record ${txid} (Type: ${transactionType}, Amount: ${Math.abs(amountRelevantToUser)} sats) to DB for user ${userId}`);
                        // --- END Moved Block ---

                        processedTxIds.add(txid); // Mark as processed *after* successful save
                        newTxProcessedCount++;

                    } catch (dbOrFetchError) {
                        if (dbOrFetchError.code === 11000) {
                            console.log(`SPV: Transaction ${txid} already exists in DB. Marking as processed.`);
                            processedTxIds.add(txid);
                        } else {
                            console.error(`SPV: ❌ Error processing or fetching details for tx ${txid} (User: ${userId}):`, dbOrFetchError);
                        }
                    }
                } // --- End loop through newTransactionsInfo ---
            } // End if (newTransactionsInfo.length > 0)

            // 5. Update User Balance
            if (currentBalanceSatoshis !== oldBalanceSatoshis) {
                console.log(`SPV: Balance update for ${bchAddress}. Old: ${oldBalanceSatoshis} sats, New: ${currentBalanceSatoshis} sats`);
                user.balance = currentBalanceSatoshis;
                balanceChanged = true;
            }

            // 6. Save User (if needed)
            const processedIdsChanged = user.processedTxIds.length !== processedTxIds.size || newTxProcessedCount > 0;
            if (balanceChanged || processedIdsChanged) {
                user.processedTxIds = Array.from(processedTxIds);
                // Ensure user document is valid (username exists!) before saving
                await user.save();
                console.log(`SPV: ✅ User ${userId} document updated successfully (Balance Changed: ${balanceChanged}, Processed Txs Changed: ${processedIdsChanged}).`);
            } else {
                 console.log(`SPV: No balance change or new processed txids requiring user save for ${bchAddress}.`);
            }

        } catch (error) {
            // This catch block handles errors from User.findById, Electrum calls, user.save(), etc.
            console.error(`SPV: ❌ Error in updateUserWalletInfo for User ${userId} (${bchAddress}):`, error);
             if (this.subscriptions.has(scriptHash)) {
                 this.subscriptions.get(scriptHash).lastStatus = null;
             }
        }
    } // End updateUserWalletInfo


    // --- Service Lifecycle ---
    async start() {
        if (this.isRunning) {
            console.warn("SPV: Service already started.");
            return;
        }
        console.log('SPV: Starting service...');
        this.isRunning = true;

        await this.connect(); // Attempt initial connection

        try {
            console.log('SPV: Fetching initial users with BCH addresses from DB...');
            const usersToMonitor = await User.find({
                bchAddress: { $exists: true, $ne: null, $ne: '' }
            });
            console.log(`SPV: Found ${usersToMonitor.length} users with addresses to potentially monitor.`);

            for (const user of usersToMonitor) {
                await this.subscribe(user._id.toString(), user.bchAddress);
            }
            console.log('SPV: Initial user addresses processed for monitoring.');

        } catch (error) {
            console.error('SPV: ❌ Error during initial user fetch or subscription:', error);
        }
     }

    async stop() {
        console.log("SPV: Stopping service...");
        this.isRunning = false;
        clearTimeout(this.reconnectTimeout);
        this.subscriptions.clear();

        if (this.client) {
            console.log("SPV: Closing Fulcrum client connection...");
            try {
                this.client.close(); // Note: electrum-client close might not be async
                console.log("SPV: Fulcrum client closed.");
            } catch (error) {
                console.error("SPV: Error closing Fulcrum client:", error);
            } finally {
                this.client = null;
                this.currentServer = null;
            }
        } else {
             console.log("SPV: No active client connection to close.");
        }
     }

    // --- Public Methods ---
    async addSubscription(userId, bchAddress) {
        if (!this.isRunning) {
            console.warn("SPV: Service not running. Cannot add dynamic subscription.");
            return;
        }
        console.log(`SPV: Dynamically adding subscription for User: ${userId}, Address: ${bchAddress}`);
        await this.subscribe(userId, bchAddress);
     }

} // End Class SpvMonitorService

// --- Export Singleton Instance ---
const spvMonitorServiceInstance = new SpvMonitorService();

module.exports = {
    start: () => spvMonitorServiceInstance.start(),
    stop: () => spvMonitorServiceInstance.stop(),
    addSubscription: (userId, bchAddress) => spvMonitorServiceInstance.addSubscription(userId, bchAddress),
    setIoServer: (ioInstance) => spvMonitorServiceInstance.setIoServer(ioInstance) // Expose the setter
};
