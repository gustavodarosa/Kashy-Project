const express = require('express');
const AuthController = require('../controllers/authController');

const router = express.Router();

// Rota de login
router.post('/login', AuthController.login);

module.exports = router;