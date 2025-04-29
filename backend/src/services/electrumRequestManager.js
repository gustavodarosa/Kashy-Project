// z:\Kashy-Project\backend\src\services\electrumRequestManager.js
const ElectrumClient = require('electrum-client');
const { FULCRUM_SERVERS } = require('../config/fullcrumConfig'); // Use the ranked list
const logger = require('../utils/logger');
const { withTimeout, raceSuccess } = require('../utils/asyncUtils'); // Assuming asyncUtils.js exists

const RECONNECT_DELAY_MS = 10000;
const PERIODIC_RETRY_INTERVAL_MS = 5 * 60 * 1000; // Retry disconnected servers every 5 mins
const ELECTRUM_PROTOCOL_VERSION = '1.4';
const CONNECTION_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 10000;
// REMOVED: TARGET_CONNECTIONS

class ElectrumRequestManager {
    constructor() {
        this.clients = new Map(); // Map<serverId, { client, config, connecting, lastError: string|null }>
        this.rankedServers = FULCRUM_SERVERS; // Use the full ranked list
        // REMOVED: desiredConnectionCount
        // REMOVED: primaryServerConfigs
        // REMOVED: failedPrimaryServers
        this.reconnectTimers = new Map(); // Map<serverId, NodeJS.Timeout>
        this.periodicRetryTimer = null;
        this.isRunning = false;
        logger.info(`ElectrumRequestManager initialized. Will attempt to connect to all ${this.rankedServers.length} servers.`);
    }

    // --- Connection Management (Modified for "Connect to All") ---
    async connectToServer(serverConfig, isPeriodicRetry = false) {
        const serverId = `${serverConfig.host}:${serverConfig.port}`;
        const existingEntry = this.clients.get(serverId);

        // Avoid reconnecting if already connected or connecting
        if (existingEntry && (existingEntry.client?.status === 1 || existingEntry.connecting)) {
             // logger.debug(`[ReqMgr] Server ${serverId} already connected or connecting. Skipping.`);
             return;
        }

        logger.info(`[ReqMgr] Attempting connection to ${serverId}...${isPeriodicRetry ? ' (Periodic Retry)' : ''}`);
        // Ensure entry exists, mark as connecting
        this.clients.set(serverId, {
            client: existingEntry?.client || null, // Keep existing client object if present but disconnected
            config: serverConfig,
            connecting: true,
            lastError: existingEntry?.lastError || null
        });

        // Clear any pending reconnect timer for this server
        const immediateTimer = this.reconnectTimers.get(serverId);
        if (immediateTimer) { clearTimeout(immediateTimer); this.reconnectTimers.delete(serverId); }

        let client;
        try {
            // Use existing client object if reconnecting, otherwise create new
            client = existingEntry?.client && existingEntry.client.status !== 1
                   ? existingEntry.client
                   : new ElectrumClient(serverConfig.port, serverConfig.host, serverConfig.protocol);

            // Attach close handler *before* connecting (important for reconnects)
            client.onClose = () => this._handleClientClose(serverId, serverConfig);

            // Attempt connection and version negotiation
            await withTimeout(client.connect('kashy-req-mgr', ELECTRUM_PROTOCOL_VERSION), CONNECTION_TIMEOUT_MS, `Connection timeout to ${serverId}`);
            await withTimeout(client.server_version('kashy-req-mgr', ELECTRUM_PROTOCOL_VERSION), REQUEST_TIMEOUT_MS, `Server version timeout for ${serverId}`);

            logger.info(`[ReqMgr] ✅ Connected to ${serverId}.`);
            // Update client map entry on success
            const clientEntry = this.clients.get(serverId);
            if (clientEntry) {
                clientEntry.client = client;
                clientEntry.connecting = false;
                clientEntry.lastError = null;
            } else {
                // Should not happen if set above, but handle defensively
                this.clients.set(serverId, { client, config: serverConfig, connecting: false, lastError: null });
            }
            // REMOVED: failedPrimaryServers logic

        } catch (error) {
            logger.error(`[ReqMgr] 😓 Failed connection to ${serverId}: ${error.message}`);
            const clientEntry = this.clients.get(serverId);
            if(clientEntry) {
                clientEntry.connecting = false;
                clientEntry.lastError = error.message;
                // Ensure client object is nullified if connection failed completely
                if (clientEntry.client?.status !== 1) {
                    clientEntry.client = null;
                }
            }
            // Close the client if connection failed *during* the attempt
            if (client && client.status !== 1) {
                 try { await client.close(); } catch (e) { /* Ignore close error */ }
            }
            // Schedule a reconnect attempt if not a periodic retry that failed
            if (!isPeriodicRetry) {
                this.scheduleReconnect(serverId, serverConfig);
            }
            // REMOVED: tryConnectFallback call
        }
    }

    _handleClientClose(serverId, serverConfig) {
        logger.error(`[ReqMgr] ❌ Disconnected from ${serverId}.`);
        const clientEntry = this.clients.get(serverId);
        if (clientEntry) {
            clientEntry.client = null; // Mark as disconnected
            clientEntry.connecting = false;
            clientEntry.lastError = clientEntry.lastError || 'Connection closed unexpectedly';
        }
        // REMOVED: isPrimary / failedPrimaryServers logic

        // Schedule a reconnect attempt if the service is running
        if (this.isRunning && clientEntry) {
            this.scheduleReconnect(serverId, serverConfig);
        }
        // REMOVED: tryConnectFallback call
    }

    scheduleReconnect(serverId, serverConfig) {
        const existingEntry = this.clients.get(serverId);
        // Schedule if entry exists, is not connected, not connecting, and no timer exists
        if (existingEntry && !existingEntry.client && !existingEntry.connecting && !this.reconnectTimers.has(serverId)) {
            logger.info(`[ReqMgr] Scheduling reconnect for ${serverId} in ${RECONNECT_DELAY_MS / 1000}s...`);
            const timer = setTimeout(async () => {
                this.reconnectTimers.delete(serverId);
                if (this.isRunning) {
                    // Double check state before connecting
                     const currentEntry = this.clients.get(serverId);
                     if (currentEntry && !currentEntry.client && !currentEntry.connecting) {
                         await this.connectToServer(serverConfig, false); // Treat scheduled reconnect as non-periodic
                     }
                }
            }, RECONNECT_DELAY_MS);
            this.reconnectTimers.set(serverId, timer);
        }
     }

    // REMOVED: tryConnectFallback() function

    // MODIFIED: Renamed and changed logic
    retryDisconnectedServers() {
        if (!this.isRunning) return;
        let disconnectedCount = 0;
        for (const entry of this.clients.values()) {
            if (!entry.client && !entry.connecting) {
                disconnectedCount++;
            }
        }
        if (disconnectedCount === 0) {
             // logger.debug("[ReqMgr] [Periodic Retry] No disconnected servers found.");
             return;
        }

        logger.info(`[ReqMgr] [Periodic Retry] Checking ${disconnectedCount} potentially disconnected servers...`);
        this.clients.forEach((entry, serverId) => {
            // Attempt reconnect if no client, not currently connecting, and no reconnect timer pending
            if (!entry.client && !entry.connecting && !this.reconnectTimers.has(serverId)) {
                logger.info(`[ReqMgr] [Periodic Retry] Attempting to reconnect ${serverId}.`);
                this.connectToServer(entry.config, true); // Pass true for isPeriodicRetry
            }
        });
    }

    getConnectedClients() {
        return Array.from(this.clients.values())
            .map(entry => entry.client)
            .filter(client => client?.status === 1); // status 1 means connected
    }

    // --- Request Racing ---
    async raceRequest(method, params) {
        const connectedClients = this.getConnectedClients();
        if (connectedClients.length === 0) {
            logger.error('[ReqMgr] No connected Electrum clients available for request.');
            // REMOVED: this.tryConnectFallback();
            // Wait a bit, maybe a connection will come up via reconnect/retry
            await new Promise(res => setTimeout(res, 1500)); // Wait slightly longer
            const clientsAfterWait = this.getConnectedClients();
            if (clientsAfterWait.length === 0) {
                 logger.error('[ReqMgr] Still no connected clients after waiting.');
                 throw new Error('No connected Electrum servers available.');
            }
            // If clients connected, proceed with them
            logger.warn(`[ReqMgr] Proceeding with ${clientsAfterWait.length} client(s) found after waiting.`);
            return this.raceRequestInternal(clientsAfterWait, method, params);
        }
        return this.raceRequestInternal(connectedClients, method, params);
    }

    // No changes needed in raceRequestInternal itself
    async raceRequestInternal(clients, method, params) {
        logger.info(`[ReqMgr] Racing request '${method}' across ${clients.length} clients.`);
        const promises = clients.map(client =>
            withTimeout(
                client.request(method, params),
                REQUEST_TIMEOUT_MS,
                `Request timeout for ${method} on client`
            ).catch(error => {
                const serverId = client.host && client.port ? `${client.host}:${client.port}` : 'unknown client';
                logger.warn(`[ReqMgr] Request '${method}' failed on ${serverId}: ${error.message}`);
                return Promise.reject(error);
            })
        );

        try {
            const result = await raceSuccess(promises);
            logger.info(`[ReqMgr] Request '${method}' succeeded via racing.`);
            return result;
        } catch (aggregateError) {
            // Find the first actual error message if possible
            const firstError = aggregateError?.errors?.[0]?.message || aggregateError.message;
            logger.error(`[ReqMgr] Request '${method}' failed on all clients. Last error: ${firstError}`);
            throw new Error(`Electrum request '${method}' failed on all servers: ${firstError}`);
        }
    }

    // --- Service Lifecycle ---
    async start() {
        if (this.isRunning) return;
        logger.info('[ReqMgr] Starting service...');
        this.isRunning = true;
        // Use the renamed periodic retry function
        this.periodicRetryTimer = setInterval(() => this.retryDisconnectedServers(), PERIODIC_RETRY_INTERVAL_MS);

        logger.info(`[ReqMgr] Initial connection attempts to all ${this.rankedServers.length} configured servers...`);
        // Map connection attempts across ALL servers
        const initialConnectionPromises = this.rankedServers.map(config => this.connectToServer(config, false));
        await Promise.allSettled(initialConnectionPromises);

        logger.info("[ReqMgr] Initial connection attempts settled.");
        const connectedCount = this.getConnectedClients().length;
        logger.info(`[ReqMgr] Currently connected to ${connectedCount}/${this.rankedServers.length} servers.`);
        // REMOVED: tryConnectFallback call
     }

    async stop() {
         logger.info("[ReqMgr] Stopping service...");
         this.isRunning = false;
         if (this.periodicRetryTimer) clearInterval(this.periodicRetryTimer);
         this.reconnectTimers.forEach(timer => clearTimeout(timer));
         this.reconnectTimers.clear();
         // REMOVED: failedPrimaryServers.clear();

         const connectedCount = this.getConnectedClients().length;
         logger.info(`[ReqMgr] Closing ${connectedCount} active connections...`);
         const closePromises = [];
         this.clients.forEach(entry => {
             if (entry.client) {
                 // Ensure onClose doesn't trigger reconnect logic during shutdown
                 entry.client.onClose = () => {};
                 closePromises.push(entry.client.close().catch(e => logger.error(`[ReqMgr] Error closing client: ${e.message}`)));
             }
         });
         await Promise.allSettled(closePromises);
         this.clients.clear();
         logger.info("[ReqMgr] Service stopped.");
     }
}

// Export Singleton Instance
const electrumRequestManagerInstance = new ElectrumRequestManager();
// Automatically start the manager when the module is loaded
electrumRequestManagerInstance.start().catch(err => {
    logger.error(`[ReqMgr] Failed to auto-start ElectrumRequestManager: ${err.message}`);
});

module.exports = electrumRequestManagerInstance; // Export the instance directly
