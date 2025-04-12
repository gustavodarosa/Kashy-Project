const express = require('express');
const authRoutes = require('./authRoutes');
const { authMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

// Rota protegida (exemplo)
router.get('/protected', authMiddleware, (req, res) => {
  res.status(200).json({ message: 'Rota protegida acessada!', user: req.user });
});

// Rotas de autenticação
router.use('/auth', authRoutes);

module.exports = router;