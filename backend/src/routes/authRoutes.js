const express = require('express');
const AuthController = require('../controllers/authController');
// --- MODIFICATION: Import validation ---
const { validate } = require('../middlewares/validators');
const { loginSchema } = require('../middlewares/validators/userValidators');
// --- END MODIFICATION ---

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