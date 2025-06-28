const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product', 
  
  },
  name: { type: String, required: true }, 
  quantity: { type: Number, required: true, min: 1 },
  priceBRL: { type: Number, required: true }, 
  priceBCH: { type: Number }, 
}, { _id: false });


const orderSchema = new mongoose.Schema({
  store: {
    type: String,
    required: true,
  },
  customerEmail: {
    type: String,

  },
  items: [orderItemSchema],
  totalAmount: { 
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  shippingCost: {
    type: Number,
    default: 0
  },
  paymentMethod: {
    type: String,
    enum: ['bch', 'pix', 'card'], 
    required: true,
  },

  merchantAddress: { 
    type: String,
    required: function() { return this.paymentMethod === 'bch'; }
  },
  invoicePath: { 
    type: String,
    required: function() { return this.paymentMethod === 'bch'; }
  },
  amountBCH: { 
    type: Number,
    required: function() { return this.paymentMethod === 'bch'; }
  },
  exchangeRateUsed: {
    type: Number,
    required: function() { return this.paymentMethod === 'bch'; }
  },
  status: {
    type: String,
    enum: ['pending', 'payment_detected', 'paid', 'confirmed_paid', 'cancelled', 'refunded', 'expired'],
    default: 'pending',
  },
  // Referência à transação real no modelo Transaction
  transactionRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
  },
  user: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true, 
  }
}, { timestamps: true }); 

// Indexes for performance
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ store: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ "items.name": 1 });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
