const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  priceBRL: { type: Number, required: true, min: 0 },
  priceBCH: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 0 },
  sku: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  subcategory: { type: String },
  minimum: { type: Number, required: true, min: 1 },
  store: { type: String, required: true },
  description: { type: String },
  brand: { type: String },
  weight: { type: Number, min: 0 },
  images: [{ type: String }],
  status: { type: String, enum: ['ativo', 'inativo', 'descontinuado'], default: 'ativo' },
  taxation: {
    ncm: { type: String },
    cest: { type: String }
  },
  warranty: { type: String },
  tags: [{ type: String }],
  barcode: { type: String, unique: true },
  cfop: { type: String },
  unit: { type: String },
  origin: { type: Number, enum: [0, 1, 2] }, // 0 = Nacional, 1 = Importado, etc.
  icmsRate: { type: Number, min: 0, max: 100 },
  ipiRate: { type: Number, min: 0, max: 100 },
  pisRate: { type: Number, min: 0, max: 100 },
  cofinsRate: { type: Number, min: 0, max: 100 },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);