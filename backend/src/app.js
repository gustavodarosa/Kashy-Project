const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();

// Middlewares globais
app.use(cors());
app.use(express.json());

// Rotas principais
app.use(routes);

// Middleware de tratamento de erros
app.use(errorHandler);

module.exports = app;