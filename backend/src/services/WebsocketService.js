// z:\Kashy-Project\backend\src\services\WebsocketService.js

const { Server: SocketIOServer } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
// Import SPV service methods directly
const spvService = require('./spvMonitorService'); // Import the SPV service instance
// Import User model to get address on connect/disconnect
const User = require('../models/user'); // Adjust path if needed

let mainIoInstance = null; // Module-scoped variable to hold the main IO instance
const userSockets = new Map(); // Map<userId, Set<socket.id>>

/**
 * Initializes the WebSocket service.
 * Configures the provided Socket.IO server instance with authentication middleware
 * and connection handling logic.
 * IMPORTANT: This function should ideally only be called ONCE during server startup.
 * @param {SocketIOServer} ioInstance - The main Socket.IO server instance created in server.js.
 */
function initializeWebsocketService(ioInstance) {
  if (mainIoInstance) {
    logger.warn('WebSocketService already initialized. Skipping re-initialization.');
    return;
  }
  mainIoInstance = ioInstance; // Store the passed io instance

  // --- REMOVED REDUNDANT BLOCK ---
  // The main io instance is created and passed to spvService in server.js
  // Calling spvService.setIoServer here is unnecessary and potentially problematic.
  // --- END REMOVAL ---


  // Auth Middleware (no changes needed)
  mainIoInstance.use(async (socket, next) => { // Added async for User.findById
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
      socket.join(decoded.id.toString()); // Join user-specific room
      // --- End storing data ---

      next();
    } catch (err) {
      logger.error(`Socket Auth: JWT verification failed for token: ${err.message}`);
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  mainIoInstance.on('connection', (socket) => {
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
            // Pass null for orderId to indicate subscription for the main user address
            spvService.addSubscription(userId, userAddress, null);
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
                  spvService.removeSubscription(userId, userAddress, null); // Pass null for orderId
                  logger.info(`SPV unsubscription for main address initiated via WebSocket disconnect for user ${userId} (${userAddress})`);

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
}

/**
 * Emits an event to all sockets connected for a specific user ID.
 * Relies on `initializeWebsocketService` having been called with the main Socket.IO instance.
 * @param {string|ObjectId} userId - The ID of the user to notify.
 * @param {string} event - The name of the event to emit.
 * @param {any} data - The data payload for the event.
 */
function notifyUser(userId, event, data) {
    if (!mainIoInstance) {
         logger.error(`Attempted to notify user ${userId}, but Socket.IO instance (mainIoInstance) is not initialized in WebsocketService.`);
         return;
    }
    // Ensure userId is a string for room emission
    const userIdString = userId.toString();
    // Emitting to the room. Socket.IO handles delivery if the room exists and has members.
    // The userSockets map is primarily for managing add/remove subscription logic for the main address.
    logger.debug(`Emitting '${event}' to user room ${userIdString}`);
    mainIoInstance.to(userIdString).emit(event, data);
}

// Export the functions
module.exports = { initializeWebsocketService, notifyUser };
