// c:\Users\natan.bagatoli\Desktop\Kashy-Project\backend\src\models\order.js
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product', // Assuming you have a Product model
    // required: true, // Uncomment if product ID is always required
  },
  name: { type: String, required: true }, // Product name at the time of order
  quantity: { type: Number, required: true, min: 1 },
  priceBRL: { type: Number, required: true }, // Price in BRL at time of order
  priceBCH: { type: Number }, // Price in BCH at time of order (optional if not always BCH)
}, { _id: false });


const orderSchema = new mongoose.Schema({
  store: {
    type: String,
    required: true,
  },
  customerEmail: {
    type: String,
    // Not strictly required, can be 'Não identificado'
  },
  items: [orderItemSchema], // Array of order items
  totalAmount: { // This is likely in BRL
    type: Number,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ['bch', 'pix', 'card'], // Example payment methods
    required: true,
  },
  paymentAddress: { // Renamed from merchantAddress
    type: String,
    required: function() { return this.paymentMethod === 'bch'; }
  },
  exchangeRate: { // BCH/BRL rate at the time of order creation
    type: Number,
    required: function() { return this.paymentMethod === 'bch'; }
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled', 'refunded', 'expired'],
    default: 'pending',
  },
  transaction: { // Optional: details of the payment transaction (if applicable)
    txHash: { type: String },
    status: { type: String, enum: ['pending', 'confirmed', 'failed'] },
  },
  user: { // Optional: link to the user who created/owns the order
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true, // Make user field required to associate order with a user
  }
}, { timestamps: true }); // Adds createdAt and updatedAt automatically

module.exports = mongoose.model('Order', orderSchema);