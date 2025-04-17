// backend/src/services/spvMonitorService.js

const ElectrumClient = require('electrum-client');
const cashaddr = require('cashaddrjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/user');
// Ensure this path is correct and the model requires amount/type
const Transaction = require('../models/transaction'); // Assuming filename is transaction.js based on context
const { FULCRUM_SERVERS } = require('../config/fullcrumConfig');
// const { io } = require('../server'); // <-- REMOVED THIS LINE (Circular Dependency)

// --- Configuration ---
const RECONNECT_DELAY_MS = 10000;
const ELECTRUM_PROTOCOL_VERSION = '1.4';

// ======= UTILITIES ======= //
function addressToScriptPubKey(address) {
    try {
      const decoded = cashaddr.decode(address);
      // const prefix = decoded.prefix; // Not strictly needed for conversion
      const type = decoded.type; // Should be 'P2PKH' or 'P2SH'
      const hash = decoded.hash;

      if (type === 'P2PKH') {
        return `76a914${Buffer.from(hash).toString('hex')}88ac`; // Standard P2PKH script
      } else if (type === 'P2SH') {
        return `a914${Buffer.from(hash).toString('hex')}87`; // Standard P2SH script
      } else {
        throw new Error(`Unsupported address type: ${type}`);
      }
    } catch (error) {
      console.error(`SPV: Error converting address ${address} to scriptPubKey: ${error.message}`);
      throw error; // Re-throw to be caught by caller
    }
  }

function scriptPubKeyToScriptHash(scriptHex) {
    // Ensure input is a non-empty string
    if (!scriptHex || typeof scriptHex !== 'string' || scriptHex.length === 0) {
        throw new Error(`Invalid scriptHex input for scriptPubKeyToScriptHash: ${scriptHex}`);
    }
    try {
        const scriptBuffer = Buffer.from(scriptHex, 'hex');
        // Check if conversion resulted in an empty buffer (invalid hex)
        if (scriptBuffer.length === 0 && scriptHex.length > 0) {
             throw new Error('Invalid hex string provided for scriptPubKey');
        }
        const hash = crypto.createHash('sha256').update(scriptBuffer).digest();
        return Buffer.from(hash.reverse()).toString('hex');
    } catch (error) {
        console.error(`SPV: Error converting scriptPubKey ${scriptHex} to scriptHash: ${error.message}`);
        throw error; // Re-throw
    }
}
// ======= End UTILITIES ======= //


class SpvMonitorService {
    constructor() {
        this.client = null;
        this.currentServer = null;
        this.subscriptions = new Map(); // Map<scriptHash, { userId, bchAddress, lastStatus }>
        this.reconnectTimeout = null;
        this.isConnecting = false;
        this.isRunning = false;
        this.io = null; // <-- Property to hold the io instance
    }

    // --- Method to set the io instance (Dependency Injection) ---
    setIoServer(ioInstance) {
        this.io = ioInstance;
        console.log("SPV: Socket.IO server instance received.");
    }

    // --- Connection Management ---
    async connect() {
        if (this.client && this.client.status === 1) return; // Already connected
        if (this.isConnecting) return; // Connection attempt in progress

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
                    // Reset status to force re-check on reconnect
                    this.subscriptions.forEach(sub => sub.lastStatus = null);
                    if (this.isRunning) {
                        this.scheduleReconnect();
                    }
                };

                this.attachSubscriptionListener();
                await this.resubscribeAll();
                return; // Exit loop on successful connection

            } catch (err) {
                console.warn(`SPV: ⚠️ Failed to connect or handshake with ${serverId}: ${err.message}. Trying next...`);
                if (potentialClient) await potentialClient.close(); // Close the failed client
            }
        }

        console.error('SPV: 😓 Could not connect to any Fulcrum server.');
        this.isConnecting = false;
        if (this.isRunning) {
            this.scheduleReconnect(); // Schedule retry if service should be running
        }
     }

    scheduleReconnect() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        console.log(`SPV: Scheduling reconnect in ${RECONNECT_DELAY_MS / 1000} seconds...`);
        this.reconnectTimeout = setTimeout(() => {
            if (this.isRunning) { // Only reconnect if service hasn't been stopped
               this.connect();
            }
        }, RECONNECT_DELAY_MS);
     }

    attachSubscriptionListener() {
        if (!this.client) return;
        // Ensure listener isn't attached multiple times (though electrum-client might handle this)
        // this.client.subscribe.removeAllListeners('blockchain.scripthash.subscribe'); // Optional cleanup
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
        console.log(`SPV: [Debug] Starting subscribe for User: ${userId}, Address: ${bchAddress}`); // Added Debug Log

        let scriptPubKey;
        let scriptHash;
        try {
            console.log(`SPV: [Debug] Calling addressToScriptPubKey for: ${bchAddress}`);
            scriptPubKey = addressToScriptPubKey(bchAddress);
            console.log(`SPV: [Debug] Result scriptPubKey: ${scriptPubKey}`);

            if (!scriptPubKey || typeof scriptPubKey !== 'string' || scriptPubKey.length === 0) {
                throw new Error(`addressToScriptPubKey returned invalid value: ${scriptPubKey}`);
            }

            console.log(`SPV: [Debug] Calling scriptPubKeyToScriptHash for: ${scriptPubKey}`);
            scriptHash = scriptPubKeyToScriptHash(scriptPubKey);
            console.log(`SPV: [Debug] Result scriptHash: ${scriptHash}`);

            if (!scriptHash || typeof scriptHash !== 'string' || scriptHash.length !== 64) { // Script hash should be 64 hex chars
                throw new Error(`scriptPubKeyToScriptHash returned invalid value: ${scriptHash}`);
            }

        } catch (error) {
            console.error(`SPV: ❌❌❌ CRITICAL ERROR calculating script hash for ${bchAddress} (User: ${userId}) ❌❌❌`);
            console.error(`SPV: Error Details: ${error.message}`);
            console.error(error.stack); // Log stack trace
            return; // Exit the function if calculation fails
        }

        // Final safety check
        if (!scriptHash) {
             console.error(`SPV: ❌❌❌ FATAL: scriptHash is still undefined after try-catch for ${bchAddress}. Aborting subscription.`);
             return;
        }

        // Add or update subscription info
        if (!this.subscriptions.has(scriptHash)) {
            console.log(`SPV: Tracking subscription for ${bchAddress} (User: ${userId}, ScriptHash: ${scriptHash})`);
            this.subscriptions.set(scriptHash, { userId, bchAddress, lastStatus: null });
        } else {
             // Update userId if already tracking (e.g., if DB had duplicates somehow)
             this.subscriptions.get(scriptHash).userId = userId;
             console.log(`SPV: Updated userId for existing scriptHash ${scriptHash}`);
        }

        // Perform subscription if connected
        if (this.client && this.client.status === 1) {
             console.log(`SPV: [Debug] Calling performSubscription with scriptHash: ${scriptHash}`);
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
            // Subscribe and get initial status
            const currentStatus = await this.client.request('blockchain.scripthash.subscribe', [scriptHash]);
            console.log(`SPV: Initial status for ${subInfo.bchAddress}: ${currentStatus}`);
            // Process initial status immediately
            await this.handleSubscriptionUpdate(scriptHash, currentStatus);
        } catch (error) {
            console.error(`SPV: ❌ Error subscribing to ${scriptHash} (${subInfo.bchAddress}):`, error);
            // Consider removing subscription from map if server rejects it permanently?
            // if (error.message === 'Invalid scripthash') { this.subscriptions.delete(scriptHash); }
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
          console.warn(`SPV: Atualização recebida para scriptHash não rastreado: ${scriptHash}`);
          return;
        }

        // Only process if status has actually changed
        if (status === subInfo.lastStatus) {
            // console.log(`SPV: Status unchanged for ${subInfo.bchAddress} (${scriptHash}). Skipping update.`);
            return;
        }
        console.log(`SPV: 🚨 Status change detected for ${subInfo.bchAddress} (User: ${subInfo.userId}). Old: ${subInfo.lastStatus}, New: ${status}`);
        subInfo.lastStatus = status; // Update status *before* processing

        // Process wallet info update (this saves to DB)
        await this.updateUserWalletInfo(subInfo.userId, subInfo.bchAddress, scriptHash);

        // --- Emit WebSocket event AFTER processing ---
        // Use this.io (injected instance) and check if it's set
        if (this.io) {
            console.log(`SPV: Emitting 'walletUpdate' to user room: ${subInfo.userId}`);
            // Emit to the room named after the userId
            this.io.to(subInfo.userId).emit('walletUpdate', {
                message: `Wallet update detected for ${subInfo.bchAddress}`
                // Payload is simple, client should refetch data via API
            });
        } else {
            console.warn("SPV: Socket.IO instance (this.io) not set. Cannot emit 'walletUpdate'.");
        }
      }

    async updateUserWalletInfo(userId, bchAddress, scriptHash) {
        console.log(`SPV: Updating wallet info for User: ${userId}, Address: ${bchAddress}`);
        let user;

        try {
            user = await User.findById(userId);
            if (!user) {
                console.error(`SPV: User ${userId} not found during update for ${bchAddress}.`);
                // Consider removing subscription if user is gone?
                // this.subscriptions.delete(scriptHash);
                return;
            }

            if (!this.client || this.client.status !== 1) {
                console.warn(`SPV: Client disconnected before fetching balance/history for ${bchAddress}. Will retry on reconnect.`);
                // Reset status so it re-checks on next connection
                if (this.subscriptions.has(scriptHash)) {
                    this.subscriptions.get(scriptHash).lastStatus = null;
                }
                return;
            }

            // 1. Fetch Current Balance (From Electrum)
            const balanceResult = await this.client.request('blockchain.scripthash.get_balance', [scriptHash]);
            const currentBalanceSatoshis = balanceResult.confirmed + balanceResult.unconfirmed;
            const oldBalanceSatoshis = user.balance || 0; // Get old balance from DB

            // 2. Calculate Amount Change and Determine Type for the Batch
            const calculatedAmountSatoshis = currentBalanceSatoshis - oldBalanceSatoshis;
            let batchType = 'internal'; // Default if no change or complex
            if (calculatedAmountSatoshis > 0) {
                batchType = 'incoming';
            } else if (calculatedAmountSatoshis < 0) {
                batchType = 'outgoing';
            }
            const absoluteAmountSatoshis = Math.abs(calculatedAmountSatoshis); // Amount to store

            // 3. Fetch Transaction History Hashes (From Electrum)
            const history = await this.client.request('blockchain.scripthash.get_history', [scriptHash]);
            const processedTxIds = new Set(user.processedTxIds || []);
            let balanceChanged = false; // Flag to track if user.balance needs saving
            let newTxProcessedCount = 0; // Count successfully processed new TXs

            // 4. Identify and Process New Transactions
            const newTransactionsInfo = history.filter(tx => !processedTxIds.has(tx.tx_hash));

            if (newTransactionsInfo.length > 0) {
                console.log(`SPV: Found ${newTransactionsInfo.length} new transaction(s) for ${bchAddress}:`, newTransactionsInfo.map(tx => tx.tx_hash));
                console.log(`SPV: Calculated batch amount change: ${calculatedAmountSatoshis} sats. Type: ${batchType}`);

                // Only save transaction records if the balance actually changed
                if (calculatedAmountSatoshis !== 0) {
                    for (const txInfo of newTransactionsInfo) {
                        const { tx_hash: txid, height: blockHeight } = txInfo;

                        try {
                            // --- Create and Save Transaction Document ---
                            const newDbTransaction = new Transaction({
                                userId: user._id,
                                txid: txid,
                                address: bchAddress,
                                blockHeight: blockHeight || 0, // Use 0 for mempool/unconfirmed
                                timestamp: new Date(), // Timestamp of detection
                                amountSatoshis: absoluteAmountSatoshis, // Store the absolute batch amount change
                                type: batchType, // Store the overall batch type
                            });

                            await newDbTransaction.save();
                            console.log(`SPV: Saved transaction record ${txid} (Batch Amount: ${absoluteAmountSatoshis} sats, Type: ${batchType}) to DB for user ${userId}`);

                            // Mark this txid as processed *after* successfully saving to DB
                            processedTxIds.add(txid);
                            newTxProcessedCount++;

                        } catch (dbError) {
                            if (dbError.code === 11000) { // Handle MongoDB duplicate key error
                                console.log(`SPV: Transaction ${txid} already exists in DB (caught duplicate key error). Marking as processed.`);
                                processedTxIds.add(txid); // Mark as processed if duplicate
                            } else {
                                console.error(`SPV: ❌ Error saving tx ${txid} for user ${userId}:`, dbError);
                                // Do NOT add to processedTxIds if save failed for other reasons, allow retry
                            }
                        }
                    } // End loop through newTransactionsInfo
                } else {
                    // If balance didn't change but new TXs appeared (e.g., internal transfer, reorg?)
                    console.log(`SPV: New tx(s) detected but balance unchanged (${currentBalanceSatoshis} sats). Marking tx(s) as processed without saving amount/type.`);
                    newTransactionsInfo.forEach(txInfo => processedTxIds.add(txInfo.tx_hash));
                    // Optionally save records with amount 0 / type 'internal' here if needed
                }
            } // End if (newTransactionsInfo.length > 0)

            // 5. Update User Balance in DB (If it changed)
            if (currentBalanceSatoshis !== oldBalanceSatoshis) {
                console.log(`SPV: Balance update for ${bchAddress}. Old: ${oldBalanceSatoshis} sats, New: ${currentBalanceSatoshis} sats`);
                user.balance = currentBalanceSatoshis;
                balanceChanged = true;
            }

            // 6. Save User if balance or processed list changed
            // Check if the set size differs from the original array length OR if new TXs were processed (covers adding existing duplicates too)
            const processedIdsChanged = user.processedTxIds.length !== processedTxIds.size || newTxProcessedCount > 0;

            if (balanceChanged || processedIdsChanged) {
                user.processedTxIds = Array.from(processedTxIds); // Update processed list
                await user.save();
                console.log(`SPV: ✅ User ${userId} document updated successfully (Balance Changed: ${balanceChanged}, Processed Txs Changed: ${processedIdsChanged}).`);

                // NOTE: WebSocket emission is now handled in handleSubscriptionUpdate AFTER this function completes
                // if (newTxProcessedCount > 0) {
                //     console.log(`SPV: NOTIFICATION: ${newTxProcessedCount} new transaction record(s) saved for user ${userId}`);
                // }
            } else {
                 console.log(`SPV: No balance change or new processed txids found for ${bchAddress}.`);
            }

        } catch (error) {
            console.error(`SPV: ❌ Error in updateUserWalletInfo for User ${userId} (${bchAddress}):`, error);
             // Reset status to force re-check on next update cycle if an error occurred
             if (this.subscriptions.has(scriptHash)) {
                 this.subscriptions.get(scriptHash).lastStatus = null;
             }
             // Re-throw the error if needed, or handle appropriately
             // throw error;
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

        // Attempt initial connection
        await this.connect();

        // Subscribe to existing users after initial connection attempt (even if failed, will retry)
        try {
            console.log('SPV: Fetching initial users with BCH addresses from DB...');
            // Find users with a non-empty bchAddress field
            const usersToMonitor = await User.find({
                bchAddress: { $exists: true, $ne: null, $ne: '' }
            });
            console.log(`SPV: Found ${usersToMonitor.length} users with addresses to potentially monitor.`);

            for (const user of usersToMonitor) {
                // Use toString() for ObjectId safety
                await this.subscribe(user._id.toString(), user.bchAddress);
            }
            console.log('SPV: Initial user addresses processed for monitoring.');

        } catch (error) {
            console.error('SPV: ❌ Error during initial user fetch or subscription:', error);
        }
     }

    async stop() {
        console.log("SPV: Stopping service...");
        this.isRunning = false; // Prevent automatic reconnects
        clearTimeout(this.reconnectTimeout); // Clear any pending reconnect timeout
        this.subscriptions.clear(); // Clear tracked subscriptions

        if (this.client) {
            console.log("SPV: Closing Fulcrum client connection...");
            try {
                // electrum-client close() doesn't seem to return a promise consistently,
                // but we call it anyway.
                this.client.close();
                console.log("SPV: Fulcrum client closed.");
            } catch (error) {
                console.error("SPV: Error closing Fulcrum client:", error);
            } finally {
                this.client = null; // Ensure client is nullified
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
            // Optionally, you could queue this to be added when the service starts/reconnects
            return;
        }
        console.log(`SPV: Dynamically adding subscription for User: ${userId}, Address: ${bchAddress}`);
        // The subscribe method handles adding to map and subscribing if connected
        await this.subscribe(userId, bchAddress);
     }

} // End Class SpvMonitorService

// --- Export Singleton Instance ---
// Create and export a single instance of the service
const spvMonitorServiceInstance = new SpvMonitorService();

// Export methods including the setter for dependency injection
module.exports = {
    start: () => spvMonitorServiceInstance.start(),
    stop: () => spvMonitorServiceInstance.stop(),
    addSubscription: (userId, bchAddress) => spvMonitorServiceInstance.addSubscription(userId, bchAddress),
    setIoServer: (ioInstance) => spvMonitorServiceInstance.setIoServer(ioInstance) // Expose the setter
};
