// c:\Users\gustavo.rosa8\Desktop\Kashy-Project\backend\src\routes\walletRoutes.js

const express = require('express');
// Import the authentication middleware
const { protect } = require('../middlewares/authMiddleware');
// Import the controller functions
const {
    getAddress,
    getBalance,
    getTransactions,
    sendBCH,
    getWalletData, // Keep if you still need the old endpoint
    // --- ADDED: New controller functions for sales data ---
    getSalesToday,
    getTotalSales,
    getTotalBCHReceived,
    getWeeklySalesData
    // --- END ADDED ---
} = require('../controllers/walletController'); // Adjust path if needed

const router = express.Router();

// Apply the authentication middleware to all routes defined *after* this line
// Since this is already applied in index.js for '/wallet',
// applying it here again is redundant but harmless.
// For clarity, you might choose to remove it here if index.js handles it.
router.use(protect);

// --- Core Wallet Endpoints ---
router.get('/address', getAddress);
router.get('/balance', getBalance);
router.get('/transactions', getTransactions);
router.post('/send', sendBCH);

// --- ADDED: Sales Data Endpoints ---
// These routes will be prefixed with /api/wallet by the main router
router.get('/sales/today', getSalesToday);
router.get('/sales/total', getTotalSales);
router.get('/sales/total-bch', getTotalBCHReceived);
router.get('/sales/weekly', getWeeklySalesData);
// --- END ADDED ---


// --- Optional: Keep the old combined endpoint if needed for backward compatibility ---
// router.get('/', getWalletData);


// Export the router
module.exports = router;
