const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, sparse: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  encryptedMnemonic: { type: String },
  encryptedDerivationPath: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);