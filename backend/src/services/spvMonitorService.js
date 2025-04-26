const ElectrumClient = require('electrum-client');
const cashaddr = require('cashaddrjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/user');
const Transaction = require('../models/transaction'); 
const { FULCRUM_SERVERS } = require('../config/fullcrumConfig');

const BCHJS = require('@psf/bch-js');
const bchjs = new BCHJS(); 

// --- Configuration ---
const RECONNECT_DELAY_MS = 10000;
const ELECTRUM_PROTOCOL_VERSION = '1.4';
const BRL_PER_BCH = 1000; // Example conversion rate

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
        ioInstance.on('connection', (socket) => {
            const userId = socket.handshake.auth.token; // Decodifique o token para obter o ID do usuário
            if (userId) {
                socket.join(userId); // Adicione o socket à sala do usuário
                console.log(`Usuário conectado à sala: ${userId}`);
            }
        });
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
            console.log(`SPV: Status unchanged for ${subInfo.bchAddress} (${scriptHash}). Skipping update.`);
            return;
        }

        console.log(`SPV: 🚨 Status change detected for ${subInfo.bchAddress} (User: ${subInfo.userId}). Old: ${subInfo.lastStatus}, New: ${status}`);
        subInfo.lastStatus = status; // Update status *before* processing

        // Process wallet info update (fetches details, saves to DB)
        const { calculatedAmountSatoshis, sentAmountSatoshis } = await this.updateUserWalletInfo(subInfo.userId, subInfo.bchAddress, scriptHash);

        // Emit WebSocket event AFTER processing
        if (this.io) {
            console.log(`SPV: Emitting 'walletUpdate' to user room: ${subInfo.userId}`);
            const message = sentAmountSatoshis > 0
                ? `Você enviou ${sentAmountSatoshis / 1e8} BCH para um endereço.`
                : `Pagamento detectado para o endereço ${subInfo.bchAddress}.`;

            // Emit only to the specific user's room
            this.io.to(subInfo.userId).emit('walletUpdate', {
                message,
                address: subInfo.bchAddress,
                userId: subInfo.userId,
                amountBCH: calculatedAmountSatoshis / 1e8, // Valor em BCH
                amountBRL: (calculatedAmountSatoshis / 1e8) * BRL_PER_BCH, // Valor em BRL
                sentAmountBCH: sentAmountSatoshis / 1e8, // Valor enviado em BCH
                status: status,
            });
        } else {
            console.warn("SPV: Socket.IO instance (this.io) not set. Cannot emit 'walletUpdate'.");
        }
    }

    // --- THIS IS THE CORE FUNCTION THAT WAS MODIFIED ---
    async updateUserWalletInfo(userId, bchAddress, scriptHash) {
        console.log(`SPV: Updating wallet info for User: ${userId}, Address: ${bchAddress}`);
        
        let user;
        let calculatedAmountSatoshis = 0;
        let sentAmountSatoshis = 0;
    
        try {
            user = await User.findById(userId);
            if (!user) {
                console.error(`SPV: User ${userId} not found during update for ${bchAddress}.`);
                return { calculatedAmountSatoshis, sentAmountSatoshis };
            }
    
            if (!this.client || this.client.status !== 1) {
                console.warn(`SPV: Client disconnected before fetching balance/history for ${bchAddress}. Will retry on reconnect.`);
                if (this.subscriptions.has(scriptHash)) {
                    this.subscriptions.get(scriptHash).lastStatus = null;
                }
                return { calculatedAmountSatoshis, sentAmountSatoshis };
            }
    
            const balanceResult = await this.client.request('blockchain.scripthash.get_balance', [scriptHash]);
            const currentBalanceSatoshis = balanceResult.confirmed + balanceResult.unconfirmed;
            const oldBalanceSatoshis = user.balance || 0;
    
            calculatedAmountSatoshis = currentBalanceSatoshis - oldBalanceSatoshis;
    
            const history = await this.client.request('blockchain.scripthash.get_history', [scriptHash]);
            for (const tx of history) {
                const transaction = await Transaction.findOne({ txid: tx.tx_hash });
                if (transaction && transaction.type === 'sent') {
                    sentAmountSatoshis += transaction.amountSatoshis;
                }
            }
    
            if (currentBalanceSatoshis !== oldBalanceSatoshis) {
                user.balance = currentBalanceSatoshis;
                await user.save();
            }
    
        } catch (error) {
            console.error(`SPV: ❌ Error in updateUserWalletInfo for User ${userId} (${bchAddress}):`, error);
            if (this.subscriptions.has(scriptHash)) {
                this.subscriptions.get(scriptHash).lastStatus = null;
            }
        }
    
        return { calculatedAmountSatoshis, sentAmountSatoshis };
    }

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

spvMonitorServiceInstance.handleSubscriptionUpdate('testScriptHash', 'newStatus');

module.exports = {
    start: () => spvMonitorServiceInstance.start(),
    stop: () => spvMonitorServiceInstance.stop(),
    addSubscription: (userId, bchAddress) => spvMonitorServiceInstance.addSubscription(userId, bchAddress),
    setIoServer: (ioInstance) => spvMonitorServiceInstance.setIoServer(ioInstance) // Expose the setter
};
