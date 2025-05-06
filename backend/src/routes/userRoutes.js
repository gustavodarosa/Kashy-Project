const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
// --- MODIFICATION: Import validation middleware and schemas ---
const { validate } = require('../middlewares/validators'); // Import the base validator
const { registerSchema, updateUserSchema } = require('../middlewares/validators/userValidators');
// --- END MODIFICATION ---
// --- MODIFICATION: Import authMiddleware correctly ---
const { protect: authMiddleware } = require('../middlewares/authMiddleware'); // Import the protect function directly
// --- END MODIFICATION --- // Using 'protect' alias as 'authMiddleware'
// const User = require('../models/user'); // Controller should handle DB interactions


// --- Routes ---

// POST /api/users - Register a new user
router.post(
    '/',
    validate(registerSchema), // Apply Joi validation
    userController.registerUser
);

// --- MODIFICATION: Add Swagger JSDoc for Get Profile ---
/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get the profile of the currently authenticated user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: [] # Indicates this endpoint requires the JWT token
 *     responses:
 *       200:
 *         description: User profile data retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile' # Define this schema below or elsewhere
 *       401:
 *         description: Unauthorized (token missing, invalid, or expired).
 */
// GET /api/users/me - Get current user's profile
router.get(
    '/me',
    authMiddleware, // Now correctly refers to the protect function
    userController.getUserProfile
);

// --- MODIFICATION: Add Swagger JSDoc for Update Profile ---
/**
 * @swagger
 * /users/me:
 *   put:
 *     summary: Update the profile of the currently authenticated user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserInput' # Define this schema
 *     responses:
 *       200:
 *         description: User profile updated successfully.
 *       400:
 *         description: Validation failed.
 *       401:
 *         description: Unauthorized.
 */
// PUT /api/users/me - Update current user's profile
router.put(
    '/me',
    authMiddleware, // Now correctly refers to the protect function
    validate(updateUserSchema), // Validate update payload
    userController.updateUserProfile
);

// Optional: Add route for linkWallet if it has a separate purpose
// router.post('/link-wallet', authMiddleware, userController.linkWallet);

module.exports = router;

// --- MODIFICATION: Add component schemas for Swagger ---
/**
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: User ID.
 *         email:
 *           type: string
 *           format: email
 *         username:
 *           type: string
 *         bchAddress:
 *           type: string
 *           description: User's Bitcoin Cash address.
 *         role:
 *           type: string
 *           enum: [user, admin]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     UpdateUserInput:
 *       type: object
 *       properties:
 *         username:
 *           type: string
 */
