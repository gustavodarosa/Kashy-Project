// z:\Kashy-Project\backend\src\controllers\userController.js
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const User = require('../models/user');
const bchService = require('../services/bchService'); // Used for wallet generation
const cryptoUtils = require('../utils/cryptoUtils'); // Uses AES-GCM now
const logger = require('../utils/logger');
const spvService = require('../services/spvMonitorService'); // For adding new users to monitoring

// --- Register User Function ---
exports.registerUser = async (req, res, next) => {
    const endpoint = '/api/users (POST)'; // Assuming RESTful route
    // Validation check (ensure you have validation middleware in your route)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn(`[${endpoint}] Registration validation failed: ${JSON.stringify(errors.array())}`);
        return res.status(400).json({ message: "Validation failed", errors: errors.array() });
    }

    const { email, password, username, role } = req.body; // Get fields from request

    // Check for encryption key
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
        logger.error(`[${endpoint}] FATAL - ENCRYPTION_KEY is not set during registration.`);
        // Don't expose internal details in the response
        return res.status(500).json({ message: "Server configuration error preventing registration." });
    }

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            logger.warn(`[${endpoint}] Registration attempt failed - User already exists: ${email}`);
            return res.status(400).json({ message: 'User with this email already exists.' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate wallet details
        const walletDetails = await bchService.generateAddress();
        logger.info(`[${endpoint}] Generated new wallet for ${email}. Address: ${walletDetails.address}`);

        // Encrypt sensitive data using the updated cryptoUtils (AES-GCM)
        // The result is "iv:authTag:ciphertext"
        const encryptedMnemonic = cryptoUtils.encrypt(walletDetails.mnemonic, encryptionKey);
        const encryptedDerivationPath = cryptoUtils.encrypt(walletDetails.derivationPath, encryptionKey);
        logger.debug(`[${endpoint}] Mnemonic and derivation path encrypted for ${email}.`);

        // Create new user instance
        const newUser = new User({
            email,
            password: hashedPassword,
            username: username || email.split('@')[0], // Default username if not provided
            encryptedMnemonic, // Save the GCM encrypted string
            encryptedDerivationPath, // Save the GCM encrypted string
            bchAddress: walletDetails.address,
            role: role || 'user', // Default role if not provided
            transactionCount: 0, // Initialize transaction count
            // googleId: null, // Set if using Google OAuth later
        });

        // Save user to database
        const savedUser = await newUser.save();
        logger.info(`[${endpoint}] User ${email} (${savedUser._id}) saved successfully.`);

        // --- Add user to SPV Monitor ---
        try {
            if (savedUser.bchAddress) {
                logger.info(`[${endpoint}] Adding new user ${savedUser._id} (${savedUser.bchAddress}) to SPV monitoring.`);
                // Call the SPV service (fire-and-forget)
                spvService.addSubscription(savedUser._id.toString(), savedUser.bchAddress);
                logger.info(`[${endpoint}] SPV subscription initiated for user ${savedUser._id}.`);
            } else {
                 logger.warn(`[${endpoint}] User ${savedUser._id} created without a bchAddress. Skipping SPV subscription.`);
            }
        } catch (spvError) {
            // Log the error but don't fail the registration response
            logger.error(`[${endpoint}] Failed to initiate SPV subscription for user ${savedUser._id} during registration: ${spvError.message}`, spvError.stack);
        }
        // --- End SPV Monitor addition ---

        // Return success response (exclude sensitive data)
        res.status(201).json({
            _id: savedUser._id,
            email: savedUser.email,
            username: savedUser.username,
            bchAddress: savedUser.bchAddress,
            role: savedUser.role,
            message: 'User registered successfully.'
        });

    } catch (error) {
        logger.error(`[${endpoint}] Error during user registration for ${email}: ${error.message}`);
        logger.error(error.stack); // Log stack trace for detailed debugging
        // Avoid sending detailed internal errors to the client
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
};

// --- Recover Wallet Function ---
// Retrieves the *encrypted* wallet data for a user.
// Assumes authentication middleware (like authMiddleware.js) adds req.userId.
exports.recoverWallet = async (req, res) => {
    const endpoint = '/api/users/me/wallet/recover (GET)'; // Example RESTful route
    const userId = req.userId; // Get userId from auth middleware

    if (!userId) {
        // This should ideally be caught by the auth middleware itself
        logger.error(`[${endpoint}] Error: userId not found in request after auth middleware.`);
        return res.status(401).json({ message: 'Authentication required.' });
    }
    logger.info(`[${endpoint}] User ${userId} attempting wallet recovery.`);

    try {
        // Find user by ID, selecting the necessary fields
        const user = await User.findById(userId).select('+encryptedMnemonic +encryptedDerivationPath +bchAddress');

        if (!user) {
            // Should not happen if token is valid, but check defensively
            logger.error(`[${endpoint}] User ${userId} not found in DB despite valid token.`);
            return res.status(404).json({ message: 'User not found.' });
        }

        if (!user.encryptedMnemonic || !user.encryptedDerivationPath) {
            logger.warn(`[${endpoint}] Wallet data (encrypted mnemonic or path) not found for user ${userId}.`);
            return res.status(404).json({ message: 'Wallet data not found for this user.' });
        }

        // Return the *encrypted* data. Decryption happens client-side or only when needed server-side.
        logger.info(`[${endpoint}] Successfully retrieved encrypted wallet data for user ${userId}.`);
        res.status(200).json({
            encryptedMnemonic: user.encryptedMnemonic,
            encryptedDerivationPath: user.encryptedDerivationPath,
            bchAddress: user.bchAddress // Also return the public address
        });
    } catch (error) {
        logger.error(`[${endpoint}] Error recovering wallet for user ${userId}: ${error.message}`);
        logger.error(error.stack);
        res.status(500).json({ message: 'Failed to recover wallet information due to a server error.' });
    }
};


// --- Get User Profile ---
// Retrieves non-sensitive profile information for the authenticated user.
exports.getUserProfile = async (req, res) => {
    const endpoint = '/api/users/me (GET)';
    const userId = req.userId; // From auth middleware

    if (!userId) {
        logger.error(`[${endpoint}] Error: userId not found in request after auth middleware.`);
        return res.status(401).json({ message: 'Authentication required.' });
    }
    logger.info(`[${endpoint}] Fetching profile for user ${userId}.`);

    try {
        // Find user by ID, exclude sensitive fields
        const user = await User.findById(userId).select('-password -encryptedMnemonic -encryptedDerivationPath -__v'); // Exclude sensitive fields

        if (!user) {
            logger.error(`[${endpoint}] User ${userId} not found in DB despite valid token.`);
            return res.status(404).json({ message: 'User not found.' });
        }

        logger.info(`[${endpoint}] Successfully retrieved profile for user ${userId}.`);
        res.status(200).json(user); // Send user object (without sensitive fields)

    } catch (error) {
        logger.error(`[${endpoint}] Error fetching profile for user ${userId}: ${error.message}`);
        logger.error(error.stack);
        res.status(500).json({ message: 'Failed to retrieve user profile due to a server error.' });
    }
};

// --- Update User Profile ---
// Allows updating non-sensitive fields like username.
exports.updateUserProfile = async (req, res) => {
    const endpoint = '/api/users/me (PUT)';
    const userId = req.userId; // From auth middleware

    if (!userId) {
        logger.error(`[${endpoint}] Error: userId not found in request after auth middleware.`);
        return res.status(401).json({ message: 'Authentication required.' });
    }

    // --- MODIFICATION: Add validation check ---
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn(`[${endpoint}] User profile update validation failed for user ${userId}: ${JSON.stringify(errors.array())}`);
        return res.status(400).json({ message: "Validation failed", errors: errors.array() });
    }
    // --- END MODIFICATION ---

    // Basic validation for allowed fields
    const allowedUpdates = ['username']; // Add other fields like 'name' if applicable
    const updates = {};
    for (const key in req.body) {
        if (allowedUpdates.includes(key) && req.body[key] !== undefined && req.body[key] !== null) {
            updates[key] = req.body[key];
        }
    }

    if (Object.keys(updates).length === 0) {
        logger.warn(`[${endpoint}] User ${userId} attempted update with no valid fields.`);
        return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    logger.info(`[${endpoint}] User ${userId} attempting to update profile with: ${JSON.stringify(updates)}`);

    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updates },
            { new: true, runValidators: true } // Return updated doc, run schema validators
        ).select('-password -encryptedMnemonic -encryptedDerivationPath -__v'); // Exclude sensitive fields

        if (!updatedUser) {
            logger.error(`[${endpoint}] User ${userId} not found during update attempt.`);
            return res.status(404).json({ message: 'User not found.' });
        }

        logger.info(`[${endpoint}] Successfully updated profile for user ${userId}.`);
        res.status(200).json(updatedUser);

    } catch (error) {
        logger.error(`[${endpoint}] Error updating profile for user ${userId}: ${error.message}`);
        logger.error(error.stack);
        // Handle potential validation errors from Mongoose
        if (error.name === 'ValidationError') {
             return res.status(400).json({ message: 'Validation failed during update.', errors: error.errors });
        }
        res.status(500).json({ message: 'Failed to update user profile due to a server error.' });
    }
};


// --- Optional: Link Wallet (Placeholder) ---
// If 'linkWallet' had a different purpose, implement it here.
/*
exports.linkWallet = async (req, res) => {
    // Implement specific logic for linking an *existing* external wallet maybe?
    // Or perhaps updating user details?
    logger.warn('Link wallet function called but not implemented.');
    res.status(501).json({ message: 'Link wallet function not implemented yet.' });
};
*/
