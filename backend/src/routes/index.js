const express = require('express');
const authRoutes = require('./authRoutes');
// --- ADDED: Import other route modules ---
const walletRoutes = require('./walletRoutes');
const productRoutes = require('./productRoutes');
const reportRoutes = require('./reportRoutes');
const chartController = require('../controllers/chartController'); // Import chart controller
// --- END ADDED ---

// --- ADDED: Import authentication middleware ---
// Use 'protect' if that's the exported name, or 'authMiddleware' if that's the name
const { protect } = require('../middlewares/authMiddleware'); // Assuming 'protect' is the correct export
// --- END ADDED ---

const router = express.Router();

// Public routes (like auth) usually come first
router.use('/auth', authRoutes);

// --- ADDED: Apply auth middleware to protected routes ---
// All routes defined *after* this will require a valid token
router.use(protect);

// --- ADDED: Use the imported route modules ---
router.use('/wallet', walletRoutes);
router.use('/products', productRoutes); // Note: Product routes might have public parts (like marketplace) handled internally
router.use('/reports', reportRoutes);
router.get('/chart/:coinId/:vsCurrency', chartController.getMarketChart); // Chart proxy route

module.exports = router;