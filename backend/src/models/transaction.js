const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    txid: {
        type: String,
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: ['incoming', 'outgoing', 'internal'],
        required: true,
    },
    amountSatoshis: {
        type: Number,
        required: true,
    },
    address: {
        type: String, 
        required: true,
    },
    blockHeight: {
        type: Number,
        required: true,
    },
    timestamp: {
        type: Date,
        required: true,
    },
    fromAddress: {
        type: String,
    },
    toAddress: {
        type: String,
    },
});

// Optional: Compound index to prevent duplicate transaction entries per user
// transactionSchema.index({ userId: 1, txid: 1 }, { unique: true });
// Note: Be careful with unique index if reprocessing is possible. Maybe handle duplicates in code instead.

module.exports = mongoose.model('Transaction', transactionSchema);
