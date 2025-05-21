const express = require('express');
const passport = require('passport');
const router = express.Router();

// Redireciona para o Google para login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Callback do Google
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  (req, res) => {
    // Gere o token JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: req.user._id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
    // Redirecione para o frontend com o token na URL
    res.redirect(`http://localhost:5173/DashboardHome?token=${token}`);
  }
);

module.exports = router;