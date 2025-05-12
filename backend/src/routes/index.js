const express = require('express');
const authRoutes = require('./authRoutes');
// --- ADDED: Import userRoutes ---
const userRoutes = require('./userRoutes');
// --- REMOVED: Unused authMiddleware import ---
// const { authMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use('/auth', authRoutes);
// --- ADDED: Mount userRoutes ---
router.use('/users', userRoutes);

module.exports = router;