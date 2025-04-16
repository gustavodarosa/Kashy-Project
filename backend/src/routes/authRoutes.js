const express = require('express');
const AuthController = require('../controllers/authController');

const router = express.Router();

// Rota de login
router.post('/login', AuthController.login);
router.post('/register', AuthController.register);


module.exports = router;