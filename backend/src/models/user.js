const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, sparse: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  encryptedMnemonic: { type: String },
  encryptedDerivationPath: { type: String },
  bchAddress: {type: String, index: true, 
    default: null
},
balance: { // Stores balance in Satoshis
    type: Number,
    required: true,
    default: 0
},
processedTxIds: { // Stores TXIDs that have been accounted for
    type: [String],
    default: []
}
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);