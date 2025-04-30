// z:\Kashy-Project\backend\src\services\spvMonitorService.js
const ElectrumClient = require('electrum-client');
const cashaddr = require('cashaddrjs');
const crypto = require('crypto');
const User = require('../models/user'); // Needed for initial load
const { FULCRUM_SERVERS } = require('../config/fullcrumConfig');
const logger = require('../utils/logger');
const bchService = require('./bchService'); // Import bchService for getBalance

// --- Configuration (Keep as is) ---
const RECONNECT_DELAY_MS = 10000;
const PERIODIC_RETRY_INTERVAL_MS = 5 * 60 * 1000; // Check failed primaries periodically
const ELECTRUM_PROTOCOL_VERSION = '1.4';
const CONNECTION_TIMEOUT_MS = 10000;
const REQUEST_TIMEOUT_MS = 15000;
const TARGET_CONNECTIONS = 4;
const TX_CACHE_TTL_MS = 5 * 60 * 1000; // Cache for status hash to prevent rapid reprocessing
const CACHE_CLEANUP_INTERVAL_MS = 60 * 1000;
const SATOSHIS_PER_BCH = 1e8;

// --- Utilities ---
function addressToScriptPubKey(address) {
    try {
        const { type, hash } = cashaddr.decode(address);
        if (type === 'P2PKH') {
            const hashBuffer = Buffer.from(hash);
            return Buffer.concat([ Buffer.from([0x76, 0xa9, hashBuffer.length]), hashBuffer, Buffer.from([0x88, 0xac]) ]);
        } else if (type === 'P2SH') {
            const hashBuffer = Buffer.from(hash);
            return Buffer.concat([ Buffer.from([0xa9, hashBuffer.length]), hashBuffer, Buffer.from([0x87]) ]);
        }
        throw new Error(`Unsupported address type: ${type}`);
    } catch (e) {
        logger.error(`SPV: Error converting address ${address} to scriptPubKey buffer: ${e.message}`);
        throw e;
    }
}

function scriptPubKeyToScriptHash(scriptHex) {
    const scriptBuffer = Buffer.from(scriptHex, 'hex');
    const hash = crypto.createHash('sha256').update(scriptBuffer).digest();
    return Buffer.from(hash.reverse()).toString('hex');
}
// --- End Utilities ---

class SpvMonitorService {
    constructor() {
        this.clients = new Map(); // Map<serverId, { client, config, connecting, subscriptions: Set<scriptHash> }>
        this.subscriptions = new Map(); // Map<scriptHash, { userId, bchAddress }>
        this.rankedServers = FULCRUM_SERVERS;
        this.desiredConnectionCount = TARGET_CONNECTIONS;
        // Select primary servers based on rank
        this.primaryServerConfigs = this.rankedServers.slice(0, this.desiredConnectionCount);
        this.failedPrimaryServers = new Set(); // Set<serverId>
        this.reconnectTimers = new Map(); // Map<serverId, NodeJS.Timeout>
        this.periodicRetryTimer = null;
        this.isRunning = false;
        this.io = null; // Socket.IO server instance
        this.processedTxCache = new Map(); // Map<statusHash, timestamp>
        this.cacheCleanupTimer = null;
        this.processingLocks = new Set(); // Lock Set
    }

    setIoServer(ioInstance) {
        this.io = ioInstance;
        logger.info('SPV: Socket.IO server instance received.');
    }

    // --- Connection Management (Unchanged) ---
    async connectToServer(serverConfig, isPeriodicRetry = false) {
        const serverId = `${serverConfig.host}:${serverConfig.port}`;
        const existingEntry = this.clients.get(serverId);

        if (existingEntry && (existingEntry.client?.status === 1 || existingEntry.connecting)) {
             if (isPeriodicRetry && this.failedPrimaryServers.has(serverId)) {
                 this.failedPrimaryServers.delete(serverId);
             }
             return;
        }
        logger.info(`SPV: Attempting to connect to ${serverId}...${isPeriodicRetry ? ' (Periodic Retry)' : ''}`);
        this.clients.set(serverId, { client: null, config: serverConfig, connecting: true, subscriptions: new Set() });
        const immediateTimer = this.reconnectTimers.get(serverId);
        if (immediateTimer) { clearTimeout(immediateTimer); this.reconnectTimers.delete(serverId); }

        let client;
        try {
            client = new ElectrumClient(serverConfig.port, serverConfig.host, serverConfig.protocol);
            await withTimeout(client.connect('kashy-spv-monitor', ELECTRUM_PROTOCOL_VERSION), CONNECTION_TIMEOUT_MS, `Connection timeout to ${serverId}`);
            await withTimeout(client.server_version('kashy-spv-monitor', ELECTRUM_PROTOCOL_VERSION), REQUEST_TIMEOUT_MS, `Server version timeout for ${serverId}`);

            logger.info(`SPV: ✅ Successfully connected to ${serverId}.`);
            const clientEntry = this.clients.get(serverId);
            if (clientEntry) {
                clientEntry.client = client; clientEntry.connecting = false;
            } else {
                this.clients.set(serverId, { client, config: serverConfig, connecting: false, subscriptions: new Set() });
            }

            if (this.failedPrimaryServers.has(serverId)) {
                this.failedPrimaryServers.delete(serverId);
            }

            this.attachListenersToClient(client, serverId);
            await this.resubscribeClient(client, serverId);

        } catch (error) {
            logger.error(`SPV: 😓 Failed to connect to ${serverId}: ${error.message}`);
            this.clients.delete(serverId);
            if (client) { try { await client.close(); } catch (e) { /* Ignore */ } }
            if (!isPeriodicRetry) { this.scheduleReconnect(serverId, serverConfig); }
            this.tryConnectFallback();
        }
    }
    attachListenersToClient(client, serverId) {
        client.subscribe.removeAllListeners('blockchain.scripthash.subscribe');
        client.subscribe.on('blockchain.scripthash.subscribe', (params) => {
            const scriptHash = params[0]; const status = params[1];
            logger.info(`SPV: <<< Update Received <<< Server: ${serverId}, SH: ${scriptHash}, Status: ${status}`);
            if (scriptHash && status !== null) { this.handleSubscriptionUpdate(scriptHash, status, serverId); }
        });
        client.onClose = () => {
            logger.error(`SPV: ❌ Disconnected from ${serverId}.`);
            const clientEntry = this.clients.get(serverId); this.clients.delete(serverId);
            const isPrimary = this.primaryServerConfigs.some(cfg => `${cfg.host}:${cfg.port}` === serverId);
            if (isPrimary) { this.failedPrimaryServers.add(serverId); }
            if (this.isRunning && clientEntry) { this.scheduleReconnect(serverId, clientEntry.config); }
            this.tryConnectFallback();
        };
        logger.info(`SPV: Attached listeners to ${serverId}.`);
    }
    scheduleReconnect(serverId, serverConfig) {
        const existingEntry = this.clients.get(serverId);
        if ((existingEntry && (existingEntry.client?.status === 1 || existingEntry.connecting)) || this.reconnectTimers.has(serverId)) { return; }
        logger.info(`SPV: Scheduling reconnect attempt for ${serverId} in ${RECONNECT_DELAY_MS / 1000}s...`);
        const timer = setTimeout(async () => {
            this.reconnectTimers.delete(serverId);
            if (this.isRunning) {
               const currentEntry = this.clients.get(serverId);
               if (!currentEntry || (!currentEntry.client && !currentEntry.connecting)) { await this.connectToServer(serverConfig, false); }
            }
        }, RECONNECT_DELAY_MS);
        this.reconnectTimers.set(serverId, timer);
     }
    tryConnectFallback() {
        if (!this.isRunning || this.clients.size >= this.desiredConnectionCount) return;
        logger.info(`SPV: Below target connections (${this.clients.size}/${this.desiredConnectionCount}). Checking fallback...`);
        for (const fallbackConfig of this.rankedServers) {
            const fallbackServerId = `${fallbackConfig.host}:${fallbackConfig.port}`;
            if (this.primaryServerConfigs.some(cfg => `${cfg.host}:${cfg.port}` === fallbackServerId)) { continue; }
            const existingEntry = this.clients.get(fallbackServerId);
            if (!existingEntry || (!existingEntry.client && !existingEntry.connecting && !this.reconnectTimers.has(fallbackServerId))) {
                 logger.debug(`SPV: Attempting fallback connection to ${fallbackServerId}...`);
                 this.connectToServer(fallbackConfig, false);
                 return;
            }
        }
        logger.warn(`SPV: Could not find available fallback servers to connect.`);
    }
    retryFailedPrimaries() {
        if (!this.isRunning || this.failedPrimaryServers.size === 0) return;
        logger.debug(`SPV: [Periodic Retry] Checking ${this.failedPrimaryServers.size} failed primary servers...`);
        this.failedPrimaryServers.forEach(serverId => {
            const serverConfig = this.primaryServerConfigs.find(cfg => `${cfg.host}:${cfg.port}` === serverId);
            if (serverConfig) {
                const existingEntry = this.clients.get(serverId);
                 if (!existingEntry || (!existingEntry.client && !existingEntry.connecting)) { this.connectToServer(serverConfig, true); }
                 else { this.failedPrimaryServers.delete(serverId); }
            } else { this.failedPrimaryServers.delete(serverId); }
        });
    }

    // --- Subscription Management (Unchanged) ---
    async addSubscription(userId, bchAddress) {
        if (!userId || !bchAddress) { logger.warn('SPV: Missing userId or bchAddress for subscription.'); return; }
        try {
            const scriptPubKeyHex = addressToScriptPubKey(bchAddress);
            const scriptHash = scriptPubKeyToScriptHash(scriptPubKeyHex);
            if (!this.subscriptions.has(scriptHash)) {
                this.subscriptions.set(scriptHash, { userId, bchAddress });
                logger.info(`SPV: [Sub Added] Monitoring User: ${userId}, Addr: ${bchAddress}, SH: ${scriptHash}`);
                const subPromises = [];
                for (const [serverId, clientEntry] of this.clients.entries()) {
                    if (clientEntry.client?.status === 1) { subPromises.push(this.performSubscription(clientEntry.client, serverId, scriptHash)); }
                }
                await Promise.allSettled(subPromises);
            }
        } catch (error) { logger.error(`SPV: Failed subscription process for User ${userId}, Addr ${bchAddress}: ${error.message}`); }
    }
    async performSubscription(client, serverId, scriptHash) {
        const clientEntry = this.clients.get(serverId);
        if (!clientEntry || clientEntry.subscriptions.has(scriptHash)) return true;
        try {
            logger.info(`SPV: [Subscribing] Sending sub for ${scriptHash} to ${serverId}...`);
            const initialStatus = await withTimeout( client.request('blockchain.scripthash.subscribe', [scriptHash]), REQUEST_TIMEOUT_MS, `Sub timeout ${scriptHash} on ${serverId}` );
            logger.info(`SPV: [Sub OK] ${serverId} to ${scriptHash}. Initial Status: ${initialStatus}`);
            clientEntry.subscriptions.add(scriptHash);
            if (initialStatus !== null) { await this.handleSubscriptionUpdate(scriptHash, initialStatus, serverId); }
            return true;
        } catch (error) {
            logger.error(`SPV: [Sub FAIL] ${serverId} to ${scriptHash}: ${error.message}`);
            return false;
        }
    }
    async resubscribeClient(client, serverId) {
        logger.info(`SPV: Resubscribing all (${this.subscriptions.size}) addresses to ${serverId}...`);
        const resubPromises = [];
        for (const scriptHash of this.subscriptions.keys()) { resubPromises.push(this.performSubscription(client, serverId, scriptHash)); }
        const results = await Promise.allSettled(resubPromises);
        const successfulResubs = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
        logger.info(`SPV: Resubscription to ${serverId} complete. ${successfulResubs}/${this.subscriptions.size} successful.`);
    }

    // --- Update Handling & Recovery/Reconciliation ---

    isTxRecentlyProcessedByStatus(status) {
        const lastProcessed = this.processedTxCache.get(status);
        return lastProcessed && (Date.now() - lastProcessed < TX_CACHE_TTL_MS);
    }
    cleanupTxCache() {
        const now = Date.now(); let cleanedCount = 0;
        for (const [status, timestamp] of this.processedTxCache.entries()) {
            if (now - timestamp > TX_CACHE_TTL_MS) { this.processedTxCache.delete(status); cleanedCount++; }
        }
        if (cleanedCount > 0) logger.debug(`SPV: [Cache Cleanup] Removed ${cleanedCount} expired status entries.`);
    }

    /**
     * Main handler for status updates received from Electrum servers.
     * Implements locking to prevent concurrent processing for the same scriptHash.
     */
    async handleSubscriptionUpdate(scriptHash, status, serverId) {
        logger.info(`SPV: [Update Handling] Processing status update for SH: ${scriptHash}, Status: ${status}, From: ${serverId}`);
        if (this.isTxRecentlyProcessedByStatus(status)) { logger.info(`SPV: [Cache Hit] Status ${status} recently processed. Skipping.`); return; }
        if (this.processingLocks.has(scriptHash)) { logger.info(`SPV: [Lock Hit] Processing already in progress for SH: ${scriptHash}. Skipping.`); return; }
        const subInfo = this.subscriptions.get(scriptHash);
        if (!subInfo) {
            logger.warn(`SPV: [Update Warning] Received update for untracked SH: ${scriptHash}. Ignoring.`);
            return;
        }
        logger.debug(`SPV: [Update Identified] Update is for User: ${subInfo.userId}, Addr: ${subInfo.bchAddress}`);

        try {
             this.processingLocks.add(scriptHash);
             logger.debug(`SPV: [Lock Set] Acquired processing lock for SH: ${scriptHash}`);
             // Call the main processing function
             await this.processStatusUpdateAndReconcile(subInfo.userId, subInfo.bchAddress, scriptHash, status);
             // Cache status *after* successful processing attempt
             this.processedTxCache.set(status, Date.now());
             logger.debug(`SPV: [Cache Set] Added status ${status} to processed cache.`);

        } catch (error) {
             logger.error(`SPV: [Update Error] Error during notification processing for SH ${scriptHash} (Status: ${status}): ${error.message}`);
             // Do NOT cache status if processing failed, allow retry on next update
        } finally {
             this.processingLocks.delete(scriptHash);
             logger.debug(`SPV: [Lock Released] Released processing lock for SH: ${scriptHash}`);
        }
    }

    /**
     * Processes a status update: fetches balance, history, identifies missing transactions,
     * updates the database (User balance, processedTxIds), and notifies the user.
     * --- Does NOT save Transaction documents anymore. ---
     */
    async processStatusUpdateAndReconcile(userId, bchAddress, scriptHash, status) {
        logger.info(`SPV: [Process/Reconcile] User: ${userId}, Addr: ${bchAddress}`);
        let user;
        let fetchedBalanceData;
        let fetchedTransactions;

        try {
            // 1. Fetch User Data
            user = await User.findById(userId).select('+balance +processedTxIds');
            if (!user) { logger.error(`SPV: User ${userId} not found for ${bchAddress}.`); return; }
            const oldBalanceSatoshis = user.balance || 0;
            const processedTxIds = new Set(user.processedTxIds || []);

            // 2. Fetch Current Balance
            try {
                fetchedBalanceData = await bchService.getBalance(bchAddress);
                logger.info(`SPV: Fetched balance for ${bchAddress}: Confirmed=${fetchedBalanceData.balance}, Unconfirmed=${fetchedBalanceData.unconfirmedBalance}`);
            } catch (balanceError) { logger.error(`SPV: Failed getting balance for ${bchAddress}: ${balanceError.message}`); throw balanceError; }
            const currentConfirmedBalanceSats = Math.round((fetchedBalanceData.balance || 0) * SATOSHIS_PER_BCH);

            // 3. Fetch Blockchain Transaction History (only need txids)
            const blockchainTransactions = await this.fetchBlockchainTransactions(bchAddress);

            // 4. Identify Missing Transactions (txids not in user.processedTxIds)
            const missingTransactions = blockchainTransactions.filter(tx => !processedTxIds.has(tx.txid));
            logger.info(`SPV: Found ${missingTransactions.length} potential new/missing txids for ${bchAddress}.`);

            // 5. Mark Missing Transaction IDs as Processed
            if (missingTransactions.length > 0) {
                needsUserSave = true; // Mark user for saving
                logger.info(`SPV: Marking ${missingTransactions.length} new txids as processed for ${bchAddress}...`);
                missingTransactions.forEach(missingTx => {
                    newlyProcessedTxIds.add(missingTx.txid);
                });
                // No need to fetch details or save Transaction documents here anymore
                logger.info(`SPV: ${newlyProcessedTxIds.size} txids marked for addition to processed list.`);
            }

            // 6. Update User Balance if Changed
            if (currentConfirmedBalanceSats !== oldBalanceSatoshis) {
                logger.info(`SPV: Balance update for ${bchAddress}. Old: ${oldBalanceSatoshis}, New Confirmed: ${currentConfirmedBalanceSats}`);
                user.balance = currentConfirmedBalanceSats;
                needsUserSave = true;
            }

            // 7. Save User if Changes Occurred (Balance or Processed IDs)
            if (needsUserSave) {
                newlyProcessedTxIds.forEach(id => user.processedTxIds.push(id));
                user.processedTxIds = [...new Set(user.processedTxIds)]; // Ensure uniqueness
                await user.save();
                logger.info(`SPV: ✅ User ${userId} document updated (Balance/Processed Txs).`);
            } else {
                 logger.info(`SPV: No DB changes needed for User ${userId} this cycle.`);
            }

            // 8. Emit WebSocket Notification (using fetched balance data)
            if (this.io) {
                const payload = {
                    message: `Status atualizado para ${bchAddress}`, address: bchAddress, userId: userId,
                    balance: fetchedBalanceData.balance, // Confirmed BCH
                    unconfirmedBalance: fetchedBalanceData.unconfirmedBalance, // Unconfirmed BCH
                    statusHash: status
                };
                logger.info(`SPV: Emitting 'balanceUpdate' to user room: ${userId}`);
                this.io.to(userId).emit('balanceUpdate', payload);
            } else { logger.warn("SPV: Socket.IO instance not set. Cannot emit 'balanceUpdate'."); }

        } catch (error) {
            logger.error(`SPV: Critical error processing update for User ${userId} (${bchAddress}): ${error.message}`);
        }
    }


    // --- Helper Methods (Unchanged, but fetchTransactionDetails/calculateReceivedAmount are no longer called by main logic) ---
    async _getConnectedClient() {
        for (const clientEntry of this.clients.values()) { if (clientEntry.client?.status === 1) return clientEntry.client; }
        await new Promise(resolve => setTimeout(resolve, 100));
        for (const clientEntry of this.clients.values()) { if (clientEntry.client?.status === 1) return clientEntry.client; }
        throw new Error('SPV: No connected Electrum clients available.');
    }
    async fetchBlockchainTransactions(bchAddress) { // Only needs txid/height for SPV logic now
        logger.debug(`SPV: [Helper] Fetching history for ${bchAddress}...`);
        const scriptPubKeyHex = addressToScriptPubKey(bchAddress); const scriptHash = scriptPubKeyToScriptHash(scriptPubKeyHex);
        try {
            const client = await this._getConnectedClient();
            const history = await withTimeout( client.request('blockchain.scripthash.get_history', [scriptHash]), REQUEST_TIMEOUT_MS * 2, `History timeout ${bchAddress}` );
            return (history || []).map(tx => ({ txid: tx.tx_hash, blockHeight: tx.height || 0 }));
        } catch (error) { logger.error(`SPV: [Helper] Failed fetching history for ${bchAddress}: ${error.message}`); throw error; }
    }
    // These helpers are now effectively unused by the main reconciliation flow, but kept for potential other uses or reference
    async fetchTransactionDetails(txid) {
        logger.debug(`SPV: [Helper] Fetching details for txid ${txid}...`);
        try {
            const client = await this._getConnectedClient();
            const transaction = await withTimeout( client.request('blockchain.transaction.get', [txid, true]), REQUEST_TIMEOUT_MS * 2, `Tx details timeout ${txid}` );
            if (!transaction || typeof transaction !== 'object' || !transaction.vout) throw new Error(`Invalid verbose tx data for ${txid}`);
            return transaction;
        } catch (error) { logger.error(`SPV: [Helper] Failed fetching details for ${txid}: ${error.message}`); throw error; }
    }
    calculateReceivedAmount(transactionDetails, bchAddress) {
        let receivedSatoshis = 0; if (!transactionDetails?.vout) return 0;
        for (const output of transactionDetails.vout) {
            if (output.scriptPubKey?.addresses?.includes(bchAddress)) {
                const valueSat = output.valueSat ?? Math.round((output.value || 0) * SATOSHIS_PER_BCH);
                if (valueSat > 0) receivedSatoshis += valueSat;
            }
        }
        return receivedSatoshis;
    }

    // --- Service Lifecycle (Unchanged) ---
    async start() {
        if (this.isRunning) return;
        logger.info('SPV: Starting service...');
        this.isRunning = true;
        this.cacheCleanupTimer = setInterval(() => this.cleanupStatusCache(), CACHE_CLEANUP_INTERVAL_MS);
        this.periodicRetryTimer = setInterval(() => this.retryFailedPrimaries(), PERIODIC_RETRY_INTERVAL_MS);
        logger.info(`SPV: Initial connections to ${this.primaryServerConfigs.length} primary servers...`);
        const initialConnectionPromises = this.primaryServerConfigs.map(config => this.connectToServer(config, false));
        await Promise.allSettled(initialConnectionPromises);
        logger.info("SPV: Initial connection attempts settled.");
        this.tryConnectFallback();
        try {
            logger.debug('SPV: Fetching initial users for monitoring...');
            const usersToMonitor = await User.find({ bchAddress: { $exists: true, $ne: null, $ne: '' } }).select('_id bchAddress').lean();
            logger.info(`SPV: [Initial Load] Found ${usersToMonitor.length} users.`);
            for (const user of usersToMonitor) { await this.addSubscription(user._id.toString(), user.bchAddress); }
            logger.info(`SPV: [Initial Load] Finished adding initial subscriptions. Monitoring ${this.subscriptions.size} addresses.`);
        } catch (error) { logger.error(`SPV: [Initial Load Error] Failed fetching users: ${error.message}`); }
     }
    async stop() {
         logger.info("SPV: Stopping service..."); this.isRunning = false;
         if (this.cacheCleanupTimer) clearInterval(this.cacheCleanupTimer); if (this.periodicRetryTimer) clearInterval(this.periodicRetryTimer);
         this.processedTxCache.clear(); this.failedPrimaryServers.clear(); this.processingLocks.clear(); // Clear locks on stop
         this.reconnectTimers.forEach(timer => clearTimeout(timer)); this.reconnectTimers.clear();
         logger.info(`SPV: Closing ${this.clients.size} connections...`);
         const closePromises = []; this.clients.forEach(entry => { if (entry.client) closePromises.push(entry.client.close().catch(e => logger.error(`SPV: Error closing client: ${e.message}`))); });
         await Promise.allSettled(closePromises);
         this.clients.clear(); this.subscriptions.clear();
         logger.info("SPV: Service stopped.");
     }

} // End Class SpvMonitorService

// --- Export Singleton Instance ---
const spvMonitorServiceInstance = new SpvMonitorService();

module.exports = {
    start: () => spvMonitorServiceInstance.start(),
    stop: () => spvMonitorServiceInstance.stop(),
    addSubscription: (userId, bchAddress) => spvMonitorServiceInstance.addSubscription(userId, bchAddress),
    setIoServer: (ioInstance) => spvMonitorServiceInstance.setIoServer(ioInstance)
};
