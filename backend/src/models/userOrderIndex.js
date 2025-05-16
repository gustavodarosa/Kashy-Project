const mongoose = require('mongoose');

const userOrderIndexSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  lastOrderIndex: {
    type: Number,
    default: -1, // So the first index used is 0
  },
});

/**
 * Static method to find the user's order index document and atomically increment the lastOrderIndex.
 * Creates the document if it doesn't exist.
 * @param {mongoose.Types.ObjectId | string} userId - The ID of the user.
 * @returns {Promise<number>} The *new* lastOrderIndex value after incrementing.
 */
userOrderIndexSchema.statics.getNextIndex = async function (userId) {
  // findOneAndUpdate with $inc and upsert: true is atomic
  const userIndexDoc = await this.findOneAndUpdate(
    { user: userId },
    { $inc: { lastOrderIndex: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return userIndexDoc.lastOrderIndex;
};

module.exports = mongoose.model('UserOrderIndex', userOrderIndexSchema);