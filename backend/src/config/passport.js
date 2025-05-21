const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user');
const { generateMnemonicAndKeys } = require('../services/bchService');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Procura usuário pelo email
      let user = await User.findOne({ email: profile.emails[0].value });

      if (!user) {
        // Gere senha aleatória e carteira
        const randomPassword = require('crypto').randomBytes(16).toString('hex');
        const hashedPassword = await require('bcrypt').hash(randomPassword, 10);
        const { generateMnemonicAndKeys } = require('../services/bchService');
        const { encryptedMnemonic, encryptedDerivationPath, bchAddress } = await generateMnemonicAndKeys();

        // Cria novo usuário
        user = await User.create({
          googleId: profile.id,
          username: profile.displayName,
          email: profile.emails[0].value,
          password: hashedPassword,
          encryptedMnemonic,
          encryptedDerivationPath,
          bchAddress,
          role: 'user'
        });
      } else if (!user.googleId) {
        // Se já existe mas não tem googleId, atualiza
        user.googleId = profile.id;
        await user.save();
      }

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});