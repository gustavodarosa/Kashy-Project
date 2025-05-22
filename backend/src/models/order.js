// z:\git lixo\Kashy-Project\backend\src\models\order.js
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
  // Fields specific to BCH payments
  merchantAddress: { // Specific address for BCH payment (derived)
    type: String,
    required: function() { return this.paymentMethod === 'bch'; }
  },
  invoicePath: { // Derivation path for the merchantAddress
    type: String,
    required: function() { return this.paymentMethod === 'bch'; }
  },
  amountBCH: { // Total amount expected in BCH
    type: Number,
    required: function() { return this.paymentMethod === 'bch'; }
  },
  exchangeRateUsed: { // BCH/BRL rate at the time of order creation
    type: Number,
    required: function() { return this.paymentMethod === 'bch'; }
  },
  // Campos para rastrear o valor total pago
  amountPaidBRL: { // Valor total efetivamente pago em BRL
    type: Number,
    default: 0,
  },
  amountPaidBCH: { // Valor total efetivamente pago em BCH (se aplicável)
    type: Number,
    default: 0,
  },
  overpaymentAmountBRL: { // Valor pago a mais em BRL
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'partially_paid', 'payment_detected', 'paid', 'confirmed_paid', 'cancelled', 'refunded', 'expired'],
    default: 'pending',
  },
  transaction: { // Optional: details of the payment transaction (if applicable)
    txHash: { type: String },
    status: { type: String, enum: ['pending', 'confirmed', 'failed'] },
    paidAmountBCH: { type: Number }, // Actual amount paid in BCH for this specific transaction
    paymentReceivedAt: { type: Date }, // Timestamp when payment was detected/confirmed
    confirmations: { type: Number, default: 0 }
  },
  user: { // Optional: link to the user who created/owns the order
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true, // Make user field required to associate order with a user
  }
}, { timestamps: true }); // Adds createdAt and updatedAt automatically

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
