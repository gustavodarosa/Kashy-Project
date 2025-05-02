// z:\Kashy-Project\backend\src\models\transaction.js

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  address: { type: String, required: true },
  txid: { type: String, required: true, unique: true },
  amount: { type: Number, required: true }, // Amount in BCH
  type: { type: String, enum: ['sent', 'received', 'unknown'], required: true }, // Added 'unknown'
  timestamp: { type: Date, required: true },
  confirmed: { type: Boolean, default: false },
  confirmations: { type: Number, default: 0 }, // Added confirmations field
  seen: { type: Boolean, default: false },
  convertedBRL: { type: Number },
  linkedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true, sparse: true }, // Added optional link to Order
});

module.exports = mongoose.model('Transaction', transactionSchema);
