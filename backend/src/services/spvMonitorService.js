// z:\Kashy-Project\backend\src\services\spvMonitorService.js
const ElectrumClient = require('electrum-client');
const cashaddr = require('cashaddrjs');
const crypto = require('crypto');
const User = require('../models/user');
const Order = require('../models/Order'); // Ensure correct casing for Order model
const { FULCRUM_SERVERS } = require('../config/fullcrumConfig');
const logger = require('../utils/logger');
// --- MODIFICATION: Remove direct bchService dependency for history/balance ---
// const bchService = require('./bchService');
// --- MODIFICATION: Add walletService dependency ---
const walletService = require('./walletService'); // Use the main service for processing
const electrumRequestManager = require('./electrumRequestManager'); // For direct Electrum calls in processOrderPayment
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
        this.subscriptions = new Map(); // Map<scriptHash, { userId, bchAddress, orderId?: string }>
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
        this.processOrderPayment = this.processOrderPayment.bind(this); // Bind new method
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
            logger.error(`SPV: Failed connection to ${serverId}: ${error.message}`);
            const clientEntry = this.clients.get(serverId);
            if(clientEntry) { clientEntry.connecting = false; clientEntry.client = null; }
            if (client) { try { await client.close(); } catch (e) { /* Ignore close error */ } }
            if (!isPeriodicRetry) { this.scheduleReconnect(serverId, serverConfig); }
            if (this.primaryServerConfigs.some(cfg => `${cfg.host}:${cfg.port}` === serverId)) { this.failedPrimaryServers.add(serverId); }
            this.tryConnectFallback();
        }
    }
    _handleClientClose(serverId, serverConfig) { /* ... */
        logger.error(`SPV: Disconnected from ${serverId}.`);
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
        for (const fallbackConfig of this.rankedServers) {
            const fallbackServerId = `${fallbackConfig.host}:${fallbackConfig.port}`;
            if (this.primaryServerConfigs.some(cfg => `${cfg.host}:${cfg.port}` === fallbackServerId)) { continue; }
            const existingEntry = this.clients.get(fallbackServerId);
            if (!existingEntry || (!existingEntry.client && !existingEntry.connecting && !this.reconnectTimers.has(fallbackServerId))) {
                 this.connectToServer(fallbackConfig, false);
                 return;
            }
        }
        logger.warn(`SPV: Below target connections (${connectedCount}/${this.desiredConnectionCount}) and no available fallback servers.`);
    }
    retryFailedPrimaries() { /* ... */        if (!this.isRunning || this.failedPrimaryServers.size === 0) return;
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
    async addSubscription(userId, bchAddress, orderId = null) { // Added orderId
        if (!userId || !bchAddress) { logger.warn('SPV: Missing userId or bchAddress for subscription.'); return; }
        try {
            const scriptPubKeyBuffer = addressToScriptPubKeyBuffer(bchAddress);
            const scriptHash = scriptPubKeyBufferToScriptHash(scriptPubKeyBuffer);
            this.subscriptions.set(scriptHash, { userId, bchAddress, orderId }); // Store orderId            
            const subPromises = [];
            for (const [serverId, clientEntry] of this.clients.entries()) {
                if (clientEntry.client?.status === 1) {
                    if (!clientEntry.subscriptions.has(scriptHash)) {
                        subPromises.push(this.performSubscription(clientEntry.client, serverId, scriptHash));
                    } else { /* ... skip already subscribed ... */ }
                }
            }
            await Promise.allSettled(subPromises);
        } catch (error) { logger.error(`SPV: Failed subscription process for User ${userId}, Addr ${bchAddress}: ${error.message}`); }
    }
    async performSubscription(client, serverId, scriptHash) { /* ... */
        const clientEntry = this.clients.get(serverId);
        if (!clientEntry || !clientEntry.client || clientEntry.client.status !== 1) { return false; }
        if (clientEntry.subscriptions.has(scriptHash)) { return true; }
        try {
            const initialStatus = await withTimeout(client.request('blockchain.scripthash.subscribe', [scriptHash]), REQUEST_TIMEOUT_MS, `Subscribe timeout ${scriptHash} on ${serverId}`);
            clientEntry.subscriptions.add(scriptHash);
            if (initialStatus !== null) { logger.debug(`SPV: Initial status for ${scriptHash} on ${serverId} was ${initialStatus}. Will wait for next update.`); }
            return true;
        } catch (error) { logger.error(`SPV: [Sub FAIL] ${serverId} to ${scriptHash}: ${error.message}`); return false; }
    }
    async resubscribeClient(client, serverId) { /* ... */
        const clientEntry = this.clients.get(serverId);
        if (!clientEntry) { logger.error(`SPV: Cannot resubscribe, client entry for ${serverId} not found.`); return; }
        clientEntry.subscriptions.clear();
        const resubPromises = [];
        for (const scriptHash of this.subscriptions.keys()) {
            if (client?.status === 1) { resubPromises.push(this.performSubscription(client, serverId, scriptHash)); }
            else { logger.warn(`SPV: [Resub Skip] Client ${serverId} disconnected during resubscribe loop for ${scriptHash}.`); break; }
        }
        await Promise.allSettled(resubPromises);
        logger.info(`SPV: Resubscribed ${this.subscriptions.size} addresses to new client ${serverId}.`);
    }
    async removeSubscription(userId, bchAddress) { /* ... */
        if (!userId || !bchAddress) { logger.warn('SPV: Missing userId or bchAddress for unsubscription.'); return; }
        try {
            const scriptPubKeyBuffer = addressToScriptPubKeyBuffer(bchAddress);
            const scriptHash = scriptPubKeyBufferToScriptHash(scriptPubKeyBuffer);
            let stillNeeded = false;
                const subInfo = this.subscriptions.get(scriptHash);

                // If this specific subscription was for an order, and it's being removed,
                // we can directly remove it.
                // If it was a general user address, check if other order subscriptions use the same address (unlikely with unique invoice addresses).
            for (const [sh, info] of this.subscriptions.entries()) {
                    // If we are removing an order-specific subscription, `info.orderId` will match.
                    // If we are removing a user's main address, `info.userId` will match and `info.orderId` will be null.
                    // This logic might need refinement if a single address could be used for multiple things.
                    // For now, assume unique invoice addresses.
                    if (sh === scriptHash && (info.orderId || info.userId.toString() !== userId.toString())) { stillNeeded = true; break; }
                }
                if (subInfo && !stillNeeded) { // Check if subInfo exists
                    logger.info(`SPV: Unsubscribed Addr: ${bchAddress} (User: ${userId}${subInfo.orderId ? `, Order: ${subInfo.orderId}` : ''})`);
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
        for (const [status, timestamp] of this.processedStatusCache.entries()) { if (now - timestamp > STATUS_CACHE_TTL_MS) { this.processedStatusCache.delete(status); cleanedCount++; } }
    }
    attachListenersToClient(client, serverId) { /* ... */
        client.subscribe.removeAllListeners('blockchain.scripthash.subscribe');
        client.subscribe.on('blockchain.scripthash.subscribe', (params) => {
            const scriptHash = params[0]; const status = params[1];
            if (scriptHash && status !== null) { this.handleSubscriptionUpdate(scriptHash, status, serverId); }
        });
    }

    // --- MODIFIED: handleSubscriptionUpdate (Keep as is, uses processAndNotifyWithHistory) ---
    async handleSubscriptionUpdate(scriptHash, status, serverId) {
        // 1. Check if status was recently processed
        if (this.isStatusRecentlyProcessed(status)) {
            return;
        }

        // 2. Check for processing lock
        if (this.processingLocks.has(scriptHash)) {
            return;
        }

        // 3. Identify the user
        const subInfo = this.subscriptions.get(scriptHash);
        if (!subInfo) {
            logger.warn(`SPV: Received update for untracked SH: ${scriptHash}. Ignoring.`);
            return;
        }

        try {
             this.processingLocks.add(scriptHash);
             logger.debug(`SPV: [Lock Acquired] Processing update for SH: ${scriptHash}`);

            // --- >>> INVALIDATE CACHE for the user <<< ---
            // This is important if the update is for the user's main wallet.
            // For order-specific addresses, general user cache invalidation might still be good.
            logger.info(`SPV: Update on ${subInfo.bchAddress} (User: ${subInfo.userId}), invalidating cache.`);
             cache.invalidateUserWalletCache(subInfo.userId);
            cache.invalidateBlockHeightCache(); // Block height affects confirmations
             // --- >>> END INVALIDATION <<< ---

            if (subInfo.orderId) {
                // Handle order-specific payment detection
                await this.processOrderPayment(subInfo.userId, subInfo.bchAddress, subInfo.orderId, scriptHash, status);
            } else {
                // Handle general wallet update for the user's main address
                await this.processAndNotifyWithHistory(subInfo.userId, subInfo.bchAddress, scriptHash, status);
            }

             this.processedStatusCache.set(status, Date.now());             

        } catch (error) {
             logger.error(`SPV: Error processing update for SH ${scriptHash} (Status: ${status}): ${error.message}`);
             // Do NOT cache status if processing failed, allow retry on next update
        } finally {
             this.processingLocks.delete(scriptHash);
        }
    }
    // --- END MODIFIED handleSubscriptionUpdate ---

    // --- NEW: processOrderPayment ---
    async processOrderPayment(userId, bchAddress, orderId, scriptHash, electrumStatus) {
        logger.info(`SPV: Processing payment for Order ${orderId} (User: ${userId})`);
        try {
            const order = await Order.findById(orderId);
            if (!order) {
                logger.error(`SPV: Order ${orderId} not found during payment check.`);
                this.removeSubscription(userId, bchAddress); // Clean up subscription for non-existent order
                return;
            }
            if (order.status === 'paid' || order.status === 'confirmed_paid') {
                logger.info(`SPV: [Order Payment] Order ${orderId} already marked as paid. Status: ${order.status}. Skipping further processing.`);
                // Optionally remove subscription if fully confirmed and no longer need monitoring
                // if (order.status === 'confirmed_paid' && order.confirmations >= TARGET_CONFIRMATIONS) this.removeSubscription(userId, bchAddress);
                return;
            }

            let history = [];
            let attempts = 0;
            const maxAttempts = 3; // Try up to 3 times
            const retryDelay = 5000; // 5 seconds delay between retries

            while (attempts < maxAttempts && (history === null || history.length === 0)) {
                if (attempts > 0) {
                    logger.info(`SPV: Retrying history fetch for ${bchAddress} (Order ${orderId}), attempt ${attempts + 1}/${maxAttempts}...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
                try {
                    // Fetch transaction history specifically for this address to find the new payment
                    const fetchedHistory = await electrumRequestManager.raceRequest('blockchain.scripthash.get_history', [scriptHash]);
                    if (fetchedHistory && Array.isArray(fetchedHistory)) {
                        history = fetchedHistory; // Assign if valid array
                    } else {
                        history = []; // Ensure history is an array even if null/undefined is returned
                    }
                } catch (fetchError) {
                    logger.error(`SPV: Error fetching history for ${bchAddress} (Order ${orderId}) on attempt ${attempts + 1}: ${fetchError.message}`);
                }
                attempts++;
            }

            if (history.length === 0) {
                logger.warn(`SPV: No history found for address ${bchAddress} (Order ${orderId}) after ${maxAttempts} attempts. Electrum Status: ${electrumStatus}.`);
                return;
            }

            // Find new, relevant transactions
            for (const item of history.sort((a, b) => b.height - a.height)) { // Process recent first
                if (order.transactionId && order.transactionId === item.tx_hash) {                    
                    // TODO: Potentially update confirmations if height changed and notify.
                    continue;
                }

                const txDetails = await electrumRequestManager.raceRequest('blockchain.transaction.get', [item.tx_hash, true]);
                if (!txDetails) continue;

                for (const vout of txDetails.vout) {
                    if (vout.scriptPubKey?.addresses?.includes(bchAddress)) {
                        const receivedSatoshis = Math.round((vout.value || 0) * SATOSHIS_PER_BCH);
                        const expectedSatoshis = Math.round(order.amountBCH * SATOSHIS_PER_BCH);

                        // Basic amount check (can add tolerance for overpayment)
                        if (receivedSatoshis >= expectedSatoshis) {
                            logger.info(`SPV: Payment detected for Order ${orderId} (TX: ${item.tx_hash}), status updated to 'paid'.`);
                            order.status = 'paid'; // <-- Altere aqui para ir direto para 'paid'
                            order.transactionId = item.tx_hash;
                            order.paidAmountBCH = receivedSatoshis / SATOSHIS_PER_BCH;
                            order.paymentReceivedAt = new Date();
                            await order.save();
                            // Notify merchant via WebSocket about the order update
                            if (this.io) this.io.to(userId.toString()).emit('orderUpdate', order.toObject());
                            return; // Payment found and processed for this order
                        }
                    }
                }
            }
            logger.info(`SPV: No new matching payment found for order ${orderId} in history of ${bchAddress}.`);
        } catch (error) {
            logger.error(`SPV: Error processing payment for Order ${orderId} (Addr: ${bchAddress}): ${error.message}`, error.stack);
        }
    }
    // --- END processOrderPayment ---

    // --- MODIFIED: processAndNotifyWithHistory (Uses walletService) ---
    async processAndNotifyWithHistory(userId, bchAddress, scriptHash, status) {
        let fetchedBalanceData;
        let fetchedTransactions;

        try {
            // 1. Fetch Current Live Balance using walletService
            try {
                fetchedBalanceData = await walletService.getWalletBalance(userId);
            } catch (balanceError) {
                logger.error(`SPV: Failed getting balance via walletService (User: ${userId}): ${balanceError.message}`);
                throw balanceError; // Throw to prevent caching status if balance fails
            }

            // 2. Fetch Processed Transaction History using walletService
            try {                
                fetchedTransactions = await walletService.getWalletTransactions(userId);
            } catch (historyError) {
                logger.error(`SPV: Failed getting history via walletService (User: ${userId}): ${historyError.message}`);
                throw historyError; // Throw error, prevent caching status if history fails
            }

            // 3. Emit WebSocket Notification
            if (this.io) {
                const payload = {
                    balance: fetchedBalanceData, // Use the structure returned by getWalletBalance
                    transactions: fetchedTransactions, // Use the structure returned by getWalletTransactions
                }; // <-- Chave de fechamento do objeto estava faltando aqui

                const eventName = 'walletDataUpdate';
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
        const initialConnectionPromises = this.primaryServerConfigs.map(config => this.connectToServer(config, false));
        await Promise.allSettled(initialConnectionPromises);
        this.tryConnectFallback();
        try {
            const usersToMonitor = await User.find({ bchAddress: { $exists: true, $ne: null, $ne: '' } }).select('_id bchAddress').lean();
            for (const user of usersToMonitor) { await this.addSubscription(user._id.toString(), user.bchAddress); }

            // Also load pending order addresses
            const pendingOrders = await Order.find({ status: { $in: ['pending', 'payment_detected'] }, paymentMethod: 'bch', merchantAddress: { $exists: true } }).select('user merchantAddress _id').lean();
            for (const order of pendingOrders) { await this.addSubscription(order.user.toString(), order.merchantAddress, order._id.toString()); }

            logger.info(`SPV: [Initial Load] Finished adding initial subscriptions. Monitoring ${this.subscriptions.size} unique scriptHashes.`);
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
         logger.info(`SPV: Closing ${this.clients.size} connections...`);
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
// --- FIM DA MODIFICAÇÃO ---
