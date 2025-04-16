const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  encryptedMnemonic: { type: String, required: true },
  encryptedDerivationPath: { type: String, required: true },
  bchAddress: { type: String, index: true, required: true },
  balance: { type: Number, required: true, default: 0 },
  processedTxIds: { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);