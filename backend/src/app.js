const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const userRoutes = require('./routes/userRoutes');
const cryptoProxy = require('./routes/cryptoProxy');
const walletRoutes = require('./routes/walletRoutes'); 

const errorHandler = require('./middlewares/errorHandler');
require('dotenv').config(); // Load env vars

const app = express();

// Configure CORS
const corsOptions = {
  origin: 'http://localhost:5173', // Substitua pelo domínio do frontend em produção
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Métodos permitidos
  allowedHeaders: ['Content-Type', 'Authorization'], // Cabeçalhos permitidos
};

// Middleware
app.use(cors(corsOptions)); // Aplica as configurações de CORS
app.use(express.json()); // Crucial for parsing JSON request bodies
app.use(express.urlencoded({ extended: true })); // Optional, for form data
app.use('/api/users', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/crypto', cryptoProxy);
app.use('/api', routes); // Make sure this line exists and is correct

// Global error handler (should be last)
app.use(errorHandler);

module.exports = app; // Export the app instance
