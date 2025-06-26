  const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  profileImage: { type: String, default: '' },
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, unique: true, required: true, trim: true, lowercase: true },
  password: { type: String, required: true, select: false },
  encryptedMnemonic: { type: String, required: true, select: false },
  encryptedDerivationPath: { type: String, required: true, select: false },
  bchAddress: { type: String, index: true, required: true },
  // Os campos 'balance', 'processedTxIds' e 'transactionCount' foram removidos.
  // Esses dados são derivados e devem ser calculados dinamicamente para garantir a precisão.
  // - O saldo (balance) é calculado pelo walletService.
  // - As transações processadas (processedTxIds) são verificadas na coleção 'Transaction', que possui um índice único para txid.
  // - A contagem de transações (transactionCount) é calculada via Transaction.countDocuments().
  role: { type: String, enum: ['user', 'merchant'], required: true, default: 'user' },
  phone: { type: String, default: '' },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorMethod: { type: String, enum: ['sms', 'email', 'authenticator'], default: 'sms' },
  twoFactorTempCode: { type: String, default: '', select: false },
  twoFactorTempExpires: { type: Date, default: null, select: false },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);