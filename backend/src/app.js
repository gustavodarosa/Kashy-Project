const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const userRoutes = require('./routes/userRoutes');
const cryptoProxyRoutes = require('./routes/cryptoProxy'); // Renamed for clarity
const walletRoutes = require('./routes/walletRoutes'); 
const reportRoutes = require("./routes/reportRoutes");
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const rateRoutes = require('./routes/rateRoutes'); // Import new rate routes
const transactionRoutes = require('./routes/transactionRoutes'); // Import transaction routes
const storeRoutes = require('./routes/storeRoutes');

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
app.use('/api/crypto-proxy', cryptoProxyRoutes); // Changed mount path
app.use('/api', routes); 
app.use("/api/reports", reportRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/rates', rateRoutes); // Mount new rate routes
app.use('/api/transactions', transactionRoutes); // Mount transaction routes
app.use('/api/stores', storeRoutes); // Mount store routes


app.use(errorHandler);

module.exports = app;
