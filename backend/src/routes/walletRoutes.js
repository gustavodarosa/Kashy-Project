// z:\Kashy-Project\backend\src\routes\walletRoutes.js

const express = require('express');
// Import the authentication middleware (assuming it's correctly exported as 'protect')
// --- MODIFICATION: Import authMiddleware correctly ---
const { protect: authMiddleware } = require('../middlewares/authMiddleware'); // Import the protect function
const { validate } = require('../middlewares/validators'); // Import the base validator
const { sendTransactionSchema, transactionIdParamSchema } = require('../middlewares/validators/walletValidators');
// Import the controller functions
const {
    getAddress,
    getBalance,
    getTransactions,
    sendBCH,
    getWalletData, // Keep if you still need the old endpoint
    // getTotalSalesToday, // Consider moving to /dashboard or /reports
    // getTotalSales,      // Consider moving to /dashboard or /reports
    // getTotalSalesInBCH, // Consider moving to /dashboard or /reports
    markTransactionAsSeen // <-- Add this function
} = require('../controllers/walletController'); // Adjust path if needed

const router = express.Router();

// Apply the authentication middleware to all routes defined *after* this line
router.use(authMiddleware); // Now correctly refers to the protect function

// GET /api/wallet/address - Get user's BCH address
router.get('/address', getAddress);

// GET /api/wallet/balance - Get user's wallet balance
router.get('/balance', getBalance);

// GET /api/wallet/transactions - Get user's transaction history (paginated)
router.get('/transactions', getTransactions);

// --- MODIFICATION: Add Swagger JSDoc for Send Transaction ---
/**
 * @swagger
 * /wallet/transactions:
 *   post:
 *     summary: Send BCH from the user's wallet
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendTransactionInput' # Define this schema below
 *     responses:
 *       200:
 *         description: Transaction sent successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 txid:
 *                   type: string
 *                   description: The transaction ID (hash).
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation failed, insufficient funds, invalid address, or amount too small.
 *       401:
 *         description: Unauthorized.
 *       500:
 *         description: Internal server error during sending (e.g., wallet key access issue).
 *       503:
 *         description: Service unavailable (e.g., network error connecting to Electrum).
 *
 * components:
 *   schemas:
 *     SendTransactionInput: # Define the input schema here
 *       type: object
 *       required: [address, amount, fee]
 *       properties:
 *         address:
 *           type: string
 *           description: Recipient Bitcoin Cash address.
 *           example: bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a
 *         amount:
 *           type: number
 *           format: float
 *           description: Amount of BCH to send (must be positive).
 *           example: 0.001
 *         fee:
 *           type: string
 *           enum: [low, medium, high]
 *           description: Desired transaction fee level.
 *           example: medium
 */
// POST /api/wallet/transactions - Send BCH
router.post(
    '/transactions',
    validate(sendTransactionSchema), // Validate send payload
    sendBCH
);

// PATCH /api/wallet/transactions/:txid/seen - Mark a transaction as seen
router.patch(
    '/transactions/:txid/seen',
    validate(transactionIdParamSchema, 'params'), // Validate txid in URL params
    markTransactionAsSeen
);

// Export the router
module.exports = router;
