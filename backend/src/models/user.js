const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  profileImage: { type: String, default: '' },
  username: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  encryptedMnemonic: { type: String, required: true },
  encryptedDerivationPath: { type: String, required: true },
  bchAddress: { type: String, index: true, required: true },
  balance: { type: Number, required: true, default: 0 },
  processedTxIds: { type: [String], default: [] },
  role: { type: String, enum: ['user', 'merchant'], required: true, default: 'user' }, // Novo campo
  transactionCount: { type: Number, required: true, default: 0 }, // Novo campo
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);