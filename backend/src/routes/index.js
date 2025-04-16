const express = require('express');
const authRoutes = require('./authRoutes');
const { authMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

// Rotas de autenticação
router.use('/auth', authRoutes);

module.exports = router;