const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const userController = require('../controllers/userController');
// Use 'protect' to be consistent with index.js, or ensure authMiddleware is the correct export
const { protect } = require('../middlewares/authMiddleware'); // Assuming 'protect' is the intended middleware

// --- Define Validation Middleware ---
// Example: Assuming you want to validate email for registration
const validateEmail = [
    body('email', 'Invalid email format').isEmail().normalizeEmail(),
    // Add other validations if needed (e.g., password for actual login/registration)
];

// --- Routes ---

// Route to register a new user and generate a wallet
// POST /api/users/register
// Note: This route is public as it's for new user registration.
// If it's intended to be protected, you'd add 'protect' middleware here.
// However, typically registration is public.
router.post(
    '/register',
    validateEmail, // Apply validation middleware
    userController.registerUser // Use the correct controller function
);

// Route to recover a user's *encrypted* wallet data
// GET /api/users/recover-wallet
// This route will be protected by the 'protect' middleware applied in index.js
// to all routes under '/users'
router.get(
  '/recover-wallet',
  // 'protect' middleware is already applied by the main router in index.js for '/users/*'
  // If you wanted specific, additional protection or different middleware, you'd add it here.
  userController.recoverWallet
);

// Route to get the total count of users
// GET /api/users/count
// This route is also protected by the 'protect' middleware from index.js
router.get('/count', userController.getUserCount);


// Optional: Add route for linkWallet if it has a separate purpose
// router.post('/link-wallet', protect, userController.linkWallet);

module.exports = router;
