require('dotenv').config();
const express = require('express');
const tickerRoutes = require('./routes/tickerRoutes');
const walletRoutes = require('./routes/walletRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para JSON
app.use(express.json());

// Rotas
app.use('/api/ticker', tickerRoutes);
app.use('/api/wallet', walletRoutes);

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});