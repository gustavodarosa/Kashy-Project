// z:\Kashy-Project\backend\src\models\user.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // --- Basic Info ---
  username: {
    type: String,
    required: [true, 'Username is required.'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required.'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/\S+@\S+\.\S+/, 'Please use a valid email address.'], // Basic email format validation
  },
  password: {
    type: String,
    required: [true, 'Password is required.'],
    select: false, // Exclude password from query results by default
  },
  profileImage: {
    type: String,
    default: '', // Default empty string if no image provided
  },
  role: {
    type: String,
    enum: ['user', 'merchant', 'admin'], // Added 'admin' possibility
    required: true,
    default: 'user',
  },

  // --- Wallet Info (Sensitive - Excluded by Default) ---
  encryptedMnemonic: {
    type: String,
    required: true,
    select: false, // Exclude mnemonic from query results by default
  },
  encryptedDerivationPath: {
    type: String,
    required: true,
    select: false, // Exclude derivation path from query results by default
  },
  bchAddress: { // Public address - okay to select
    type: String,
    required: true,
    index: true, // Index for faster lookups if needed
  },

  // --- Monetization & Subscription Info ---
  plan: {
    type: String,
    enum: ['free', 'basic', 'premium'], // Example plan tiers
    default: 'free',
  },
  subscriptionExpiresAt: {
    type: Date,
    default: null, // Null means no active paid subscription or infinite free plan
  },
  monthlyVolumeBRL: { // Tracks volume for potential transaction fees on free/basic tiers
    type: Number,
    default: 0,
  },
  // stripeCustomerId: { // Optional: Add if integrating with Stripe for payments
  //   type: String,
  //   index: true,
  //   sparse: true, // Allows null/missing values without unique index conflicts
  // },

  // --- Removed Redundant Fields ---
  // balance: { type: Number, required: true, default: 0 }, // Removed - Fetch live balance instead
  // processedTxIds: { type: [String], default: [] }, // Removed - Check Transaction collection instead
  // transactionCount: { type: Number, required: true, default: 0 }, // Removed - Can be derived from Transaction collection if needed

}, { timestamps: true }); // Adds createdAt and updatedAt automatically

// --- Optional: Add pre-save hook for email lowercasing if not handled elsewhere ---
// userSchema.pre('save', function(next) {
//   if (this.isModified('email')) {
//     this.email = this.email.toLowerCase();
//   }
//   next();
// });

module.exports = mongoose.model('User', userSchema);
