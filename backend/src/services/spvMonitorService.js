// z:\Kashy-Project\backend\src\services\spvMonitorService.js
const ElectrumClient = require('electrum-client');
const cashaddr = require('cashaddrjs');
const crypto = require('crypto');
const User = require('../models/user'); // Needed for initial load
const { FULCRUM_SERVERS } = require('../config/fullcrumConfig');
const logger = require('../utils/logger');
const bchService = require('./bchService'); // Needed for getBalance and getTransactionHistoryFromElectrum
const { withTimeout } = require('../utils/asyncUtils'); // Only need withTimeout

// --- Configuration ---
const RECONNECT_DELAY_MS = 10000;
const PERIODIC_RETRY_INTERVAL_MS = 5 * 60 * 1000; // Check failed primaries periodically
const ELECTRUM_PROTOCOL_VERSION = '1.4';
const CONNECTION_TIMEOUT_MS = 10000;
const REQUEST_TIMEOUT_MS = 15000; // Timeout for subscribe requests
const TARGET_CONNECTIONS = 4; // Target number of active connections
const STATUS_CACHE_TTL_MS = 5 * 60 * 1000; // Cache duration for status hash to prevent rapid re-processing
const CACHE_CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // How often to clean the status cache
const SATOSHIS_PER_BCH = 1e8;
const FETCH_DELAY_AFTER_SPV_MS = 2500; // <<< Delay in milliseconds before fetching data after SPV notification

// --- Utilities ---
function addressToScriptPubKeyBuffer(address) {
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

function scriptPubKeyBufferToScriptHash(scriptPubKeyBuffer) {
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
        // Select primary servers based on rank
        this.primaryServerConfigs = this.rankedServers.slice(0, this.desiredConnectionCount);
        this.failedPrimaryServers = new Set(); // Track primary servers that failed connection/disconnected
        this.reconnectTimers = new Map(); // Map<serverId, NodeJS.Timeout>
        this.periodicRetryTimer = null;
        this.isRunning = false;
        this.io = null; // <<< CORRECTLY INITIALIZED HERE
        this.processedStatusCache = new Map(); // Map<statusHash, timestamp> - Prevent re-processing the same status update
        this.cacheCleanupTimer = null;
        this.processingLocks = new Set(); // Set<scriptHash> - Prevent concurrent processing for the same address

        // --- BIND METHODS TO ENSURE CORRECT 'this' CONTEXT ---
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

    // <<< CORRECTLY IMPLEMENTED METHOD >>>
    setIoServer(ioInstance) {
        this.io = ioInstance;
        logger.info('SPV: Socket.IO server instance received.');
    }

    // --- Connection Management ---
    async connectToServer(serverConfig, isPeriodicRetry = false) {
        const serverId = `${serverConfig.host}:${serverConfig.port}`;
        const existingEntry = this.clients.get(serverId);

        if (existingEntry && (existingEntry.client?.status === 1 || existingEntry.connecting)) {
             if (isPeriodicRetry && this.failedPrimaryServers.has(serverId)) {
                 this.failedPrimaryServers.delete(serverId);
             }
             return;
        }

        logger.debug(`SPV: Attempting connection to ${serverId}...${isPeriodicRetry ? ' (Periodic Retry)' : ''}`);
        this.clients.set(serverId, {
            client: null, config: serverConfig, connecting: true, subscriptions: new Set()
        });

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
            logger.error(`SPV: 😓 Failed connection to ${serverId}: ${error.message}`);
            const clientEntry = this.clients.get(serverId);
            if(clientEntry) { clientEntry.connecting = false; clientEntry.client = null; }

            if (client) { try { await client.close(); } catch (e) { /* Ignore close error */ } }

            if (!isPeriodicRetry) { this.scheduleReconnect(serverId, serverConfig); }
            if (this.primaryServerConfigs.some(cfg => `${cfg.host}:${cfg.port}` === serverId)) {
                 this.failedPrimaryServers.add(serverId);
            }
            this.tryConnectFallback();
        }
    }

    _handleClientClose(serverId, serverConfig) {
        logger.error(`SPV: ❌ Disconnected from ${serverId}.`);
        const clientEntry = this.clients.get(serverId);
        if (clientEntry) {
            clientEntry.client = null; clientEntry.connecting = false;
            clientEntry.subscriptions.clear();
        }
        const isPrimary = this.primaryServerConfigs.some(cfg => `${cfg.host}:${cfg.port}` === serverId);
        if (isPrimary) { this.failedPrimaryServers.add(serverId); }
        if (this.isRunning && clientEntry) { this.scheduleReconnect(serverId, serverConfig); }
        this.tryConnectFallback();
    }

    scheduleReconnect(serverId, serverConfig) {
        const existingEntry = this.clients.get(serverId);
        if (existingEntry && !existingEntry.client && !existingEntry.connecting && !this.reconnectTimers.has(serverId)) {
            logger.debug(`SPV: Scheduling reconnect attempt for ${serverId} in ${RECONNECT_DELAY_MS / 1000}s...`);
            const timer = setTimeout(async () => {
                this.reconnectTimers.delete(serverId);
                if (this.isRunning) {
                     const currentEntry = this.clients.get(serverId);
                     if (currentEntry && !currentEntry.client && !currentEntry.connecting) {
                         await this.connectToServer(serverConfig, false);
                     }
                }
            }, RECONNECT_DELAY_MS);
            this.reconnectTimers.set(serverId, timer);
        }
     }

    tryConnectFallback() {
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

    retryFailedPrimaries() {
        if (!this.isRunning || this.failedPrimaryServers.size === 0) return;
        logger.debug(`SPV: [Periodic Retry] Checking ${this.failedPrimaryServers.size} failed primary servers...`);
        this.failedPrimaryServers.forEach(serverId => {
            const serverConfig = this.primaryServerConfigs.find(cfg => `${cfg.host}:${cfg.port}` === serverId);
            if (serverConfig) {
                const existingEntry = this.clients.get(serverId);
                 if (!existingEntry || (!existingEntry.client && !existingEntry.connecting)) {
                     logger.debug(`SPV: [Periodic Retry] Attempting to reconnect primary ${serverId}.`);
                     this.connectToServer(serverConfig, true);
                 } else if (existingEntry.client) {
                     this.failedPrimaryServers.delete(serverId);
                 }
            } else {
                this.failedPrimaryServers.delete(serverId);
            }
        });
    }

    // --- Subscription Management ---
    async addSubscription(userId, bchAddress) {
        if (!userId || !bchAddress) { logger.warn('SPV: Missing userId or bchAddress for subscription.'); return; }
        try {
            const scriptPubKeyBuffer = addressToScriptPubKeyBuffer(bchAddress);
            const scriptHash = scriptPubKeyBufferToScriptHash(scriptPubKeyBuffer);
            this.subscriptions.set(scriptHash, { userId, bchAddress });
            logger.debug(`SPV: [Sub Added/Updated] Monitoring User: ${userId}, Addr: ${bchAddress}, SH: ${scriptHash}`);

            const subPromises = [];
            const serversAttempted = [];
            for (const [serverId, clientEntry] of this.clients.entries()) {
                if (clientEntry.client?.status === 1) {
                    if (!clientEntry.subscriptions.has(scriptHash)) {
                        serversAttempted.push(serverId);
                        subPromises.push(this.performSubscription(clientEntry.client, serverId, scriptHash));
                    } else {
                        logger.debug(`SPV: Server ${serverId} already subscribed to ${scriptHash}. Skipping.`);
                    }
                }
            }
            const results = await Promise.allSettled(subPromises);
            const successfulCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
            if (serversAttempted.length > 0) {
                logger.debug(`SPV: Subscription attempts for SH ${scriptHash} (Addr: ${bchAddress}). Attempted: ${serversAttempted.length}, Successful: ${successfulCount}.`);
            } else {
                 logger.debug(`SPV: No active clients to send subscription for SH ${scriptHash} (Addr: ${bchAddress}).`);
            }
        } catch (error) {
            logger.error(`SPV: Failed subscription process for User ${userId}, Addr ${bchAddress}: ${error.message}`);
        }
    }

    async performSubscription(client, serverId, scriptHash) {
        const clientEntry = this.clients.get(serverId);
        if (!clientEntry || !clientEntry.client || clientEntry.client.status !== 1) {
             logger.warn(`SPV: [Sub Skip] Client ${serverId} invalid or disconnected during performSubscription for ${scriptHash}.`);
             return false;
        }
        if (clientEntry.subscriptions.has(scriptHash)) {
            logger.debug(`SPV: [Sub Skip] Client ${serverId} already has subscription for ${scriptHash}.`);
            return true;
        }
        try {
            logger.debug(`SPV: Sending subscribe for ${scriptHash} to ${serverId}...`);
            const initialStatus = await withTimeout(
                client.request('blockchain.scripthash.subscribe', [scriptHash]),
                REQUEST_TIMEOUT_MS, `Subscribe timeout ${scriptHash} on ${serverId}`
            );
            logger.debug(`SPV: Subscribe OK for ${scriptHash} on ${serverId}. Initial Status: ${initialStatus}`);
            clientEntry.subscriptions.add(scriptHash);
            if (initialStatus !== null) {
                // Don't process initial status immediately, let regular updates handle it
                // setImmediate(() => this.handleSubscriptionUpdate(scriptHash, initialStatus, serverId));
                logger.debug(`SPV: Initial status for ${scriptHash} on ${serverId} was ${initialStatus}. Will wait for next update.`);
            }
            return true;
        } catch (error) {
            logger.error(`SPV: [Sub FAIL] ${serverId} to ${scriptHash}: ${error.message}`);
            return false;
        }
    }

    async resubscribeClient(client, serverId) {
        logger.debug(`SPV: Resubscribing all (${this.subscriptions.size}) addresses to ${serverId}...`);
        const clientEntry = this.clients.get(serverId);
        if (!clientEntry) { logger.error(`SPV: Cannot resubscribe, client entry for ${serverId} not found.`); return; }
        clientEntry.subscriptions.clear();

        const resubPromises = [];
        const addressesAttempted = [];
        for (const scriptHash of this.subscriptions.keys()) {
            if (client?.status === 1) {
                 addressesAttempted.push(scriptHash);
                 resubPromises.push(this.performSubscription(client, serverId, scriptHash));
            } else {
                 logger.warn(`SPV: [Resub Skip] Client ${serverId} disconnected during resubscribe loop for ${scriptHash}.`);
                 break;
            }
        }
        const results = await Promise.allSettled(resubPromises);
        const successfulCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
        if (addressesAttempted.length > 0) {
            logger.debug(`SPV: Resubscription to ${serverId} complete. Attempted: ${addressesAttempted.length}, Successful: ${successfulCount}.`);
        } else {
             logger.debug(`SPV: No addresses to resubscribe for client ${serverId}.`);
        }
    }

    async removeSubscription(userId, bchAddress) {
        if (!userId || !bchAddress) { logger.warn('SPV: Missing userId or bchAddress for unsubscription.'); return; }
        try {
            const scriptPubKeyBuffer = addressToScriptPubKeyBuffer(bchAddress);
            const scriptHash = scriptPubKeyBufferToScriptHash(scriptPubKeyBuffer);
            let stillNeeded = false;
            // Check if any *other* user is still subscribed to this same scriptHash
            for (const [sh, info] of this.subscriptions.entries()) {
                // Ensure comparison is done correctly (e.g., string IDs)
                if (sh === scriptHash && info.userId.toString() !== userId.toString()) {
                    stillNeeded = true;
                    logger.debug(`SPV: [Unsub Check] ScriptHash ${scriptHash} still needed by User: ${info.userId}`);
                    break;
                }
            }
            if (this.subscriptions.has(scriptHash) && !stillNeeded) {
                logger.info(`SPV: [Sub Removed] No longer monitoring User: ${userId}, Addr: ${bchAddress}, SH: ${scriptHash}`);
                this.subscriptions.delete(scriptHash);
                logger.debug(`SPV: Removing scriptHash ${scriptHash} from active client tracking sets.`);
                for (const clientEntry of this.clients.values()) {
                    clientEntry.subscriptions.delete(scriptHash);
                    // NOTE: Electrum doesn't have an "unsubscribe" command.
                    // We just stop tracking it locally. The server will keep sending updates
                    // until the connection drops, but we'll ignore them in handleSubscriptionUpdate.
                }
            } else if (stillNeeded) {
                 logger.debug(`SPV: [Sub Kept] ScriptHash ${scriptHash} (Addr: ${bchAddress}) still needed by others. Not removing central subscription.`);
            } else {
                 logger.debug(`SPV: [Unsub] ScriptHash ${scriptHash} (Addr: ${bchAddress}) not found in central map.`);
            }
        } catch (error) {
            logger.error(`SPV: Failed unsubscription process for User ${userId}, Addr ${bchAddress}: ${error.message}`);
        }
    }

    // --- Update Handling & Notification ---

    isStatusRecentlyProcessed(status) {
        const lastProcessed = this.processedStatusCache.get(status);
        return lastProcessed && (Date.now() - lastProcessed < STATUS_CACHE_TTL_MS);
    }

    cleanupStatusCache() {
        const now = Date.now(); let cleanedCount = 0;
        for (const [status, timestamp] of this.processedStatusCache.entries()) {
            if (now - timestamp > STATUS_CACHE_TTL_MS) {
                this.processedStatusCache.delete(status);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) logger.debug(`SPV: [Cache Cleanup] Removed ${cleanedCount} expired status entries.`);
    }

    attachListenersToClient(client, serverId) {
        client.subscribe.removeAllListeners('blockchain.scripthash.subscribe');
        client.subscribe.on('blockchain.scripthash.subscribe', (params) => {
            const scriptHash = params[0]; const status = params[1];
            logger.debug(`SPV: <<< Update Received <<< Server: ${serverId}, SH: ${scriptHash}, Status: ${status}`);
            if (scriptHash && status !== null) {
                this.handleSubscriptionUpdate(scriptHash, status, serverId);
            }
        });
        logger.debug(`SPV: Attached listeners to ${serverId}.`);
    }

    async handleSubscriptionUpdate(scriptHash, status, serverId) {
        logger.debug(`SPV: [Update Handling] Received status update for SH: ${scriptHash}, Status: ${status}, From: ${serverId}`);
        if (this.isStatusRecentlyProcessed(status)) {
            logger.debug(`SPV: [Cache Hit] Status ${status} recently processed. Skipping.`);
            return;
        }
        if (this.processingLocks.has(scriptHash)) {
            logger.debug(`SPV: [Lock Hit] Processing already in progress for SH: ${scriptHash}. Skipping.`);
            return;
        }
        const subInfo = this.subscriptions.get(scriptHash);
        if (!subInfo) {
            logger.warn(`SPV: [Update Warning] Received update for untracked SH: ${scriptHash}. Ignoring.`);
            return;
        }
        logger.debug(`SPV: [Update Identified] Update is for User: ${subInfo.userId}, Addr: ${subInfo.bchAddress}`);

        try {
             this.processingLocks.add(scriptHash);
             logger.debug(`SPV: [Lock Acquired] Processing update for SH: ${scriptHash}`);
             // Call the notification logic with history
             await this.processAndNotifyWithHistory(subInfo.userId, subInfo.bchAddress, scriptHash, status);
             this.processedStatusCache.set(status, Date.now());
             logger.debug(`SPV: [Cache Set] Added status ${status} to processed cache.`);
        } catch (error) {
             logger.error(`SPV: [Update Error] Error during notification processing for SH ${scriptHash} (Status: ${status}): ${error.message}`);
             // Do NOT cache status if processing failed, allow retry on next update
        } finally {
             this.processingLocks.delete(scriptHash);
             logger.debug(`SPV: [Lock Released] Released processing lock for SH: ${scriptHash}`);
        }
    }

    // --- MODIFIED: processAndNotifyWithHistory with Delay ---
    async processAndNotifyWithHistory(userId, bchAddress, scriptHash, status) {
        logger.debug(`SPV: [Process/Notify Full] User: ${userId}, Addr: ${bchAddress}`);

        

        let fetchedBalanceData;
        let fetchedTransactions;

        try {
            // 1. Fetch Current Live Balance (AFTER DELAY)
            try {
                // Use bchService which now connects directly for balance
                fetchedBalanceData = await bchService.getBalance(bchAddress);
                logger.debug(`SPV: Fetched balance post-delay: Addr=${bchAddress}, Confirmed=${fetchedBalanceData.balance}, Unconfirmed=${fetchedBalanceData.unconfirmedBalance}`);
            } catch (balanceError) {
                logger.error(`SPV: Failed getting balance post-delay (Addr: ${bchAddress}): ${balanceError.message}`);
                throw balanceError; // Throw to prevent caching status if balance fails
            }

            // 2. Fetch Recent Transaction History (AFTER DELAY)
            try {
                // Use bchService which now connects directly for history
                fetchedTransactions = await bchService.getTransactionHistoryFromElectrum(bchAddress, 20);
                logger.debug(`SPV: Fetched ${fetchedTransactions.length} recent transactions post-delay.`);
            } catch (historyError) {
                logger.error(`SPV: Failed getting history post-delay (Addr: ${bchAddress}): ${historyError.message}`);
                throw historyError; // Throw error, prevent caching status if history fails
            }

            // 3. Emit WebSocket Notification
            // <<< CORRECT CHECK IS HERE >>>
            if (this.io) {
                // Payload structure expected by frontend
                const payload = {
                    // No 'type' needed if frontend handles 'walletDataUpdate' generically
                    balance: { // Nest balance data (match frontend WalletBalance type)
                        totalBCH: (fetchedBalanceData.balance || 0) + (fetchedBalanceData.unconfirmedBalance || 0),
                        availableBCH: fetchedBalanceData.balance || 0, // Confirmed
                        pendingBCH: fetchedBalanceData.unconfirmedBalance || 0, // Unconfirmed
                        // BRL values should be calculated based on fetched rate within bchService or here if needed
                        totalBRL: 0, // Placeholder - bchService.getBalance doesn't return BRL
                        totalSatoshis: Math.round(((fetchedBalanceData.balance || 0) + (fetchedBalanceData.unconfirmedBalance || 0)) * SATOSHIS_PER_BCH),
                        currentRateBRL: 0 // Placeholder - bchService.getBalance doesn't return rate
                    },
                    transactions: fetchedTransactions, // Include formatted transaction list from bchService
                    // statusHash: status // Optional: include the trigger status hash for debugging
                };

                // --- Fetch rate and calculate BRL values ---
                // This might be slightly inefficient doing it here vs bchService, but keeps concerns separate
                try {
                    const rate = await require('./exchangeRate').getBchToBrlRate(); // Fetch current rate
                    payload.balance.currentRateBRL = rate;
                    payload.balance.totalBRL = payload.balance.totalBCH * rate;
                    // Note: bchService.getTransactionHistoryFromElectrum already calculates BRL for transactions
                } catch (rateError) {
                    logger.error(`SPV: Failed to get BRL rate for payload: ${rateError.message}`);
                    // Proceed without BRL values or with 0
                }
                // --- End BRL calculation ---


                const eventName = 'walletDataUpdate'; // Match frontend listener

                logger.debug(`SPV: Emitting '${eventName}' to user room: ${userId}`);
                this.io.to(userId.toString()).emit(eventName, payload);
                logger.info(`SPV: ✅ Wallet data update sent for User: ${userId}, Addr: ${bchAddress}`);
            } else {
                // <<< THIS IS THE CODE PATH BEING EXECUTED >>>
                logger.error("SPV: Socket.IO instance not set. Cannot emit update.");
                throw new Error("Socket.IO instance not available for notification.");
            }

        } catch (error) {
            // Log error from balance or history fetch
            logger.error(`SPV: Failed to process and notify full update for User ${userId} (${bchAddress}): ${error.message}`);
            // Re-throw the error so handleSubscriptionUpdate knows processing failed
            throw error;
        }
    }
    // --- End MODIFIED processAndNotifyWithHistory ---

    // --- Service Lifecycle ---
    async start() {
        if (this.isRunning) return;
        logger.info('SPV: Starting service...');
        this.isRunning = true;
        this.cacheCleanupTimer = setInterval(() => this.cleanupStatusCache(), CACHE_CLEANUP_INTERVAL_MS);
        this.periodicRetryTimer = setInterval(() => this.retryFailedPrimaries(), PERIODIC_RETRY_INTERVAL_MS);

        logger.debug(`SPV: Initial connections to ${this.primaryServerConfigs.length} primary servers...`);
        const initialConnectionPromises = this.primaryServerConfigs.map(config => this.connectToServer(config, false));
        await Promise.allSettled(initialConnectionPromises);
        logger.debug("SPV: Initial primary connection attempts settled.");

        this.tryConnectFallback(); // Attempt to connect to fallbacks if needed

        // Load existing users and subscribe them
        try {
            logger.debug('SPV: Fetching initial users for monitoring...');
            const usersToMonitor = await User.find({ bchAddress: { $exists: true, $ne: null, $ne: '' } }).select('_id bchAddress').lean();
            logger.debug(`SPV: [Initial Load] Found ${usersToMonitor.length} users with addresses.`);
            for (const user of usersToMonitor) {
                 // Use toString() for user._id just in case it's an ObjectId
                 await this.addSubscription(user._id.toString(), user.bchAddress);
            }
            logger.info(`SPV: [Initial Load] Finished adding initial subscriptions. Monitoring ${this.subscriptions.size} unique addresses.`);
        } catch (error) {
            logger.error(`SPV: [Initial Load Error] Failed fetching or subscribing users: ${error.message}`);
        }
     }

    async stop() {
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
             if (entry.client) {
                 entry.client.onClose = () => {}; // Prevent reconnect logic during shutdown
                 closePromises.push(entry.client.close().catch(e => logger.error(`SPV: Error closing client ${entry.config?.host}:${entry.config?.port}: ${e.message}`)));
             }
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
// Export methods bound to the singleton instance
module.exports = spvMonitorServiceInstance;

