// z:\Kashy-Project\backend\src\models\transaction.js

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  txid: { type: String, required: true, index: true }, // The actual blockchain TXID
  type: { type: String, enum: ['incoming', 'outgoing', 'internal'], required: true }, // 'internal' could be for fees or consolidation
  status: { type: String, enum: ['pending', 'confirmed', 'failed'], default: 'pending' }, // Status based on blockHeight
  amountSatoshis: { type: Number, required: true },
  address: { type: String, required: true, index: true }, // The user's address involved
  // Optional fields for more detail
  fromAddress: { type: String }, // Best guess source address(es)
  toAddress: { type: String }, // Destination address if outgoing
  description: { type: String }, // e.g., "Received from X", "Sent to Y", "Reconciled"
  blockHeight: { type: Number, default: 0 }, // 0 or null/undefined means pending
  timestamp: { type: Date, default: Date.now, index: true }, // Time the record was created or block time
}, { timestamps: true }); // Adds createdAt, updatedAt

// --- Add Unique Compound Index ---
transactionSchema.index({ userId: 1, txid: 1 }, { unique: true });
// --- End Add Index ---

module.exports = mongoose.model('Transaction', transactionSchema);
