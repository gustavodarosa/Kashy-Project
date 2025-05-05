const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  store: { type: String, required: true },
  customerEmail: { type: String, default: 'Não identificado' },
  totalAmount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['bch', 'pix', 'card'], required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Order', orderSchema);