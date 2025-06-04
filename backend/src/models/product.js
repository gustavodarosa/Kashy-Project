const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  priceBRL: { type: Number, required: true },
  priceBCH: { type: Number, required: true },
  quantity: { type: Number, required: true },
  sku: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  subcategory: { type: String }, 
  createdAt: { type: Date, default: Date.now },
  minimum: { type: Number, required: true },
  store: { type: String, required: true },
});

module.exports = mongoose.model('Product', productSchema);