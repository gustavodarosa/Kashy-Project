const express = require('express');
const cors = require('cors');
// --- MODIFICATION: Import specific route files ---
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes'); // For login
const walletRoutes = require('./routes/walletRoutes');
const reportRoutes = require('./routes/reportRoutes');
const cryptoProxyRoutes = require('./routes/cryptoProxy'); // Renamed for clarity
// --- ADDED: Import stats routes ---
const statsRoutes = require('./routes/statsRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');


const errorHandler = require('./middlewares/errorHandler');
require('dotenv').config(); 

const app = express();


const corsOptions = {
  origin: 'http://localhost:5173', // Substitua pelo domínio do frontend em produção
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Métodos permitidos
  allowedHeaders: ['Content-Type', 'Authorization'], // Cabeçalhos permitidos
};

// Middleware
app.use(cors(corsOptions)); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use('/api/users', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/crypto', cryptoProxy);
app.use('/api', routes); 
app.use("/api/reports", reportRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);


// --- MODIFICATION: Mount routes with correct base paths ---
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes); // Mount auth routes (e.g., /api/auth/login)
app.use('/api/wallet', walletRoutes);
app.use('/api/products', productRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/crypto-proxy', cryptoProxyRoutes); // Use the renamed variable and path
// --- ADDED: Mount stats routes ---
app.use('/api/stats', statsRoutes);
// --- END MODIFICATION ---

// Error handler should be the LAST middleware
app.use(errorHandler);

module.exports = app;
