// backend/src/controllers/userController.js
const bchService = require('../services/bchService'); // Use our service
const User = require('../models/user');
const cryptoUtils = require('../utils/cryptoUtils');
const { validationResult } = require('express-validator'); // For handling validation results
const bcrypt = require('bcrypt'); // Ensure bcrypt is imported


// --- Register User Function ---
// This function handles the logic previously tested in userRoutes.test.js
exports.registerUser = async (req, res, next) => {
  // ... (validation and existing user check) ...

  // --- Get username from request body ---
  const { email, password, username } = req.body; // <-- Add username here

  // ... (encryption key check) ...

  try {
    // ... (find existing user) ...

    const hashedPassword = await bcrypt.hash(password, 10);
    const walletDetails = await bchService.generateAddress();
    const encryptedMnemonic = cryptoUtils.encrypt(walletDetails.mnemonic, encryptionKey);
    const encryptedDerivationPath = cryptoUtils.encrypt(walletDetails.derivationPath, encryptionKey);

    user = new User({
      googleId: null,
      email: email,
      password: hashedPassword,
      username: username, // <-- ADD USERNAME HERE
      encryptedMnemonic: encryptedMnemonic,
      encryptedDerivationPath: encryptedDerivationPath,
      bchAddress: walletDetails.address
    });
    const savedUser = await user.save();

    res.status(201).json({
      _id: savedUser._id,
      email: savedUser.email,
      username: savedUser.username, // <-- Include in response if desired
      bchAddress: savedUser.bchAddress,
      message: 'User registered successfully.'
    });
  } catch (error) {
    // ... (error handling) ...
  }
};


// --- Recover Wallet Function ---
// This function retrieves the encrypted data for a user
exports.recoverWallet = async (req, res) => {
    // Validate input (using express-validator results)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    // Assuming authMiddleware added user info to req.user
    // Or if using email from query/body: const { email } = req.query; // or req.body
    const userEmail = req.user?.email; // Get email from authenticated user if possible

     if (!userEmail) {
         // Fallback or error if email isn't available (depends on your auth flow)
         return res.status(400).json({ message: 'User identifier not found in request.' });
     }


    try {
        // Find user by email (or ID from req.user.id)
        const user = await User.findOne({ email: userEmail });

        if (!user || !user.encryptedMnemonic || !user.encryptedDerivationPath) {
            return res.status(404).json({ message: 'Wallet data not found for this user.' });
        }

        // Return the *encrypted* data. Decryption should happen client-side or only when needed server-side.
        res.status(200).json({
            encryptedMnemonic: user.encryptedMnemonic,
            encryptedDerivationPath: user.encryptedDerivationPath,
            bchAddress: user.bchAddress // Also return the public address
        });
    } catch (error) {
        console.error('Error recovering wallet:', error);
        res.status(500).json({ message: 'Failed to recover wallet information.' });
    }
};


// --- Optional: Link Wallet (If different from registration) ---
// If 'linkWallet' had a different purpose, implement it here.
// Based on the previous code, it seemed like a registration attempt.
// If you need a separate function, define it:
/*
exports.linkWallet = async (req, res) => {
    // Implement specific logic for linking an *existing* external wallet maybe?
    // Or perhaps updating user details?
    res.status(501).json({ message: 'Link wallet function not implemented yet.' });
};
*/
