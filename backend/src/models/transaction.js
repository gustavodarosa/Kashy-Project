// src/models/transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Link to the User model
        required: true,
        index: true, // Index for faster lookups by user
    },
    txid: {
        type: String,
        required: true,
        index: true, // Index for potential lookups by txid
    },
    type: {
        type: String,
        enum: ['incoming', 'outgoing', 'internal'], // Type of transaction relative to the user's wallet
        required: true,
    },
    amountSatoshis: {
        type: Number, // Store the net amount change for the user in satoshis
        required: true,
    },
    address: {
        type: String, // The user's address involved in this tx
        required: true,
    },
    blockHeight: {
        type: Number, // Block height when confirmed (-1 or 0 for unconfirmed/mempool)
        required: true,
    },
    timestamp: {
        type: Date, // Timestamp of the block or detection time
        required: true,
        default: Date.now,
        index: true, // Index for sorting by time
    },
    // Add other fields if needed, e.g., fee, specific inputs/outputs involved
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

// Optional: Compound index to prevent duplicate transaction entries per user
// transactionSchema.index({ userId: 1, txid: 1 }, { unique: true });
// Note: Be careful with unique index if reprocessing is possible. Maybe handle duplicates in code instead.

module.exports = mongoose.model('Transaction', transactionSchema);
