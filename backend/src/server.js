// src/server.js
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken'); // Make sure jwt is required
const User = require('./models/user'); // Import User model
const { authMiddleware } = require('./middlewares/authMiddleware');
const app = require('./app');
const connectDB = require('./config/db');
const spvService = require('./services/spvMonitorService'); // Import the service object
const mongoose = require('mongoose');
const express = require('express');

const PORT = process.env.PORT || 3000;

// --- Create HTTP server and Socket.IO instance ---
const server = http.createServer(app); // Use http server with Express app
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
    console.error("Socket Auth Error: No token provided");
    return next(new Error('Authentication error: No token provided'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Attach user info to the socket object
    socket.userId = decoded.id; // Assuming JWT payload has 'id'

    // Optional: Verify user exists in DB
    const user = await User.findById(socket.userId);
    if (!user) {
        console.error(`Socket Auth Error: User ${socket.userId} not found`);
        return next(new Error('Authentication error: User not found'));
    }
    next(); // Proceed
  } catch (err) {
    console.error("Socket Auth Error:", err.message);
    return next(new Error('Authentication error: Invalid token'));
  }
});

// --- Socket.IO Connection Logic ---
io.on('connection', (socket) => {
  const userId = socket.userId; // Get userId attached by middleware
  console.log(`🔌 WebSocket connected: ${socket.id} (User: ${userId})`);

  // Join the user-specific room
  socket.join(userId);
  console.log(`User ${userId} joined room ${userId}`);

  // Track connected sockets per user
  if (!connectedUsers.has(userId)) {
    connectedUsers.set(userId, new Set());
  }
  connectedUsers.get(userId).add(socket.id);

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`🔌 WebSocket disconnected: ${socket.id} (User: ${userId})`);
    if (connectedUsers.has(userId)) {
        connectedUsers.get(userId).delete(socket.id);
        // Optional: Clean up the Set if it becomes empty
        if (connectedUsers.get(userId).size === 0) {
            connectedUsers.delete(userId);
        }
    }
    // Socket.IO handles leaving rooms automatically
  });
});

// --- Inject io instance into the SPV Service ---
spvService.setIoServer(io); // Call the setter method

// --- Server Start Logic ---
const startServer = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('MongoDB Connected.');

    // Remove the debugging logs for spvMonitorService if no longer needed

    console.log('Starting SPV Monitor Service...');
    await spvService.start(); // Call start from the imported service object

    // --- Use server.listen (the http server) NOT app.listen ---
    server.listen(PORT, () => {
      console.log(`🚀 Server (with WebSockets) running on port ${PORT}`);
    });

  } catch (error) {
    console.error('FATAL: Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Export server and io if needed by other modules (e.g., tests)
// module.exports = { server, io }; // Removed the direct export from spvMonitorService import

// --- Graceful Shutdown (Optional but Recommended) ---
const gracefulShutdown = () => {
    console.log('Initiating graceful shutdown...');
    io.close(async () => { // Close Socket.IO connections first
      console.log('Socket.IO connections closed.');
      server.close(async () => { // Then close HTTP server
        console.log('HTTP server closed.');
        try {
          await spvService.stop(); // Stop SPV service
        } catch (spvErr) {
          console.error("Error stopping SPV service:", spvErr);
        }
        try {
          await mongoose.disconnect(); // Disconnect DB
          console.log('MongoDB disconnected.');
        } catch (dbErr) {
          console.error("Error disconnecting MongoDB:", dbErr);
        }
        process.exit(0);
      });
    });
    // Force shutdown after timeout
    setTimeout(() => {
      console.error('Could not close connections gracefully, forcing shutdown.');
      process.exit(1);
    }, 10000); // 10 seconds timeout
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  // Rota para atualizar a imagem de perfil
app.post('/api/update-profile-image', authMiddleware, async (req, res) => {
  const { username, profileImage } = req.body;

  try {
    const user = await User.findById(req.user.id); // ID do usuário autenticado
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    // Atualiza o username e a imagem de perfil
    user.username = username || user.username;
    user.profileImage = profileImage || user.profileImage;
    await user.save();

    res.status(200).json({
      message: 'Imagem de perfil atualizada com sucesso.',
      profileImage: user.profileImage,
    });
  } catch (error) {
    console.error('Erro ao atualizar imagem de perfil:', error);
    res.status(500).json({ message: 'Erro interno no servidor.' });
  }
});

// Rota para obter o username do usuário autenticado
app.get('/api/user/username', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id); // ID do usuário autenticado
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    res.status(200).json({ username: user.username });
  } catch (error) {
    console.error('Erro ao obter username:', error);
    res.status(500).json({ message: 'Erro interno no servidor.' });
  }
});

// Rota para obter dados do usuário por ID
app.get('/api/user/:id', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    res.status(200).json({
      username: user.username,
      profileImage: user.profileImage,
      email: user.email,
    });
  } catch (error) {
    console.error('Erro ao buscar dados do usuário:', error);
    res.status(500).json({ message: 'Erro interno no servidor.' });
  }
});
