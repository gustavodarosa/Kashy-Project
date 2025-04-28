// z:\Kashy-Project\backend\src\server.js
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/user');
const { authMiddleware } = require('./middlewares/authMiddleware'); // Assuming this exists
const app = require('./app');
const connectDB = require('./config/db');
const spvService = require('./services/spvMonitorService');
const mongoose = require('mongoose');
const express = require('express'); // express is already required via app.js, but keeping for clarity if routes are defined here
const logger = require('./utils/logger');
const bcrypt = require('bcryptjs'); // Need bcrypt for password update

const PORT = process.env.PORT || 3000;

// --- Create HTTP server and Socket.IO instance ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow your frontend origin (replace '*' in production)
    methods: ["GET", "POST"]
  }
});

// --- Store connected users (simple example, consider Redis for production) ---
const connectedUsers = new Map(); // Map<userId, Set<socketId>> (Allow multiple connections per user)

// --- Socket.IO Authentication Middleware ---
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    logger.error("Socket Auth Error: No token provided");
    return next(new Error('Authentication error: No token provided'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Attach user info to the socket object
    socket.userId = decoded.id; // Assuming JWT payload has 'id'

    // Optional: Verify user exists in DB
    const user = await User.findById(socket.userId);
    if (!user) {
        logger.error(`Socket Auth Error: User ${socket.userId} not found`);
        return next(new Error('Authentication error: User not found'));
    }
    next(); // Proceed
  } catch (err) {
    logger.error(`Socket Auth Error: ${err.message}`);
    return next(new Error('Authentication error: Invalid token'));
  }
});

// --- Socket.IO Connection Logic ---
io.on('connection', (socket) => {
  const userId = socket.userId; // Get userId attached by middleware
  logger.info(`🔌 WebSocket connected: ${socket.id} (User: ${userId})`);

  // Join the user-specific room
  socket.join(userId);
  logger.info(`User ${userId} joined room ${userId}`);

  // Track connected sockets per user
  if (!connectedUsers.has(userId)) {
    connectedUsers.set(userId, new Set());
  }
  connectedUsers.get(userId).add(socket.id);

  // Handle disconnection
  socket.on('disconnect', () => {
    logger.info(`🔌 WebSocket disconnected: ${socket.id} (User: ${userId})`);
    if (connectedUsers.has(userId)) {
        connectedUsers.get(userId).delete(socket.id);
        // Optional: Clean up the Set if it becomes empty
        if (connectedUsers.get(userId).size === 0) {
            connectedUsers.delete(userId);
            logger.info(`User ${userId} has no more connections, removed from tracking.`);
        }
    }
    // Socket.IO handles leaving rooms automatically
  });

  // Example: Handle a custom event from the client
  socket.on('clientEvent', (data) => {
    logger.info(`Received 'clientEvent' from ${socket.id} (User: ${userId}):`, data);
    // Process data and potentially emit back or to the room
    // socket.emit('serverResponse', { message: 'Received your event!' });
    // io.to(userId).emit('updateForUser', { info: 'Something updated for you' });
  });
});

// --- Inject io instance into the SPV Service ---
spvService.setIoServer(io); // Call the setter method

// --- Define API Routes on the Express App ---
// Note: Routes are already defined in app.js and mounted there.
// Defining routes here *again* on `app` might cause issues or duplication.
// These routes should ideally be in their respective route files (e.g., userRoutes.js)
// and mounted in app.js as already done.
// I'll keep them here as they were in the provided context, but comment on the best practice.

// Best Practice: Move these route definitions to src/routes/userRoutes.js or similar
// and ensure they are mounted correctly in src/app.js.

// Rota para atualizar a imagem de perfil
app.post('/api/update-profile-image', authMiddleware, async (req, res) => {
  const { username, profileImage } = req.body;
  const userId = req.user.id; // Get ID from authMiddleware

  try {
    logger.info(`User ID: ${userId} - Attempting to update profile image.`);
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`User ID: ${userId} - Not found for profile image update.`);
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    // Update fields if provided
    user.username = username || user.username;
    user.profileImage = profileImage || user.profileImage;
    await user.save();

    logger.info(`User ID: ${userId} - Profile image/username updated successfully.`);
    res.status(200).json({
      message: 'Perfil atualizado com sucesso.',
      username: user.username, // Return updated username
      profileImage: user.profileImage,
    });
  } catch (error) {
    logger.error(`User ID: ${userId} - Error updating profile image: ${error.message}`);
    res.status(500).json({ message: 'Erro interno no servidor ao atualizar perfil.' });
  }
});

// Rota para obter o username do usuário autenticado
app.get('/api/user/username', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    logger.info(`User ID: ${userId} - Fetching username.`);
    const user = await User.findById(userId).select('username'); // Select only username
    if (!user) {
      logger.warn(`User ID: ${userId} - Not found when fetching username.`);
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    res.status(200).json({ username: user.username });
  } catch (error) {
    logger.error(`User ID: ${userId} - Error fetching username: ${error.message}`);
    res.status(500).json({ message: 'Erro interno no servidor ao obter username.' });
  }
});

// Rota para obter dados do usuário por ID (e.g., viewing another user's profile)
// Consider if authMiddleware is appropriate here or if it should be public/different auth
app.get('/api/user/:id', authMiddleware, async (req, res) => {
  const requestedUserId = req.params.id;
  const requesterUserId = req.user.id; // User making the request

  try {
    logger.info(`User ID: ${requesterUserId} - Fetching profile for user ID: ${requestedUserId}.`);
    // Validate if the requested ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(requestedUserId)) {
        logger.warn(`Invalid user ID format requested: ${requestedUserId}`);
        return res.status(400).json({ message: 'Formato de ID de usuário inválido.' });
    }

    const user = await User.findById(requestedUserId).select('username profileImage email'); // Select specific fields
    if (!user) {
      logger.warn(`User ID: ${requestedUserId} - Not found when fetched by ${requesterUserId}.`);
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    // Return selected public/semi-public data
    res.status(200).json({
      username: user.username,
      profileImage: user.profileImage,
      // Decide if email should be returned here - maybe only if requester is the same user?
      // email: requesterUserId === requestedUserId ? user.email : undefined,
      email: user.email, // Returning email as per original code
    });
  } catch (error) {
    logger.error(`Error fetching profile for user ID ${requestedUserId} by ${requesterUserId}: ${error.message}`);
    res.status(500).json({ message: 'Erro interno no servidor ao buscar dados do usuário.' });
  }
});

// Rota para atualizar o username do usuário autenticado
app.put('/api/user/update-username', authMiddleware, async (req, res) => {
  const { username } = req.body;
  const userId = req.user.id;

  // Basic validation
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return res.status(400).json({ message: 'Username inválido ou ausente.' });
  }

  try {
    logger.info(`User ID: ${userId} - Attempting to update username to "${username}".`);
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`User ID: ${userId} - Not found for username update.`);
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    // Optional: Check if username is already taken by another user
    // const existingUser = await User.findOne({ username: username.trim() });
    // if (existingUser && existingUser._id.toString() !== userId) {
    //   logger.warn(`User ID: ${userId} - Attempted to update to username "${username}" which is already taken.`);
    //   return res.status(409).json({ message: 'Este nome de usuário já está em uso.' });
    // }

    user.username = username.trim(); // Update and trim whitespace
    await user.save();

    logger.info(`User ID: ${userId} - Username updated successfully to "${user.username}".`);
    res.status(200).json({ message: 'Username atualizado com sucesso.', username: user.username });
  } catch (error) {
    logger.error(`User ID: ${userId} - Error updating username: ${error.message}`);
    // Handle potential duplicate key errors from DB if unique index exists
    if (error.code === 11000) { // MongoDB duplicate key error
        return res.status(409).json({ message: 'Este nome de usuário já está em uso.' });
    }
    res.status(500).json({ message: 'Erro interno no servidor ao atualizar username.' });
  }
});

// Rota para atualizar a senha do usuário autenticado
app.put('/api/user/update-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  // Basic validation
  if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Senha atual e nova senha são obrigatórias.' });
  }
  if (newPassword.length < 6) { // Example minimum length
      return res.status(400).json({ message: 'Nova senha deve ter pelo menos 6 caracteres.' });
  }
  if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'Nova senha não pode ser igual à senha atual.' });
  }

  try {
    logger.info(`User ID: ${userId} - Attempting to update password.`);
    // Fetch user with password field explicitly selected
    const user = await User.findById(userId).select('+password');
    if (!user) {
      logger.warn(`User ID: ${userId} - Not found for password update.`);
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      logger.warn(`User ID: ${userId} - Invalid current password provided.`);
      return res.status(400).json({ message: 'Senha atual incorreta.' });
    }

    // Hash and update new password
    user.password = await bcrypt.hash(newPassword, 10); // Use appropriate salt rounds
    await user.save();

    logger.info(`User ID: ${userId} - Password updated successfully.`);
    res.status(200).json({ message: 'Senha atualizada com sucesso.' });
  } catch (error) {
    logger.error(`User ID: ${userId} - Error updating password: ${error.message}`);
    res.status(500).json({ message: 'Erro interno no servidor ao atualizar senha.' });
  }
});


// --- Server Start Logic ---
const startServer = async () => {
  try {
    logger.info('Connecting to MongoDB...');
    await connectDB();
    logger.info('MongoDB Connected.');

    logger.info('Starting SPV Monitor Service...');
    // Start SPV service (ensure it doesn't block indefinitely if connection fails initially)
    spvService.start().catch(err => {
        logger.error(`SPV Service failed to start initially: ${err.message}`);
        // The service should handle retries internally
    });

    server.listen(PORT, () => {
      logger.info(`🚀 Server (with WebSockets) running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`FATAL: Failed to start server: ${error.message}`);
    logger.error(error.stack); // Log stack trace for debugging
    process.exit(1); // Exit if critical setup fails
  }
};

startServer();

// --- Graceful Shutdown ---
const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);
    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed.');

      // Close Socket.IO connections
      io.close(() => {
        logger.info('Socket.IO connections closed.');
      });

      // Stop SPV service
      try {
        await spvService.stop();
        logger.info('SPV Monitor Service stopped.');
      } catch (spvErr) {
        logger.error("Error stopping SPV service:", spvErr);
      }

      // Disconnect from MongoDB
      try {
        await mongoose.disconnect();
        logger.info('MongoDB disconnected.');
      } catch (dbErr) {
        logger.error("Error disconnecting MongoDB:", dbErr);
      }

      logger.info('Graceful shutdown complete.');
      process.exit(0); // Exit cleanly
    });

    // Force shutdown after a timeout if graceful shutdown fails
    setTimeout(() => {
      logger.error('Could not close connections gracefully within timeout, forcing shutdown.');
      process.exit(1); // Exit with error code
    }, 15000); // 15 seconds timeout
  };

  // Listen for termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // e.g., kill command
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // e.g., Ctrl+C

  // Optional: Handle unhandled promise rejections and uncaught exceptions
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Consider shutting down gracefully here as well, depending on the error severity
    // gracefulShutdown('unhandledRejection');
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // It's generally recommended to shut down after an uncaught exception
    gracefulShutdown('uncaughtException');
  });

// Export server and io only if needed by other modules (e.g., integration tests)
// module.exports = { server, io };
