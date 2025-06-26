// z:\Kashy-Project\backend\src\controllers\authController.js
const bcrypt = require('bcrypt');
const User = require('../models/user');
const jwt = require('jsonwebtoken');
const bchService = require('../services/bchService');
const walletService = require('../services/walletService'); // Import walletService
const cryptoUtils = require('../utils/cryptoUtils');
const logger = require('../utils/logger'); // Import logger
const spvService = require('../services/spvMonitorService'); // Import SPV Service

class AuthController {
  static async register(req, res) {
    const { email, password, username } = req.body;
    const endpoint = '/api/register (POST)'; // For logging context

    try {
      // Verifica se o usuário já existe
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        logger.warn(`[${endpoint}] Registration attempt failed - User already exists: ${email}`);
        return res.status(400).json({ message: 'Usuário já existe.' });
      }

      // Gera o hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);

      // Gera os detalhes da carteira BCH
      const walletDetails = await bchService.generateAddress(); // Revertido para bchService
      logger.info(`[${endpoint}] Generated new wallet for ${email}. Address: ${walletDetails.address}`);
      // Avoid logging mnemonic in production/staging:
      // logger.debug(`[${endpoint}] Generated Mnemonic: ${walletDetails.mnemonic}`);

      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
           logger.error(`[${endpoint}] FATAL - ENCRYPTION_KEY is not set during registration.`);
           throw new Error("Server configuration error: Missing encryption key.");
      }

      const encryptedMnemonic = cryptoUtils.encrypt(walletDetails.mnemonic, encryptionKey);
      const encryptedDerivationPath = cryptoUtils.encrypt(walletDetails.derivationPath, encryptionKey);

      // Avoid logging sensitive data:
      // logger.debug(`[${endpoint}] Encrypted Mnemonic: ${encryptedMnemonic}`);
      // logger.debug(`[${endpoint}] Encrypted Derivation Path: ${encryptedDerivationPath}`);

      // Cria o novo usuário
      const newUser = new User({
        email,
        password: hashedPassword,
        username,
        encryptedMnemonic,
        encryptedDerivationPath,
        bchAddress: walletDetails.address,
        role: req.body.role || 'user', // Novo campo
        transactionCount: 0, // Inicializa com 0
      });

      // Salva o usuário no banco de dados (only once)
      await newUser.save();
      logger.info(`[${endpoint}] User ${email} (${newUser._id}) saved successfully.`);

      // --- Add user to SPV Monitor ---
      try {
        logger.info(`[${endpoint}] Adding new user ${newUser._id} (${newUser.bchAddress}) to SPV monitoring.`);
        // Call the exported function from the SPV service module
        // No need to await - let it run in the background, SPV service handles connection/retry
        spvService.addSubscription(newUser._id.toString(), newUser.bchAddress);
        logger.info(`[${endpoint}] SPV subscription initiated for user ${newUser._id}.`);
      } catch (spvError) {
        // Log the error but don't fail the registration response
        logger.error(`[${endpoint}] Failed to initiate SPV subscription for user ${newUser._id} during registration: ${spvError.message}`);
        // Consider adding more details like spvError.stack if needed for debugging
      }
      // --- End SPV Monitor addition ---

      // Retorna o usuário criado (without sensitive data)
      res.status(201).json({
        _id: newUser._id,
        email: newUser.email,
        username: newUser.username,
        bchAddress: newUser.bchAddress,
        message: 'Usuário registrado com sucesso.',
      });
    } catch (error) {
      logger.error(`[${endpoint}] Error during user registration for ${email}: ${error.message}`);
      logger.error(error.stack); // Log stack trace for detailed debugging
      res.status(500).json({ message: 'Erro interno no servidor durante o registro.' });
    }
  }

  static async login(req, res) {
    const { email, password } = req.body;
    const endpoint = '/api/login (POST)'; // For logging context

    try {
      // Fetch user WITH password for comparison
      const user = await User.findOne({ email }).select('+password'); // <-- Select password
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
