const express = require('express');
const passport = require('passport');
const AuthController = require('../controllers/authController');
// --- MODIFICATION: Import validation ---
const { validate } = require('../middlewares/validators');
const { loginSchema } = require('../middlewares/validators/userValidators');
// --- END MODIFICATION ---
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const bchService = require('../services/bchService'); // Certifique-se de ter a função generateMnemonicAndKeys

const router = express.Router();

// --- MODIFICATION: Add Swagger JSDoc for Login ---
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate user and return JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput' # Reference schema defined below or in validators
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT authentication token.
 *                 userId:
 *                   type: string
 *                   description: The ID of the logged-in user.
 *       400:
 *         description: Validation failed (invalid email/password format).
 *       401:
 *         description: Invalid credentials (email or password incorrect).
 */
// POST /api/auth/login
router.post('/login', validate(loginSchema), AuthController.login);
// POST /api/auth/register was moved to POST /api/users

// Inicia o login com Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Callback do Google
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  async (req, res) => {
    try {
      let user = await User.findOne({ email: req.user.email });
      if (!user) {
        // Gere uma senha aleatória e criptografe
        const randomPassword = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        // Gere carteira BCH
        const { encryptedMnemonic, encryptedDerivationPath, bchAddress } = await bchService.generateMnemonicAndKeys();

        user = await User.create({
          username: req.user.username || req.user.displayName || 'GoogleUser',
          email: req.user.email,
          password: hashedPassword,
          encryptedMnemonic,
          encryptedDerivationPath,
          bchAddress,
          role: 'user'
        });
      }

      // Gere o token JWT
      const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
      );
      // Redirecione para o frontend com o token na URL
      res.redirect(`http://localhost:5173/DashboardHome?token=${token}`);
    } catch (error) {
      console.error('Erro no callback do Google:', error);
      res.redirect('http://localhost:5173?error=google-auth');
    }
  }
);

module.exports = router;

// --- MODIFICATION: Add component schema for Swagger ---
/**
 * @swagger
 * components:
 *   schemas:
 *     LoginInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address.
 *         password:
 *           type: string
 *           format: password
 *           description: User's password.
 */