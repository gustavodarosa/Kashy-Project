// z:\Kashy-Project\backend\src\services\WebsocketService.js

const { Server: SocketIOServer } = require('socket.io');
const http = require('http');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
// Import SPV service methods directly
const spvService = require('./spvMonitorService'); // Import the SPV service instance
// Import User model to get address on connect/disconnect
const User = require('../models/user'); // Adjust path if needed

/** @type {SocketIOServer | null} */
let io = null; // This 'io' is local to this module if initializeWebsocketService is called
const userSockets = new Map(); // Map<userId, Set<socket.id>>

/**
 * Initializes the WebSocket service.
 * Creates a Socket.IO server instance and attaches it to the provided HTTP server.
 * Sets up authentication middleware and connection handling.
 * IMPORTANT: This function should ideally only be called ONCE during server startup.
 * The main 'io' instance used by the application should be the one created in server.js.
 * @param {http.Server} httpServer - The Node.js HTTP server instance.
 * @returns {SocketIOServer} The created Socket.IO server instance.
 */
function initializeWebsocketService(httpServer) {
  // Ensure CORS and transports are configured if needed
  io = new SocketIOServer(httpServer, { // Creates a potentially separate 'io' instance
      cors: {
          origin: "*", // Or specify your frontend URL (e.g., config.frontendUrl)
          methods: ["GET", "POST"]
      },
      transports: ['websocket'] // Ensure websocket is preferred
  });

  // --- REMOVED REDUNDANT BLOCK ---
  // The main io instance is created and passed to spvService in server.js
  // Calling spvService.setIoServer here is unnecessary and potentially problematic.
  // --- END REMOVAL ---


  // Auth Middleware (no changes needed)
  io.use(async (socket, next) => { // Added async for User.findById
    const token = socket.handshake.auth.token;
    if (!token) {
        logger.warn(`Socket Auth: Connection attempt without token from ${socket.handshake.address}`);
        return next(new Error('Authentication error: No token provided'));
    }
    try {
      // Use process.env.JWT_SECRET directly as config might not be fully loaded depending on import order
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (typeof decoded !== 'object' || !decoded || typeof decoded.id !== 'string') {
          logger.warn(`Socket Auth: Invalid token payload from ${socket.handshake.address}`);
          return next(new Error('Authentication error: Invalid token payload'));
      }

      // --- Store userId AND address in socket data ---
      const user = await User.findById(decoded.id).select('bchAddress');
      if (!user) {
          logger.error(`Socket Auth: User ${decoded.id} not found in DB.`);
          return next(new Error('Authentication error: User not found'));
      }
      if (!user.bchAddress) {
           // Allow connection, but SPV subscription will be skipped
           logger.warn(`User ${decoded.id} connected without a bchAddress.`);
      }
      socket.data.userId = decoded.id;
      socket.data.userAddress = user.bchAddress; // Store address for later use
      // --- End storing data ---

      next();
    } catch (err) {
      logger.error(`Socket Auth: JWT verification failed for token: ${err.message}`);
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    const userAddress = socket.data.userAddress; // Get address from socket data

    if (!userId) {
        logger.error(`Socket connection established without userId in auth middleware. Disconnecting ${socket.id}`);
        socket.disconnect(true); // Force disconnect
        return;
    }

    logger.info(`User ${userId} connected via WebSocket: ${socket.id}`);

    // Store socket ID (no changes needed)
    if (!userSockets.has(userId)) { userSockets.set(userId, new Set()); }
    userSockets.get(userId)?.add(socket.id);

    // --- Call SPV Service to Add Subscription ---
    // This uses the singleton spvService instance, which should have the correct 'io' from server.js
    if (userAddress) { // Only subscribe if user has an address
        try {
            // Call spvService directly
            // No need to await, let it run async. SPV service handles potential errors.
            spvService.addSubscription(userId, userAddress);
            logger.info(`SPV subscription initiated via WebSocket connect for user ${userId} (${userAddress})`);
        } catch (subError) {
            // This catch block might not be hit if addSubscription is fire-and-forget
            // Errors during subscription setup are handled within spvMonitorService
            logger.error(`Failed SPV subscription initiation for user ${userId} (${socket.id}): ${subError.message}`);
            // Consider emitting an error back to the client if critical
            // socket.emit('subscriptionError', { message: 'Could not subscribe to wallet updates.' });
        }
    } else {
         logger.warn(`Skipping SPV subscription for user ${userId} - no address found.`);
    }
    // --- End SPV Subscription ---


    socket.on('disconnect', (reason) => {
      logger.info(`User ${userId} disconnected: ${socket.id}. Reason: ${reason}`);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          logger.info(`User ${userId} has no active WebSocket connections.`);

          // --- Call SPV Service to Remove Subscription ---
          if (userAddress) { // Only attempt unsubscribe if user had an address
              try {
                  // spvService.removeSubscription(userId, userAddress); // No need to await
                  // logger.info(`SPV unsubscription initiated via WebSocket disconnect for user ${userId} (${userAddress})`);
                  logger.info(`User ${userId} disconnected fully. SPV service should handle cleanup if needed.`);

              } catch (unsubError) {
                  logger.error(`Failed SPV unsubscription initiation for user ${userId}: ${unsubError.message}`);
              }
          }
          // --- End SPV Unsubscription ---
        }
      }
    });

    // Example handler for client-sent events
    socket.on('clientEvent', (data) => {
        logger.info(`Received 'clientEvent' from ${socket.id} (User: ${userId}):`, data);
        // Process data or broadcast if needed
    });

    // ... other event handlers ...
  });

  logger.info('WebSocket service initialization complete.');
  return io; // Returns the 'io' instance created *within this function*
}

/**
 * Gets the initialized Socket.IO server instance and a helper function to notify users.
 * NOTE: This relies on the 'io' instance created within initializeWebsocketService.
 * If initializeWebsocketService is not called, or called multiple times, this might
 * return an incorrect or outdated 'io' instance.
 * It's generally safer to use the main 'io' instance created in server.js directly.
 * @returns {{io: SocketIOServer|null, notifyUser: Function}}
 */
function getWebsocketService() {
    // This 'io' refers to the one created within initializeWebsocketService
    if (!io) {
        logger.error('WebSocket service (via getWebsocketService) not initialized!');
        return {
            io: null,
            notifyUser: (userId, event, data) => logger.warn(`Attempted to notify user ${userId} via uninitialized WS service (getWebsocketService).`)
        };
    }

    /**
     * Emits an event to all sockets connected for a specific user ID.
     * @param {string|ObjectId} userId - The ID of the user to notify.
     * @param {string} event - The name of the event to emit.
     * @param {any} data - The data payload for the event.
     */
    const notifyUser = (userId, event, data) => {
        // Use the 'io' instance available in this module's scope
        if (!io) {
             logger.error(`Attempted to notify user ${userId}, but Socket.IO instance (via getWebsocketService) is missing.`);
             return;
        }
        // Ensure userId is a string for room emission
        const userIdString = userId.toString();
        const sockets = userSockets.get(userIdString); // Check if user is tracked
        if (sockets && sockets.size > 0) {
            // Emit to the room associated with the userId
            logger.debug(`Emitting '${event}' to user room ${userIdString} (Sockets: ${sockets.size}) via getWebsocketService`);
            io.to(userIdString).emit(event, data);
        } else {
            logger.debug(`Attempted to notify user ${userIdString} with event '${event}', but no active sockets found (getWebsocketService).`);
        }
    };

    return { io, notifyUser };
}

// Export the functions
module.exports = { initializeWebsocketService, getWebsocketService };
