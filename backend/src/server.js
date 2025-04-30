// z:\Kashy-Project\backend\src\server.js
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/user');
// Correct the import path if necessary
const { protect: authMiddleware } = require('./middlewares/authMiddleware'); // Use 'protect' if exported that way
const app = require('./app'); // Your Express app instance from app.js
const connectDB = require('./config/db');
const spvService = require('./services/spvMonitorService');
const mongoose = require('mongoose');
const logger = require('./utils/logger'); // Assuming logger is correctly set up
const bcrypt = require('bcryptjs'); // Keep for password update route

const PORT = process.env.PORT || 3000; // Use PORT from env or default
const NODE_ENV = process.env.NODE_ENV || 'development'; // Get node environment
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'; // Get frontend URL

// --- Create HTTP server and Socket.IO instance ---
const server = http.createServer(app); // Use the app instance from app.js
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL, // Use FRONTEND_URL from env
    methods: ["GET", "POST"],
    // Add allowedHeaders if needed by your frontend
    // allowedHeaders: ["Content-Type", "Authorization"],
  }
});

// --- Store connected users (Keep existing) ---
const connectedUsers = new Map(); // Map<userId, Set<socketId>>

// --- Socket.IO Authentication Middleware (Keep existing) ---
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    logger.error("Socket Auth Error: No token provided");
    return next(new Error('Authentication error: No token provided'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    const user = await User.findById(socket.userId);
    if (!user) {
        logger.error(`Socket Auth Error: User ${socket.userId} not found`);
        return next(new Error('Authentication error: User not found'));
    }
    next();
  } catch (err) {
    logger.error(`Socket Auth Error: ${err.message}`);
    return next(new Error('Authentication error: Invalid token'));
  }
});

// --- Socket.IO Connection Logic (Keep existing) ---
io.on('connection', (socket) => {
  const userId = socket.userId;
  logger.info(`🔌 WebSocket connected: ${socket.id} (User: ${userId})`);
  socket.join(userId);
  logger.info(`User ${userId} joined room ${userId}`);
  if (!connectedUsers.has(userId)) {
    connectedUsers.set(userId, new Set());
  }
  connectedUsers.get(userId).add(socket.id);
  socket.on('disconnect', () => {
    logger.info(`🔌 WebSocket disconnected: ${socket.id} (User: ${userId})`);
    if (connectedUsers.has(userId)) {
        connectedUsers.get(userId).delete(socket.id);
        if (connectedUsers.get(userId).size === 0) {
            connectedUsers.delete(userId);
            logger.info(`User ${userId} has no more connections, removed from tracking.`);
        }
    }
  });
  socket.on('clientEvent', (data) => {
    logger.info(`Received 'clientEvent' from ${socket.id} (User: ${userId}):`, data);
  });

  const sendUserCount = async () => {
    try {
      const userCount = await User.countDocuments(); // Conta todos os documentos na coleção de usuários
      io.emit('userCountUpdate', userCount); // Envia o número de usuários para todos os clientes conectados
    } catch (error) {
      logger.error('Erro ao contar usuários:', error.message);
    }
  };

  // Enviar contagem inicial
  sendUserCount();

  // Atualizar periodicamente (opcional)
  const interval = setInterval(sendUserCount, 10000);

  socket.on('disconnect', () => {
    logger.info(`🔌 WebSocket disconnected: ${socket.id} (User: ${userId})`);
    clearInterval(interval);
  });
});

// --- Inject io instance into the SPV Service (Keep existing) ---
spvService.setIoServer(io);

// --- Add Logging Middleware (from provided example) ---
// This should ideally be in app.js before other routes, but adding here for now
app.use((req, res, next) => {
  // Avoid logging sensitive routes if necessary
  // if (!req.url.includes('/sensitive')) {
      logger.info(`${req.method} ${req.url}`);
  // }
  next();
});

// --- Add Basic Root Route (from provided example) ---
// This should ideally be in app.js or a dedicated root route file
app.get('/', (req, res) => {
  res.send('Kashy Backend API is running!');
});

// --- API Routes Defined Directly (Keep existing, but ideally move to route files) ---
// Rota para atualizar a imagem de perfil
app.post('/api/update-profile-image', authMiddleware, async (req, res) => {
  const { username, profileImage } = req.body;
  const userId = req.user.id;
  try {
    logger.info(`User ID: ${userId} - Attempting to update profile image.`);
    const user = await User.findById(userId);
    if (!user) { /* ... */ return res.status(404).json({ message: 'Usuário não encontrado.' }); }
    user.username = username || user.username;
    user.profileImage = profileImage || user.profileImage;
    await user.save();
    logger.info(`User ID: ${userId} - Profile image/username updated successfully.`);
    res.status(200).json({ message: 'Perfil atualizado com sucesso.', username: user.username, profileImage: user.profileImage });
  } catch (error) { /* ... */ logger.error(`User ID: ${userId} - Error updating profile image: ${error.message}`); res.status(500).json({ message: 'Erro interno no servidor ao atualizar perfil.' }); }
});

// Rota para obter o username do usuário autenticado
app.get('/api/user/username', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    logger.info(`User ID: ${userId} - Fetching username.`);
    const user = await User.findById(userId).select('username');
    if (!user) { /* ... */ return res.status(404).json({ message: 'Usuário não encontrado.' }); }
    res.status(200).json({ username: user.username });
  } catch (error) { /* ... */ logger.error(`User ID: ${userId} - Error fetching username: ${error.message}`); res.status(500).json({ message: 'Erro interno no servidor ao obter username.' }); }
});

// Rota para obter dados do usuário por ID
app.get('/api/user/:id', authMiddleware, async (req, res) => {
  const requestedUserId = req.params.id;
  const requesterUserId = req.user.id;
  try {
    logger.info(`User ID: ${requesterUserId} - Fetching profile for user ID: ${requestedUserId}.`);
    if (!mongoose.Types.ObjectId.isValid(requestedUserId)) { /* ... */ return res.status(400).json({ message: 'Formato de ID de usuário inválido.' }); }
    const user = await User.findById(requestedUserId).select('username profileImage email');
    if (!user) { /* ... */ return res.status(404).json({ message: 'Usuário não encontrado.' }); }
    res.status(200).json({ username: user.username, profileImage: user.profileImage, email: user.email });
  } catch (error) { /* ... */ logger.error(`Error fetching profile for user ID ${requestedUserId} by ${requesterUserId}: ${error.message}`); res.status(500).json({ message: 'Erro interno no servidor ao buscar dados do usuário.' }); }
});

// Rota para atualizar o username do usuário autenticado
app.put('/api/user/update-username', authMiddleware, async (req, res) => {
  const { username } = req.body;
  const userId = req.user.id;
  if (!username || typeof username !== 'string' || username.trim().length === 0) { /* ... */ return res.status(400).json({ message: 'Username inválido ou ausente.' }); }
  try {
    logger.info(`User ID: ${userId} - Attempting to update username to "${username}".`);
    const user = await User.findById(userId);
    if (!user) { /* ... */ return res.status(404).json({ message: 'Usuário não encontrado.' }); }
    user.username = username.trim();
    await user.save();
    logger.info(`User ID: ${userId} - Username updated successfully to "${user.username}".`);
    res.status(200).json({ message: 'Username atualizado com sucesso.', username: user.username });
  } catch (error) { /* ... */ logger.error(`User ID: ${userId} - Error updating username: ${error.message}`); if (error.code === 11000) { return res.status(409).json({ message: 'Este nome de usuário já está em uso.' }); } res.status(500).json({ message: 'Erro interno no servidor ao atualizar username.' }); }
});

// Rota para atualizar a senha do usuário autenticado
app.put('/api/user/update-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;
  if (!currentPassword || !newPassword) { /* ... */ return res.status(400).json({ message: 'Senha atual e nova senha são obrigatórias.' }); }
  if (newPassword.length < 6) { /* ... */ return res.status(400).json({ message: 'Nova senha deve ter pelo menos 6 caracteres.' }); }
  if (currentPassword === newPassword) { /* ... */ return res.status(400).json({ message: 'Nova senha não pode ser igual à senha atual.' }); }
  try {
    logger.info(`User ID: ${userId} - Attempting to update password.`);
    const user = await User.findById(userId).select('+password');
    if (!user) { /* ... */ return res.status(404).json({ message: 'Usuário não encontrado.' }); }
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) { /* ... */ return res.status(400).json({ message: 'Senha atual incorreta.' }); }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    logger.info(`User ID: ${userId} - Password updated successfully.`);
    res.status(200).json({ message: 'Senha atualizada com sucesso.' });
  } catch (error) { /* ... */ logger.error(`User ID: ${userId} - Error updating password: ${error.message}`); res.status(500).json({ message: 'Erro interno no servidor ao atualizar senha.' }); }
});

app.get('/api/users/count', authMiddleware, async (req, res) => {
  try {
    const userCount = await User.countDocuments(); // Conta todos os documentos na coleção de usuários
    res.status(200).json({ count: userCount });
  } catch (error) {
    logger.error('Erro ao contar usuários:', error.message);
    res.status(500).json({ message: 'Erro interno no servidor ao contar usuários.' });
  }
});

const productRoutes = require('./routes/productRoutes');
app.use('/api/products', productRoutes);

// --- Error Handling Middleware ---
// Ensure the error handler from app.js is the LAST middleware added
// app.use(errorHandler); // This is already done in app.js, no need to add again here

// --- Server Start Logic (Keep existing) ---
const startServer = async () => {
  try {
    logger.info('Connecting to MongoDB...');
    await connectDB();
    logger.info('MongoDB Connected.');

    logger.info('Starting SPV Monitor Service...');
    spvService.start().catch(err => {
        logger.error(`SPV Service failed to start initially: ${err.message}`);
    });

    server.listen(PORT, () => {
      // Log details from the provided example
      logger.info(`🚀 Server running in ${NODE_ENV} mode on port ${PORT}`);
      logger.info(`Frontend URL configured: ${FRONTEND_URL}`);
    });
  } catch (error) {
    logger.error(`FATAL: Failed to start server: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
};

startServer();

// --- Graceful Shutdown (Keep existing) ---
const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      io.close(() => { logger.info('Socket.IO connections closed.'); });
      try { await spvService.stop(); logger.info('SPV Monitor Service stopped.'); }
      catch (spvErr) { logger.error("Error stopping SPV service:", spvErr); }
      try { await mongoose.disconnect(); logger.info('MongoDB disconnected.'); }
      catch (dbErr) { logger.error("Error disconnecting MongoDB:", dbErr); }
      logger.info('Graceful shutdown complete.');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Could not close connections gracefully within timeout, forcing shutdown.');
      process.exit(1);
    }, 15000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });

// module.exports = { server, io }; // Keep commented unless needed elsewhere
