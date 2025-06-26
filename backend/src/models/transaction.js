// z:\Kashy-Project\backend\src\models\transaction.js

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  txid: { type: String, required: true, index: true }, // The actual blockchain TXID
  // _id: { type: String, required: true }, // REMOVIDO: Deixar o Mongoose gerenciar o _id padrão
  type: { type: String, enum: ['incoming', 'outgoing', 'internal'], required: true }, // Simplificado para os tipos finais
  status: { type: String, enum: ['pending', 'confirmed', 'failed', 'expired'], default: 'pending' },
  amountSatoshis: { type: Number, required: true },
  amountBCH: { type: Number }, // Adicionado para consistência
  amountBRL: { type: Number }, // Adicionado para consistência
  address: { type: String, required: true, index: true }, // The user's address involved
  // Optional fields for more detail
  fromAddress: { type: String }, // Best guess source address(es)
  toAddress: { type: String }, // Destination address if outgoing
  description: { type: String }, // e.g., "Received from X", "Sent to Y", "Reconciled"
  blockHeight: { type: Number, default: 0 }, // 0 or null/undefined means pending
  confirmations: { type: Number, default: 0 }, // Adicionado para o frontend
  feeBCH: { type: Number }, // Adicionado para o frontend
  timestamp: { type: Date, index: true, default: null }, // Blockchain timestamp (pode ser nulo para pendentes)
},{ timestamps: true }); // Adiciona createdAt e updatedAt

// --- Adicionar Índice Único Composto ---
// Garante que não haverá transações duplicadas (txid) para o mesmo usuário.
// Isso substitui a necessidade de usar txid como _id.
transactionSchema.index({ user: 1, txid: 1 }, { unique: true });
// --- Fim do Índice ---

module.exports = mongoose.model('Transaction', transactionSchema);


module.exports = mongoose.model('Transaction', transactionSchema);
