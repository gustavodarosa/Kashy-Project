// backend/src/services/spvMonitorService.js

const ElectrumClient = require('electrum-client');
const cashaddr = require('cashaddrjs');
const crypto = require('crypto');
const mongoose = require('mongoose'); // Required if interacting directly with User model here
const User = require('../models/user'); // Adjust path as needed

// ======= CONFIGURATIONS ======= //
// Consider moving these to environment variables
const FULCRUM_SERVERS = [
    { host: 'fulcrum.greyh.at', port: 50002, protocol: 'ssl' },    
    { host: 'electrum.imaginary.cash', port: 50002, protocol: 'ssl' },    
    { host: 'bch.imaginary.cash', port: 50002, protocol: 'ssl' },    
    { host: 'electroncash.dk', port: 60002, protocol: 'ssl' },    
    { host: 'bch.soul-dev.com', port: 50002, protocol: 'ssl' },
    
];
const RECONNECT_DELAY_MS = 10000; // 10 seconds
const ELECTRUM_PROTOCOL_VERSION = '1.4'; // Common version

// ======= UTILITIES (from fulcrum.js) ======= //
function addressToScriptPubKey(address) {
    try {
        const { type, hash } = cashaddr.decode(address);
        // Support P2PKH and P2SH (though P2PKH is most common for user wallets)
        if (type === 'P2PKH') {
            return `76a914${Buffer.from(hash).toString('hex')}88ac`; // OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
        } else if (type === 'P2SH') {
            return `a914${Buffer.from(hash).toString('hex')}87`; // OP_HASH160 <scriptHash> OP_EQUAL
        } else {
            throw new Error(`Unsupported address type: ${type}`);
        }
    } catch (error) {
        console.error(`SPV: Error decoding address ${address}: ${error.message}`);
        throw new Error(`Invalid BCH address format: ${address}`);
    }
}

function scriptPubKeyToScriptHash(scriptHex) {
    const hash = crypto.createHash('sha256').update(Buffer.from(scriptHex, 'hex')).digest();
    return Buffer.from(hash.reverse()).toString('hex');
}

class SpvMonitorService {
    constructor() {
        this.client = null;
        this.currentServer = null;
        this.subscriptions = new Map(); // Map<scriptHash, { userId: string, bchAddress: string, lastStatus: string | null }>
        this.reconnectTimeout = null;
        this.isConnecting = false;
        this.isRunning = false;
    }

    // --- Connection Management ---

    async connect() {
        if (this.client && this.client.status === 1) return; // Already connected
        if (this.isConnecting) return; // Connection attempt in progress

        this.isConnecting = true;
        clearTimeout(this.reconnectTimeout);
        console.log('SPV: Attempting to connect to Fulcrum server...');

        for (const server of FULCRUM_SERVERS) {
            try {
                const potentialClient = new ElectrumClient(server.port, server.host, server.protocol);
                console.log(`SPV: Trying ${server.host}:${server.port}...`);

                // Set connection timeout (e.g., 10 seconds)
                const connectPromise = potentialClient.connect('kashy-spv-monitor', ELECTRUM_PROTOCOL_VERSION);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 10000));
                await Promise.race([connectPromise, timeoutPromise]);

                // Check server version compatibility
                await potentialClient.server_version('kashy-spv-monitor', ELECTRUM_PROTOCOL_VERSION);

                console.log(`SPV: ✅ Successfully connected to ${server.host}`);
                this.client = potentialClient;
                this.currentServer = server;
                this.isConnecting = false;

                this.client.onClose = () => {
                    console.error(`SPV: ❌ Disconnected from ${this.currentServer?.host}. Attempting reconnect...`);
                    this.client = null;
                    this.currentServer = null;
                    // Don't clear subscriptions here, just mark status as null maybe? Or rely on resubscribe.
                    // Clear last known status on disconnect to force re-check on reconnect
                    this.subscriptions.forEach(sub => sub.lastStatus = null);
                    if (this.isRunning) {
                        this.scheduleReconnect();
                    }
                };

                // Attach the global subscription listener *once* per connection
                this.attachSubscriptionListener();

                // Resubscribe to all tracked addresses
                await this.resubscribeAll();
                return; // Exit loop on successful connection

            } catch (err) {
                console.warn(`SPV: ⚠️ Failed to connect or handshake with ${server.host}: ${err.message}. Trying next...`);
                if (potentialClient) await potentialClient.close(); // Ensure client is closed
            }
        }

        console.error('SPV: 😓 Could not connect to any Fulcrum server.');
        this.isConnecting = false;
        if (this.isRunning) {
            this.scheduleReconnect(); // Schedule retry if service is supposed to be running
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
        // Use the event emitter provided by electrum-client
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

        let scriptHash;
        try {
            const scriptPubKey = addressToScriptPubKey(bchAddress);
            scriptHash = scriptPubKeyToScriptHash(scriptPubKey);
        } catch (error) {
            console.error(`SPV: Failed to get script hash for ${bchAddress}: ${error.message}`);
            return; // Cannot subscribe if address is invalid
        }

        // Add to our tracking map immediately, even if not connected
        if (!this.subscriptions.has(scriptHash)) {
            console.log(`SPV: Tracking subscription for ${bchAddress} (User: ${userId})`);
            this.subscriptions.set(scriptHash, { userId, bchAddress, lastStatus: null });
        } else {
             // Ensure userId is updated if somehow it changed for the same address (unlikely)
             this.subscriptions.get(scriptHash).userId = userId;
        }


        // If connected, attempt to subscribe immediately
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
            // This returns the *current* status and registers for future updates
            const currentStatus = await this.client.request(
                'blockchain.scripthash.subscribe', // Method name as string
                [scriptHash]                       // Parameters as an array
            )
            console.log(`SPV: Initial status for ${subInfo.bchAddress}: ${currentStatus}`);
            // Process this initial status immediately
            await this.handleSubscriptionUpdate(scriptHash, currentStatus);
        } catch (error) {
            console.error(`SPV: ❌ Error subscribing to ${scriptHash} (${subInfo.bchAddress}):`, error);
            // Handle potential errors, e.g., server error
        }
    }

    async resubscribeAll() {
        if (!this.client || this.client.status !== 1) {
            console.warn("SPV: Cannot resubscribe, client not connected.");
            return;
        }
        console.log(`SPV: Resubscribing to ${this.subscriptions.size} tracked addresses...`);
        // Create a copy of keys to avoid issues if map is modified during iteration
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
            console.warn(`SPV: Received update for untracked scriptHash: ${scriptHash}`);
            return;
        }

        // Electrum protocol: status is null if no transactions, otherwise hash of status history.
        // Only process if the status has actually changed since the last known status.
        if (status === subInfo.lastStatus) {
            // console.log(`SPV: Status unchanged for ${subInfo.bchAddress} (${scriptHash}). Skipping update.`);
            return;
        }

        console.log(`SPV: 🚨 Status change detected for ${subInfo.bchAddress} (User: ${subInfo.userId}). Old: ${subInfo.lastStatus}, New: ${status}`);
        subInfo.lastStatus = status; // Update last known status

        // Fetch user data and update balance/transactions
        await this.updateUserWalletInfo(subInfo.userId, subInfo.bchAddress, scriptHash);
    }

    async updateUserWalletInfo(userId, bchAddress, scriptHash) {
        console.log(`SPV: Updating wallet info for User: ${userId}, Address: ${bchAddress}`);
        try {
            const user = await User.findById(userId);
            if (!user) {
                console.error(`SPV: User ${userId} not found during update for ${bchAddress}.`);
                // Maybe unsubscribe or mark as inactive?
                // this.unsubscribe(scriptHash); // Consider adding an unsubscribe method
                return;
            }

            if (!this.client || this.client.status !== 1) {
                console.warn(`SPV: Client disconnected before fetching balance/history for ${bchAddress}. Will retry on reconnect.`);
                // Reset lastStatus so it forces check on reconnect
                if (this.subscriptions.has(scriptHash)) {
                    this.subscriptions.get(scriptHash).lastStatus = null;
                }
                return;
            }

            // 1. Fetch Current Balance from Fulcrum
            const balanceResult = await this.client.request(
                'blockchain.scripthash.get_balance', // Method name as string
                [scriptHash]                         // Parameters as an array
            );

            const currentBalanceSatoshis = balanceResult.confirmed + balanceResult.unconfirmed;
            const oldBalanceSatoshis = user.balance || 0; // Assumes 'balance' field exists and is in satoshis

            // 2. Fetch Transaction History from Fulcrum
            const history = await this.client.request(
                'blockchain.scripthash.get_history', // Method name as string
                [scriptHash]                         // Parameters as an array
            );
            const processedTxIds = new Set(user.processedTxIds || []); // Assumes 'processedTxIds' field exists
            let newTxFound = false;
            let balanceChanged = false;

            // 3. Identify New Transactions
            const newTransactions = history.filter(tx => !processedTxIds.has(tx.tx_hash));
            if (newTransactions.length > 0) {
                newTxFound = true;
                console.log(`SPV: Found ${newTransactions.length} new transaction(s) for ${bchAddress}:`, newTransactions.map(tx => tx.tx_hash));
                newTransactions.forEach(tx => processedTxIds.add(tx.tx_hash));
                user.processedTxIds = Array.from(processedTxIds);
            }

            // 4. Update Balance if necessary
            if (currentBalanceSatoshis !== oldBalanceSatoshis) {
                console.log(`SPV: Balance update for ${bchAddress}. Old: ${oldBalanceSatoshis} sats, New: ${currentBalanceSatoshis} sats`);
                user.balance = currentBalanceSatoshis;
                balanceChanged = true;
            } else if (newTxFound) {
                 console.log(`SPV: New TX detected for ${bchAddress}, but balance ${currentBalanceSatoshis} sats is unchanged. Still updating processed TXs.`);
            }

            // 5. Save User if changes occurred
            if (newTxFound || balanceChanged) {
                await user.save();
                console.log(`SPV: ✅ User ${userId} document updated successfully.`);

                // --- Trigger Notifications (Placeholder) ---
                if (newTxFound) {
                    console.log(`SPV: NOTIFICATION: New transaction(s) detected for user ${userId}`);
                    // Implement actual notification logic here (e.g., emit event, call notification service)
                    // notifyUser(userId, newTransactions);
                }
            } else {
                 console.log(`SPV: No new transactions or balance change found for ${bchAddress} after checking history/balance.`);
            }

        } catch (error) {
            console.error(`SPV: ❌ Error updating wallet info for User ${userId} (${bchAddress}):`, error);
            // Reset lastStatus to force re-check on next notification or reconnect
             if (this.subscriptions.has(scriptHash)) {
                 this.subscriptions.get(scriptHash).lastStatus = null;
             }
        }
    }

    // --- Service Lifecycle ---

    async start() {
        if (this.isRunning) {
            console.warn("SPV: Service already started.");
            return;
        }
        console.log('SPV: Starting service...');
        this.isRunning = true;

        // Initial connection attempt
        await this.connect();

        // Fetch initial users AFTER the first connection attempt (successful or not)
        // The subscribe method handles queuing if not connected yet.
        try {
            console.log('SPV: Fetching initial users with BCH addresses from DB...');
            // Ensure we only fetch users with valid-looking addresses if possible
            const usersToMonitor = await User.find({
                bchAddress: { $exists: true, $ne: null, $ne: '' }
                // Optional: Add regex check if needed, but addressToScriptPubKey handles format errors
                // bchAddress: /^bitcoincash:[q p z k j 0-9 a-z A-Z]+$/
            });
            console.log(`SPV: Found ${usersToMonitor.length} users with addresses to potentially monitor.`);

            for (const user of usersToMonitor) {
                // The subscribe method handles adding to the map and subscribing if connected
                await this.subscribe(user._id.toString(), user.bchAddress);
            }
            console.log('SPV: Initial user addresses processed for monitoring.');

        } catch (error) {
            console.error('SPV: ❌ Error during initial user fetch:', error);
        }
    }

    async stop() {
        console.log("SPV: Stopping service...");
        this.isRunning = false;
        clearTimeout(this.reconnectTimeout);
        this.subscriptions.clear();
        if (this.client) {
            try {
                await this.client.close();
                console.log("SPV: Fulcrum client closed.");
            } catch (error) {
                console.error("SPV: Error closing Fulcrum client:", error);
            }
            this.client = null;
            this.currentServer = null;
        }
    }

    // --- Public Methods ---

    // Method to be called when a new user/address is added
    async addSubscription(userId, bchAddress) {
        if (!this.isRunning) {
            console.warn("SPV: Service not running. Cannot add dynamic subscription.");
            return;
        }
        console.log(`SPV: Dynamically adding subscription for User: ${userId}, Address: ${bchAddress}`);
        await this.subscribe(userId, bchAddress); // Use the internal subscribe method
    }
}

// --- Export Singleton Instance ---
const spvMonitorService = new SpvMonitorService();

module.exports = {
    start: () => spvMonitorService.start(),
    stop: () => spvMonitorService.stop(), // Good practice to have a stop method
    addSubscription: (userId, bchAddress) => spvMonitorService.addSubscription(userId, bchAddress),
    // Expose instance if needed for debugging or advanced control (optional)
    // getInstance: () => spvMonitorService
};
