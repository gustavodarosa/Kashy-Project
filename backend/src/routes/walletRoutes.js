// z:\Kashy-Project\backend\src\routes\walletRoutes.js

const express = require('express');
// Import the authentication middleware (assuming it's correctly exported as 'protect')
// Adjust the path if your authMiddleware file is named differently or located elsewhere
const { protect } = require('../middlewares/authMiddleware');
// Import the controller functions
const {
    getAddress,
    getBalance,
    getTransactions,
    sendBCH,
    getWalletData // Keep if you still need the old endpoint
} = require('../controllers/walletController'); // Adjust path if needed

const router = express.Router();

// Apply the authentication middleware to all routes defined *after* this line
router.use(protect); // Use the imported 'protect' function

// --- New Specific Endpoints ---
router.get('/address', getAddress);
router.get('/balance', getBalance);
router.get('/transactions', getTransactions);
router.post('/send', sendBCH); // Use sendBCH which handles the 'fee' parameter

// --- Optional: Keep the old combined endpoint if needed for backward compatibility ---
// router.get('/', getWalletData);

// --- Remove the old inline /address route logic ---
/*
router.get('/address', async (req, res) => {
    // ... old inline logic removed ...
});
*/

// Export the router
module.exports = router;
