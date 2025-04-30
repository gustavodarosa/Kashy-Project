const express = require('express');
const { body, validationResult } = require('express-validator'); 
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const User = require('../models/user'); // Adicione esta linha para importar o modelo User

// --- Define Validation Middleware ---
// Example: Assuming you want to validate email for registration
const validateEmail = [
    body('email', 'Invalid email format').isEmail().normalizeEmail(),
    // Add other validations if needed (e.g., password for actual login/registration)
];

// --- Routes ---

// Route to register a new user and generate a wallet
// POST /api/users/register
router.post(
    '/register',
    validateEmail, // Apply validation middleware
    userController.registerUser // Use the correct controller function
);

// Route to recover a user's *encrypted* wallet data
// GET /api/users/recover-wallet
router.get(
  '/recover-wallet',
  authMiddleware, // Requires authentication
  // No specific body validation needed here usually, relies on auth user
  userController.recoverWallet
);

router.get('/', authMiddleware, async (req, res) => {
  try {
    const users = await User.find().select('_id email role isActive createdAt');
    res.status(200).json(users);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ message: 'Erro ao buscar usuários' });
  }
});

// Optional: Add route for linkWallet if it has a separate purpose
// router.post('/link-wallet', authMiddleware, userController.linkWallet);

module.exports = router;
