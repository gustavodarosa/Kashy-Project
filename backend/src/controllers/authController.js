// z:\Kashy-Project\backend\src\controllers\authController.js
const bcrypt = require('bcrypt');
const User = require('../models/user');
const jwt = require('jsonwebtoken');
const bchService = require('../services/bchService');
const cryptoUtils = require('../utils/cryptoUtils');
const logger = require('../utils/logger'); // Import logger
const spvService = require('../services/spvMonitorService'); // Import SPV Service
// --- MODIFICATION: Import validationResult ---
const { validationResult } = require('express-validator');
// --- END MODIFICATION ---

class AuthController {
  // Registration logic moved to userController.registerUser
  static async login(req, res) {
    const { email, password } = req.body;
    const endpoint = '/api/login (POST)'; // For logging context

    try {
      // Fetch user WITH password for comparison
      const user = await User.findOne({ email }).select('+password'); // <-- Select password

      // --- MODIFICATION: Add validation check ---
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          // Avoid logging password in case it's the failing field
          logger.warn(`[${endpoint}] Login validation failed for ${email}: ${JSON.stringify(errors.array())}`);
          return res.status(400).json({ message: "Validation failed", errors: errors.array() });
      }
      // --- END MODIFICATION ---
      if (!user) {
        logger.warn(`[${endpoint}] Login attempt failed - User not found: ${email}`);
        return res.status(401).json({ message: 'Credenciais inválidas.' });
      }

      // Compare password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        logger.warn(`[${endpoint}] Login attempt failed - Invalid password for user: ${email}`);
        return res.status(401).json({ message: 'Credenciais inválidas.' });
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user._id, email: user.email }, // Payload
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h' } // Use env var or default
      );

      logger.info(`[${endpoint}] User ${email} (${user._id}) logged in successfully.`);

      // Send response
      res.status(200).json({
        token,
        userId: user._id, // Include userId for frontend convenience
        message: 'Login realizado com sucesso!',
        redirectTo: '/DashboardHome', // Or wherever your frontend redirects
      });
    } catch (error) {
      logger.error(`[${endpoint}] Error during login for ${email}: ${error.message}`);
      logger.error(error.stack);
      res.status(500).json({ message: 'Erro interno no servidor durante o login.' });
    }
  }
}

module.exports = AuthController;
