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
  transaction: { 
    txHash: { type: String },
    status: { type: String, enum: ['pending', 'confirmed', 'failed'] },
    paidAmountBCH: { type: Number },
    paymentReceivedAt: { type: Date },
    confirmations: { type: Number, default: 0 }
  },
  user: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true, 
  }
}, { timestamps: true }); 

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);

