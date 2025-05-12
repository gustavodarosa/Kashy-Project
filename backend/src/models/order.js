const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  store: { type: String, required: true },
  customerEmail: { type: String, default: 'Não identificado' },
  totalAmount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['bch', 'pix', 'card'], required: true },
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      quantity: { type: Number, required: true },
      priceBRL: { type: Number, required: true },
      priceBCH: { type: Number, required: true },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Order', orderSchema);