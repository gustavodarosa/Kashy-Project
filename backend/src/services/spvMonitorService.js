// z:\Kashy-Project\backend\src\services\spvMonitorService.js
const ElectrumClient = require('electrum-client');
const cashaddr = require('cashaddrjs');
const crypto = require('crypto');
const User = require('../models/user'); // Needed for initial load
const { FULCRUM_SERVERS } = require('../config/fullcrumConfig');
const logger = require('../utils/logger');
// --- MODIFICATION: Remove direct bchService dependency for history/balance ---
// const bchService = require('./bchService');
// --- MODIFICATION: Add walletService dependency ---
// --- MODIFICATION: Import WalletService CLASS ---
const WalletService = require('./walletService'); // Use the class for processing
const cache = require('./cacheService');
const { withTimeout } = require('../utils/asyncUtils');

// --- Configuration (Keep as is) ---
const RECONNECT_DELAY_MS = 10000;
const PERIODIC_RETRY_INTERVAL_MS = 5 * 60 * 1000;
const ELECTRUM_PROTOCOL_VERSION = '1.4';
const CONNECTION_TIMEOUT_MS = 10000;
const REQUEST_TIMEOUT_MS = 15000;
const TARGET_CONNECTIONS = 4;
const STATUS_CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const SATOSHIS_PER_BCH = 1e8; // Keep for potential use, though walletService handles it now

// --- Utilities (Keep as is) ---
function addressToScriptPubKeyBuffer(address) { /* ... */
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
function scriptPubKeyBufferToScriptHash(scriptPubKeyBuffer) { /* ... */
    const hash = crypto.createHash('sha256').update(scriptPubKeyBuffer).digest();
    return Buffer.from(hash.reverse()).toString('hex');
}
// --- End Utilities ---

class SpvMonitorService {
    constructor() {
        this.clients = new Map(); // Map<serverId, { client, config, connecting, subscriptions: Set<scriptHash> }>
        this.subscriptions = new Map(); // Map<scriptHash, { userId, bchAddress }>
        this.rankedServers = FULCRUM_SERVERS;
        this.desiredConnectionCount = TARGET_CONNECTIONS;
        this.primaryServerConfigs = this.rankedServers.slice(0, this.desiredConnectionCount);
        this.failedPrimaryServers = new Set();
        this.reconnectTimers = new Map();
        this.periodicRetryTimer = null;
        this.isRunning = false;
        this.io = null;
        this.processedStatusCache = new Map();
        this.cacheCleanupTimer = null;
        this.processingLocks = new Set();

        // --- BIND METHODS (Keep as is) ---
        this.connectToServer = this.connectToServer.bind(this);
        this._handleClientClose = this._handleClientClose.bind(this);
        this.scheduleReconnect = this.scheduleReconnect.bind(this);
        this.tryConnectFallback = this.tryConnectFallback.bind(this);
        this.retryFailedPrimaries = this.retryFailedPrimaries.bind(this);
        this.addSubscription = this.addSubscription.bind(this);
        this.performSubscription = this.performSubscription.bind(this);
        this.resubscribeClient = this.resubscribeClient.bind(this);
        this.removeSubscription = this.removeSubscription.bind(this);
        this.handleSubscriptionUpdate = this.handleSubscriptionUpdate.bind(this);
        this.processAndNotifyWithHistory = this.processAndNotifyWithHistory.bind(this);
        this.attachListenersToClient = this.attachListenersToClient.bind(this);
        this.start = this.start.bind(this);
        this.stop = this.stop.bind(this);
        this.cleanupStatusCache = this.cleanupStatusCache.bind(this);
        this.isStatusRecentlyProcessed = this.isStatusRecentlyProcessed.bind(this);
        // --- END BIND METHODS ---

        logger.info(`SPV: Initialized. Target connections: ${this.desiredConnectionCount}. Primary servers configured: ${this.primaryServerConfigs.length}`);
    }

    setIoServer(ioInstance) {
        this.io = ioInstance;
        logger.info('SPV: Socket.IO server instance received.');
    }

    // --- Connection Management (Keep as is) ---
    async connectToServer(serverConfig, isPeriodicRetry = false) { /* ... */
        const serverId = `${serverConfig.host}:${serverConfig.port}`;
        const existingEntry = this.clients.get(serverId);

        if (existingEntry && (existingEntry.client?.status === 1 || existingEntry.connecting)) {
             if (isPeriodicRetry && this.failedPrimaryServers.has(serverId)) { this.failedPrimaryServers.delete(serverId); }
             return;
        }
        logger.debug(`SPV: Attempting connection to ${serverId}...${isPeriodicRetry ? ' (Periodic Retry)' : ''}`);
        this.clients.set(serverId, { client: null, config: serverConfig, connecting: true, subscriptions: new Set() });
        const immediateTimer = this.reconnectTimers.get(serverId);
        if (immediateTimer) { clearTimeout(immediateTimer); this.reconnectTimers.delete(serverId); }
        let client;
        try {
            client = new ElectrumClient(serverConfig.port, serverConfig.host, serverConfig.protocol);
            client.onClose = () => this._handleClientClose(serverId, serverConfig);
            await withTimeout(client.connect('kashy-spv-monitor', ELECTRUM_PROTOCOL_VERSION), CONNECTION_TIMEOUT_MS, `Connection timeout to ${serverId}`);
            await withTimeout(client.server_version('kashy-spv-monitor', ELECTRUM_PROTOCOL_VERSION), REQUEST_TIMEOUT_MS, `Server version timeout for ${serverId}`);
            logger.info(`SPV: ✅ Successfully connected to ${serverId}.`);
            const clientEntry = this.clients.get(serverId);
            if (clientEntry) { clientEntry.client = client; clientEntry.connecting = false; }
            else { this.clients.set(serverId, { client, config: serverConfig, connecting: false, subscriptions: new Set() }); }
            if (this.failedPrimaryServers.has(serverId)) { this.failedPrimaryServers.delete(serverId); }
            this.attachListenersToClient(client, serverId);
            await this.resubscribeClient(client, serverId);
        } catch (error) {
            logger.error(`SPV: 😓 Failed connection to ${serverId}: ${error.message}`);
            const clientEntry = this.clients.get(serverId);
            if(clientEntry) { clientEntry.connecting = false; clientEntry.client = null; }
            if (client) { try { await client.close(); } catch (e) { /* Ignore close error */ } }
            if (!isPeriodicRetry) { this.scheduleReconnect(serverId, serverConfig); }
            if (this.primaryServerConfigs.some(cfg => `${cfg.host}:${cfg.port}` === serverId)) { this.failedPrimaryServers.add(serverId); }
            this.tryConnectFallback();
        }
    }
    _handleClientClose(serverId, serverConfig) { /* ... */
        logger.error(`SPV: ❌ Disconnected from ${serverId}.`);
        const clientEntry = this.clients.get(serverId);
        if (clientEntry) { clientEntry.client = null; clientEntry.connecting = false; clientEntry.subscriptions.clear(); }
        const isPrimary = this.primaryServerConfigs.some(cfg => `${cfg.host}:${cfg.port}` === serverId);
        if (isPrimary) { this.failedPrimaryServers.add(serverId); }
        if (this.isRunning && clientEntry) { this.scheduleReconnect(serverId, serverConfig); }
        this.tryConnectFallback();
    }
    scheduleReconnect(serverId, serverConfig) { /* ... */
        const existingEntry = this.clients.get(serverId);
        if (existingEntry && !existingEntry.client && !existingEntry.connecting && !this.reconnectTimers.has(serverId)) {
            logger.debug(`SPV: Scheduling reconnect attempt for ${serverId} in ${RECONNECT_DELAY_MS / 1000}s...`);
            const timer = setTimeout(async () => {
                this.reconnectTimers.delete(serverId);
                if (this.isRunning) {
                     const currentEntry = this.clients.get(serverId);
                     if (currentEntry && !currentEntry.client && !currentEntry.connecting) { await this.connectToServer(serverConfig, false); }
                }
            }, RECONNECT_DELAY_MS);
            this.reconnectTimers.set(serverId, timer);
        }
    }
    tryConnectFallback() { /* ... */
        if (!this.isRunning) return;
        const connectedCount = Array.from(this.clients.values()).filter(e => e.client?.status === 1).length;
        if (connectedCount >= this.desiredConnectionCount) { return; }
        logger.debug(`SPV: Below target connections (${connectedCount}/${this.desiredConnectionCount}). Checking fallback...`);
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
    retryFailedPrimaries() { /* ... */
        if (!this.isRunning || this.failedPrimaryServers.size === 0) return;
        logger.debug(`SPV: [Periodic Retry] Checking ${this.failedPrimaryServers.size} failed primary servers...`);
        this.failedPrimaryServers.forEach(serverId => {
            const serverConfig = this.primaryServerConfigs.find(cfg => `${cfg.host}:${cfg.port}` === serverId);
            if (serverConfig) {
                const existingEntry = this.clients.get(serverId);
                 if (!existingEntry || (!existingEntry.client && !existingEntry.connecting)) {
                     logger.debug(`SPV: [Periodic Retry] Attempting to reconnect primary ${serverId}.`);
                     this.connectToServer(serverConfig, true);
                 } else if (existingEntry.client) { this.failedPrimaryServers.delete(serverId); }
            } else { this.failedPrimaryServers.delete(serverId); }
        });
    }

    // --- Subscription Management (Keep as is) ---
    async addSubscription(userId, bchAddress) { /* ... */
        if (!userId || !bchAddress) { logger.warn('SPV: Missing userId or bchAddress for subscription.'); return; }
        try {
            const scriptPubKeyBuffer = addressToScriptPubKeyBuffer(bchAddress);
            const scriptHash = scriptPubKeyBufferToScriptHash(scriptPubKeyBuffer);
            this.subscriptions.set(scriptHash, { userId, bchAddress });
            logger.debug(`SPV: [Sub Added/Updated] Monitoring User: ${userId}, Addr: ${bchAddress}, SH: ${scriptHash}`);
            const subPromises = []; const serversAttempted = [];
            for (const [serverId, clientEntry] of this.clients.entries()) {
                if (clientEntry.client?.status === 1) {
                    if (!clientEntry.subscriptions.has(scriptHash)) {
                        serversAttempted.push(serverId);
                        subPromises.push(this.performSubscription(clientEntry.client, serverId, scriptHash));
                    } else { /* ... skip already subscribed ... */ }
                }
            }
            const results = await Promise.allSettled(subPromises);
            const successfulCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
            if (serversAttempted.length > 0) { logger.debug(`SPV: Subscription attempts for SH ${scriptHash} (Addr: ${bchAddress}). Attempted: ${serversAttempted.length}, Successful: ${successfulCount}.`); }
            else { logger.debug(`SPV: No active clients to send subscription for SH ${scriptHash} (Addr: ${bchAddress}).`); }
        } catch (error) { logger.error(`SPV: Failed subscription process for User ${userId}, Addr ${bchAddress}: ${error.message}`); }
    }
    async performSubscription(client, serverId, scriptHash) { /* ... */
        const clientEntry = this.clients.get(serverId);
        if (!clientEntry || !clientEntry.client || clientEntry.client.status !== 1) { return false; }
        if (clientEntry.subscriptions.has(scriptHash)) { return true; }
        try {
            logger.debug(`SPV: Sending subscribe for ${scriptHash} to ${serverId}...`);
            const initialStatus = await withTimeout(client.request('blockchain.scripthash.subscribe', [scriptHash]), REQUEST_TIMEOUT_MS, `Subscribe timeout ${scriptHash} on ${serverId}`);
            logger.debug(`SPV: Subscribe OK for ${scriptHash} on ${serverId}. Initial Status: ${initialStatus}`);
            clientEntry.subscriptions.add(scriptHash);
            if (initialStatus !== null) { logger.debug(`SPV: Initial status for ${scriptHash} on ${serverId} was ${initialStatus}. Will wait for next update.`); }
            return true;
        } catch (error) { logger.error(`SPV: [Sub FAIL] ${serverId} to ${scriptHash}: ${error.message}`); return false; }
    }
    async resubscribeClient(client, serverId) { /* ... */
        logger.debug(`SPV: Resubscribing all (${this.subscriptions.size}) addresses to ${serverId}...`);
        const clientEntry = this.clients.get(serverId);
        if (!clientEntry) { logger.error(`SPV: Cannot resubscribe, client entry for ${serverId} not found.`); return; }
        clientEntry.subscriptions.clear();
        const resubPromises = []; const addressesAttempted = [];
        for (const scriptHash of this.subscriptions.keys()) {
            if (client?.status === 1) { addressesAttempted.push(scriptHash); resubPromises.push(this.performSubscription(client, serverId, scriptHash)); }
            else { logger.warn(`SPV: [Resub Skip] Client ${serverId} disconnected during resubscribe loop for ${scriptHash}.`); break; }
        }
        const results = await Promise.allSettled(resubPromises);
        const successfulCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
        if (addressesAttempted.length > 0) { logger.debug(`SPV: Resubscription to ${serverId} complete. Attempted: ${addressesAttempted.length}, Successful: ${successfulCount}.`); }
        else { logger.debug(`SPV: No addresses to resubscribe for client ${serverId}.`); }
    }
    async removeSubscription(userId, bchAddress) { /* ... */
        if (!userId || !bchAddress) { logger.warn('SPV: Missing userId or bchAddress for unsubscription.'); return; }
        try {
            const scriptPubKeyBuffer = addressToScriptPubKeyBuffer(bchAddress);
            const scriptHash = scriptPubKeyBufferToScriptHash(scriptPubKeyBuffer);
            let stillNeeded = false;
            for (const [sh, info] of this.subscriptions.entries()) {
                if (sh === scriptHash && info.userId.toString() !== userId.toString()) { stillNeeded = true; break; }
            }
            if (this.subscriptions.has(scriptHash) && !stillNeeded) {
                logger.info(`SPV: [Sub Removed] No longer monitoring User: ${userId}, Addr: ${bchAddress}, SH: ${scriptHash}`);
                this.subscriptions.delete(scriptHash);
                for (const clientEntry of this.clients.values()) { clientEntry.subscriptions.delete(scriptHash); }
            } else if (stillNeeded) { /* ... log kept ... */ }
            else { /* ... log not found ... */ }
        } catch (error) { logger.error(`SPV: Failed unsubscription process for User ${userId}, Addr ${bchAddress}: ${error.message}`); }
    }

    // --- Update Handling & Notification ---

    isStatusRecentlyProcessed(status) { /* ... */
        const lastProcessed = this.processedStatusCache.get(status);
        return lastProcessed && (Date.now() - lastProcessed < STATUS_CACHE_TTL_MS);
    }
    cleanupStatusCache() { /* ... */
        const now = Date.now(); let cleanedCount = 0;
        for (const [status, timestamp] of this.processedStatusCache.entries()) {
            if (now - timestamp > STATUS_CACHE_TTL_MS) { this.processedStatusCache.delete(status); cleanedCount++; }
        }
        if (cleanedCount > 0) logger.debug(`SPV: [Cache Cleanup] Removed ${cleanedCount} expired status entries.`);
    }
    attachListenersToClient(client, serverId) { /* ... */
        client.subscribe.removeAllListeners('blockchain.scripthash.subscribe');
        client.subscribe.on('blockchain.scripthash.subscribe', (params) => {
            const scriptHash = params[0]; const status = params[1];
            logger.debug(`SPV: <<< Update Received <<< Server: ${serverId}, SH: ${scriptHash}, Status: ${status}`);
            if (scriptHash && status !== null) { this.handleSubscriptionUpdate(scriptHash, status, serverId); }
        });
        logger.debug(`SPV: Attached listeners to ${serverId}.`);
    }

    // --- MODIFIED: handleSubscriptionUpdate (Updates DB status via walletService.syncTransactions) ---
    async handleSubscriptionUpdate(scriptHash, electrumStatusHash, serverId) {
        logger.debug(`SPV: [Update Handling] Received status update for SH: ${scriptHash}, Status: ${electrumStatusHash}, From: ${serverId}`);

        // 1. Check if status was recently processed
        if (this.isStatusRecentlyProcessed(electrumStatusHash)) {
            logger.debug(`SPV: [Cache Hit] Status ${electrumStatusHash} recently processed. Skipping.`);
            return;
        }

        // 2. Check for processing lock
        if (this.processingLocks.has(scriptHash)) {
            logger.debug(`SPV: [Lock Hit] Processing already in progress for SH: ${scriptHash}. Skipping.`);
            return;
        }

        // 3. Identify the user
        const subInfo = this.subscriptions.get(scriptHash);
        if (!subInfo) {
            logger.warn(`SPV: [Update Warning] Received update for untracked SH: ${scriptHash}. Ignoring.`);
            return;
        }
        logger.debug(`SPV: [Update Identified] Update is for User: ${subInfo.userId}, Addr: ${subInfo.bchAddress}`);

        try {
             this.processingLocks.add(scriptHash);
             logger.debug(`SPV: [Lock Acquired] Processing update for SH: ${scriptHash}`);

             // --- >>> INVALIDATE CACHE <<< ---
             logger.info(`SPV: [Cache Invalidate Trigger] Invalidating cache for User ${subInfo.userId} due to SPV update.`);
             cache.invalidateUserWalletCache(subInfo.userId);
             cache.invalidateBlockHeightCache();
             // Invalidate block height specifically as confirmations depend on it
             cache.del('blockHeight');
             // --- >>> END INVALIDATION <<< ---

             // --- >>> ADDED: Trigger WalletService Sync <<< ---
             // Instantiate WalletService for the specific user and trigger sync
             const walletServiceInstance = new WalletService(subInfo.userId);
             await walletServiceInstance.syncTransactions(); // This now updates the DB status
             // --- >>> END ADDED <<< ---

             // Call the notification logic (which now uses walletService)
             await this.processAndNotifyWithHistory(subInfo.userId, subInfo.bchAddress, scriptHash, electrumStatusHash);

             // Mark this status hash as processed AFTER successful processing & notification
             this.processedStatusCache.set(electrumStatusHash, Date.now());
             logger.debug(`SPV: [Cache Set] Added status ${electrumStatusHash} to processed cache.`);

        } catch (error) {
             logger.error(`SPV: [Update Error] Error during notification processing for SH ${scriptHash} (Status: ${electrumStatusHash}): ${error.message}`);
             // Do NOT cache status if processing failed, allow retry on next update
        } finally {
             this.processingLocks.delete(scriptHash);
             logger.debug(`SPV: [Lock Released] Released processing lock for SH: ${scriptHash}`);
        }
    }
    // --- END MODIFIED handleSubscriptionUpdate ---

    // --- MODIFIED: processAndNotifyWithHistory (Uses walletService) ---
    async processAndNotifyWithHistory(userId, bchAddress, scriptHash, electrumStatusHash) {
        logger.debug(`SPV: [Process/Notify Full] User: ${userId}, Addr: ${bchAddress}`);

        let fetchedBalanceData;
        let fetchedTransactionsResult; // Renamed to avoid conflict

        try {
            // Instantiate WalletService for the user
            // Note: This instance is separate from the one used for sync in handleSubscriptionUpdate,
            // but it will read the data updated by that sync.
            const walletServiceInstance = new WalletService(userId);

            // 1. Fetch Current Live Balance using walletService
            try {
                // Ensure cache is bypassed by invalidation done in handleSubscriptionUpdate
                fetchedBalanceData = await walletServiceInstance.getWalletBalance();
                logger.debug(`SPV: Fetched balance via walletService: User=${userId}, TotalBCH=${fetchedBalanceData.totalBCH}`);
            } catch (balanceError) {
                logger.error(`SPV: Failed getting balance via walletService (User: ${userId}): ${balanceError.message}`);
                throw balanceError; // Throw to prevent caching status if balance fails
            }

            // 2. Fetch Processed Transaction History using walletService
            try {
                // Ensure cache is bypassed by invalidation done in handleSubscriptionUpdate
                // Fetch page 1, limit 20 for the notification payload
                fetchedTransactionsResult = await walletServiceInstance.getWalletTransactions(1, 20);
                // --- FIX: Log the length of the transactions array ---
                logger.debug(`SPV: Fetched ${fetchedTransactionsResult?.transactions?.length ?? 'undefined'} processed transactions (page 1) via walletService. Total count: ${fetchedTransactionsResult?.totalCount}`);
            } catch (historyError) {
                logger.error(`SPV: Failed getting history via walletService (User: ${userId}): ${historyError.message}`);
                throw historyError; // Throw error, prevent caching status if history fails
            }

            // 3. Emit WebSocket Notification
            if (this.io) {
                // --- MODIFICATION: Construct payload from walletService data ---
                const payload = {
                    balance: fetchedBalanceData, // Use the structure returned by getWalletBalance
                    // Use the transactions array from the result object
                    transactions: fetchedTransactionsResult?.transactions || [],
                };
                // --- END MODIFICATION ---

                const eventName = 'walletDataUpdate';
                logger.debug(`SPV: Emitting '${eventName}' to user room: ${userId}`);
                this.io.to(userId.toString()).emit(eventName, payload);
                logger.info(`SPV: ✅ Wallet data update sent for User: ${userId}, Addr: ${bchAddress}`);
            } else {
                logger.error("SPV: Socket.IO instance not set. Cannot emit update.");
                throw new Error("Socket.IO instance not available for notification.");
            }

        } catch (error) {
            logger.error(`SPV: Failed to process and notify full update for User ${userId} (${bchAddress}): ${error.message}`);
            throw error; // Re-throw
        }
    }
    // --- END MODIFIED processAndNotifyWithHistory ---

    // --- Service Lifecycle (Keep as is) ---
    async start() { /* ... */
        if (this.isRunning) return;
        logger.info('SPV: Starting service...');
        this.isRunning = true;
        this.cacheCleanupTimer = setInterval(() => this.cleanupStatusCache(), CACHE_CLEANUP_INTERVAL_MS);
        this.periodicRetryTimer = setInterval(() => this.retryFailedPrimaries(), PERIODIC_RETRY_INTERVAL_MS);
        logger.debug(`SPV: Initial connections to ${this.primaryServerConfigs.length} primary servers...`);
        const initialConnectionPromises = this.primaryServerConfigs.map(config => this.connectToServer(config, false));
        await Promise.allSettled(initialConnectionPromises);
        logger.debug("SPV: Initial primary connection attempts settled.");
        this.tryConnectFallback();
        try {
            logger.debug('SPV: Fetching initial users for monitoring...');
            const usersToMonitor = await User.find({ bchAddress: { $exists: true, $ne: null, $ne: '' } }).select('_id bchAddress').lean();
            logger.debug(`SPV: [Initial Load] Found ${usersToMonitor.length} users with addresses.`);
            for (const user of usersToMonitor) { await this.addSubscription(user._id.toString(), user.bchAddress); }
            logger.info(`SPV: [Initial Load] Finished adding initial subscriptions. Monitoring ${this.subscriptions.size} unique addresses.`);
        } catch (error) { logger.error(`SPV: [Initial Load Error] Failed fetching or subscribing users: ${error.message}`); }
    }
    async stop() { /* ... */
         logger.info("SPV: Stopping service...");
         this.isRunning = false;
         if (this.cacheCleanupTimer) clearInterval(this.cacheCleanupTimer);
         if (this.periodicRetryTimer) clearInterval(this.periodicRetryTimer);
         this.reconnectTimers.forEach(timer => clearTimeout(timer));
         this.processedStatusCache.clear();
         this.failedPrimaryServers.clear();
         this.processingLocks.clear();
         this.reconnectTimers.clear();
         logger.info(`SPV: Closing ${this.clients.size} active connections...`);
         const closePromises = [];
         this.clients.forEach(entry => {
             if (entry.client) { entry.client.onClose = () => {}; closePromises.push(entry.client.close().catch(e => logger.error(`SPV: Error closing client ${entry.config?.host}:${entry.config?.port}: ${e.message}`))); }
         });
         await Promise.allSettled(closePromises);
         this.clients.clear();
         this.subscriptions.clear();
         logger.info("SPV: Service stopped.");
     }

} // End Class SpvMonitorService

// --- Export Singleton Instance ---
const spvMonitorServiceInstance = new SpvMonitorService();

// --- Exports ---
module.exports = spvMonitorServiceInstance;
