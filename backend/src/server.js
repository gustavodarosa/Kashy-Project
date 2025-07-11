// backend/src/server.js
require('dotenv').config(); // Load .env variables FIRST
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose'); // Assuming Mongoose is used throughout
const logger = require('./utils/logger'); // Assuming logger is correctly set up
const bcrypt = require('bcryptjs'); // Keep for password update route

// --- Core App and DB ---
const app = require('./app'); // Your main Express app instance from app.js
const connectDB = require('./config/db'); // Your Mongoose DB connection function
const User = require('./models/user'); // Your User model

// --- Services and Middleware ---
const spvService = require('./services/spvMonitorService');
const { protect: authMiddleware } = require('./middlewares/authMiddleware'); // Use 'protect' if exported that way

// --- Route Imports ---
const reportRoutes = require('./routes/reportRoutes'); // Routes for AI reports
const productRoutes = require('./routes/productRoutes'); // Routes for Products
const orderRoutes = require('./routes/orderRoutes'); // Routes for Orders
const transactionRoutes = require('./routes/transactionRoutes'); // Routes for Transactions

// --- Environment Variables ---
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET;

// --- Environment Variable Checks (Keep existing checks) ---
if (!JWT_SECRET) {
    logger.error("FATAL ERROR: JWT_SECRET is not defined in .env file.");
    process.exit(1);
}
// Optional: Add checks for API_KEY and MONGO_URI here as well if needed on startup
if (!process.env.MONGO_URI) {
    logger.error("FATAL ERROR: MONGO_URI is not defined in .env file.");
    process.exit(1);
}
if (!process.env.API_KEY) {
    logger.warn("[Server Config] WARNING: Google AI API_KEY is not defined in .env. AI features will fail.");
}


// --- Create HTTP server ---
const server = http.createServer(app); // Use the app instance from app.js

// --- Setup Socket.IO ---
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL, // Use FRONTEND_URL from env
    methods: ["GET", "POST"],
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
    const user = await User.findById(socket.userId); // Verify user exists
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

  socket.on('disconnect', (reason) => {
    logger.info(`🔌 WebSocket disconnected: ${socket.id} (User: ${userId}). Reason: ${reason}`);
    if (connectedUsers.has(userId)) {
        connectedUsers.get(userId).delete(socket.id);
        if (connectedUsers.get(userId).size === 0) {
            connectedUsers.delete(userId);
            logger.info(`User ${userId} has no more connections, removed from tracking.`);
        }
    }
    // Clear the interval associated with THIS socket when it disconnects
    if (socket.userCountInterval) {
        clearInterval(socket.userCountInterval);
    }
  });

  socket.on('clientEvent', (data) => {
    logger.info(`Received 'clientEvent' from ${socket.id} (User: ${userId}):`, data);
    // Handle client event...
  });

  // --- User Count Logic Specific to this Connection ---
  const sendUserCount = async () => {
    try {
      const userCount = await User.countDocuments();
      io.emit('userCountUpdate', userCount); // Emit to all clients
    } catch (error) {
      logger.error('Erro ao contar usuários para broadcast:', error.message);
    }
  };
  sendUserCount(); // Send initial count
  // Store interval ID on the socket object to clear it on disconnect
  socket.userCountInterval = setInterval(sendUserCount, 10000); // Check every 10s

}); // End io.on('connection')

// --- Inject io instance into the SPV Service (Keep existing) ---
spvService.setIoServer(io);

// --- Essential Middlewares (Applied to the 'app' instance) ---
// Assuming cors() and express.json() are applied in app.js
// If not, you might need them here:
// app.use(cors({ origin: FRONTEND_URL })); // Be specific with origin in production
// app.use(express.json());

// --- Logging Middleware (Keep existing) ---
// This should ideally be in app.js before routes
app.use((req, res, next) => {
  // Avoid logging sensitive info if needed
  logger.info(`${req.method} ${req.url}`);
  next();
});

// --- Route Mounting ---

// Mount AI Report Routes
app.use('/api/reports', reportRoutes); // ADDED/ENSURED: Mount the AI report routes

// Mount Product Routes (Keep existing)
app.use('/api/products', productRoutes);

// Mount Order Routes
app.use('/api/orders', orderRoutes);

// Mount Transaction Routes
app.use('/api/transactions', transactionRoutes);

// Mount Report Routes
app.use('/api/reports', reportRoutes);

// --- Direct API Route Definitions (Keep existing - ideally move to route files later) ---
// Keep all your existing app.get/app.post/app.put routes here exactly as they were:

app.get('/', (req, res) => { // Keep the main root route
  res.send('Kashy Backend API is running!');
});

app.post('/api/update-profile-image', authMiddleware, async (req, res) => {
  const { username, profileImage } = req.body;
  const userId = req.user.id;
  try {
    logger.info(`User ID: ${userId} - Attempting to update profile image.`);
    const user = await User.findById(userId);
    if (!user) { return res.status(404).json({ message: 'Usuário não encontrado.' }); }
    user.username = username || user.username;
    user.profileImage = profileImage || user.profileImage;
    await user.save();
    logger.info(`User ID: ${userId} - Profile image/username updated successfully.`);
    res.status(200).json({ message: 'Perfil atualizado com sucesso.', username: user.username, profileImage: user.profileImage });
  } catch (error) { logger.error(`User ID: ${userId} - Error updating profile image: ${error.message}`); res.status(500).json({ message: 'Erro interno no servidor ao atualizar perfil.' }); }
});

app.get('/api/user/username', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    logger.info(`User ID: ${userId} - Fetching username.`);
    const user = await User.findById(userId).select('username');
    if (!user) { return res.status(404).json({ message: 'Usuário não encontrado.' }); }
    res.status(200).json({ username: user.username });
  } catch (error) { logger.error(`User ID: ${userId} - Error fetching username: ${error.message}`); res.status(500).json({ message: 'Erro interno no servidor ao obter username.' }); }
});

app.get('/api/user/:id', authMiddleware, async (req, res) => {
  const requestedUserId = req.params.id;
  const requesterUserId = req.user.id;
  try {
    logger.info(`User ID: ${requesterUserId} - Fetching profile for user ID: ${requestedUserId}.`);
    if (!mongoose.Types.ObjectId.isValid(requestedUserId)) { return res.status(400).json({ message: 'Formato de ID de usuário inválido.' }); }
    // Inclua o campo phone na seleção
    const user = await User.findById(requestedUserId).select('username profileImage email phone');
    if (!user) { return res.status(404).json({ message: 'Usuário não encontrado.' }); }
    res.status(200).json({ username: user.username, profileImage: user.profileImage, email: user.email, phone: user.phone });
  } catch (error) { logger.error(`Error fetching profile for user ID ${requestedUserId} by ${requesterUserId}: ${error.message}`); res.status(500).json({ message: 'Erro interno no servidor ao buscar dados do usuário.' }); }
});

app.put('/api/user/update-username', authMiddleware, async (req, res) => {
  const { username } = req.body;
  const userId = req.user.id;
  if (!username || typeof username !== 'string' || username.trim().length === 0) { return res.status(400).json({ message: 'Username inválido ou ausente.' }); }
  try {
    logger.info(`User ID: ${userId} - Attempting to update username to "${username}".`);
    const user = await User.findById(userId);
    if (!user) { return res.status(404).json({ message: 'Usuário não encontrado.' }); }
    user.username = username.trim();
    await user.save();
    logger.info(`User ID: ${userId} - Username updated successfully to "${user.username}".`);
    res.status(200).json({ message: 'Username atualizado com sucesso.', username: user.username });
  } catch (error) { logger.error(`User ID: ${userId} - Error updating username: ${error.message}`); if (error.code === 11000) { return res.status(409).json({ message: 'Este nome de usuário já está em uso.' }); } res.status(500).json({ message: 'Erro interno no servidor ao atualizar username.' }); }
});

app.put('/api/user/update-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;
  if (!currentPassword || !newPassword) { return res.status(400).json({ message: 'Senha atual e nova senha são obrigatórias.' }); }
  if (newPassword.length < 6) { return res.status(400).json({ message: 'Nova senha deve ter pelo menos 6 caracteres.' }); }
  if (currentPassword === newPassword) { return res.status(400).json({ message: 'Nova senha não pode ser igual à senha atual.' }); }
  try {
    logger.info(`User ID: ${userId} - Attempting to update password.`);
    const user = await User.findById(userId).select('+password');
    if (!user) { return res.status(404).json({ message: 'Usuário não encontrado.' }); }
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) { return res.status(400).json({ message: 'Senha atual incorreta.' }); }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    logger.info(`User ID: ${userId} - Password updated successfully.`);
    res.status(200).json({ message: 'Senha atualizada com sucesso.' });
  } catch (error) { logger.error(`User ID: ${userId} - Error updating password: ${error.message}`); res.status(500).json({ message: 'Erro interno no servidor ao atualizar senha.' }); }
});

app.put('/api/user/update-phone', authMiddleware, async (req, res) => {
  const { phone } = req.body;
  const userId = req.user.id;
  if (!phone) return res.status(400).json({ message: 'Telefone é obrigatório.' });
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
    user.phone = phone;
    await user.save();
    res.status(200).json({ message: 'Telefone atualizado com sucesso.', phone: user.phone });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar telefone.' });
  }
});

app.put('/api/user/update-email', authMiddleware, async (req, res) => {
  const { email } = req.body;
  const userId = req.user.id;
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    return res.status(400).json({ message: 'Email inválido ou ausente.' });
  }
  try {
    // Verifica se já existe outro usuário com o mesmo email
    const existingUser = await User.findOne({ email: email.trim(), _id: { $ne: userId } });
    if (existingUser) {
      return res.status(409).json({ message: 'Este email já está em uso por outro usuário.' });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
    user.email = email.trim();
    await user.save();
    res.status(200).json({ message: 'Email atualizado com sucesso.', email: user.email });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar email.' });
  }
});

app.get('/api/users/count', authMiddleware, async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    res.status(200).json({ count: userCount });
  } catch (error) {
    logger.error('Erro ao contar usuários:', error.message);
    res.status(500).json({ message: 'Erro interno no servidor ao contar usuários.' });
  }
});

app.put('/api/user/two-factor', authMiddleware, async (req, res) => {
  const { enabled, method } = req.body;
  const userId = req.user.id;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
    user.twoFactorEnabled = enabled;
    user.twoFactorMethod = method || 'sms';
    await user.save();
    res.status(200).json({ message: 'Configuração de 2FA atualizada.' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar 2FA.' });
  }
});

// Iniciar login 2FA (enviar código SMS)
app.post('/api/auth/login-2fa', async (req, res) => {
  const { email, password } = req.body;
  // ...verifique usuário e senha...
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Credenciais inválidas.' });
  }
  if (!user.twoFactorEnabled) {
    // Login normal
    // ...retorne token JWT...
    return res.status(200).json({ token: '...' });
  }
  // Gerar código e salvar temporariamente
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  user.twoFactorTempCode = code;
  user.twoFactorTempExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos
  await user.save();
  // Envie o código por SMS (mock ou integração real)
  // await sendSms(user.phone, `Seu código: ${code}`);
  console.log(`Código 2FA para ${user.phone}: ${code}`); // Para testes
  res.status(200).json({ require2FA: true, method: user.twoFactorMethod });
});

// Verificar código 2FA
app.post('/api/auth/verify-2fa', async (req, res) => {
  const { email, code } = req.body;
  const user = await User.findOne({ email });
  if (!user || !user.twoFactorEnabled) return res.status(400).json({ message: '2FA não está ativo.' });
  if (
    user.twoFactorTempCode === code &&
    user.twoFactorTempExpires &&
    user.twoFactorTempExpires > new Date()
  ) {
    // Código correto, gere token JWT
    user.twoFactorTempCode = '';
    user.twoFactorTempExpires = null;
    await user.save();
    // ...gere token JWT normalmente...
    return res.status(200).json({ token: '...' });
  }
  res.status(401).json({ message: 'Código inválido ou expirado.' });
});

app.get('/api/user/me', authMiddleware, async (req, res) => {
  try {
    console.log('[2FA] req.user:', req.user);
    const user = await User.findById(req.user.id);
    if (!user) {
      console.log('[2FA] Usuário não encontrado para ID:', req.user.id);
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    res.status(200).json({
      email: user.email,
      username: user.username,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorMethod: user.twoFactorMethod,
    });
  } catch (error) {
    console.error('[2FA] Erro ao buscar dados do usuário:', error);
    res.status(500).json({ message: 'Erro ao buscar dados do usuário.' });
  }
});

// REMOVED: Direct definition of the AI report route, as it's handled by reportRoutes
// app.post('/api/reports/generate-ai-report', async (req, res) => { ... });


// --- Generic Error Handler (Keep existing) ---
// This should ideally be the LAST middleware in app.js
// If it's defined here, ensure it's after all routes
app.use((err, req, res, next) => {
  logger.error("Unhandled error caught by generic handler:", err.stack);
  // Avoid sending stack trace in production
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode; // Use existing status code if set, else 500
  res.status(statusCode).json({
       message: err.message || 'Ocorreu um erro inesperado no servidor.',
       // stack: process.env.NODE_ENV === 'production' ? null : err.stack // Optionally include stack in dev
  });
});


// --- Server Start Logic (Updated) ---
const startServer = async () => {
  try {
    logger.info('[startServer] Conectando ao MongoDB...');
    await connectDB();
    logger.info('[startServer] Conexão com o MongoDB estabelecida.');

    logger.info('[startServer] Iniciando o serviço SPV Monitor...');
    spvService.start().catch(err => {
      logger.error(`[startServer] Erro ao iniciar o serviço SPV Monitor: ${err.message}`);
    });

    server.listen(PORT, () => {
      logger.info(`[startServer] 🚀 Servidor rodando no modo ${NODE_ENV} na porta ${PORT}`);
      logger.info(`[startServer] URL do frontend configurada: ${FRONTEND_URL}`);
    });
  } catch (error) {
    logger.error(`[startServer] FATAL: Falha ao iniciar o servidor: ${error.message}`);
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
    // Force shutdown after timeout
    setTimeout(() => {
      logger.error('Could not close connections gracefully within timeout (15s), forcing shutdown.');
      process.exit(1);
    }, 15000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Consider implementing a more robust handler or shutdown
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException'); // Recommended to exit on uncaught exceptions
  });

// module.exports = { server, io }; // Export if needed by tests etc.