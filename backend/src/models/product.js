const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  priceBRL: { type: Number, required: true },
  priceBCH: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 0 },
  sku: { type: String, required: true, unique: true },
  category: { type: String, required: true, index: true },
  subcategory: { type: String },
  minStockLevel: { type: Number, required: true, default: 0 }, // Renomeado de 'minimum' para clareza
  store: { type: String, required: true, index: true },
  description: { type: String },
  brand: { type: String },
  weight: { type: Number },  
  images: [{ type: String }], 
  status: { type: String, enum: ['ativo', 'inativo', 'descontinuado'], default: 'ativo' },
  taxation: {
    ncm: { type: String },
    cest: { type: String }
  },
  warranty: { type: String }, 
  tags: [{ type: String }],
  barcode: { type: String, required: true, unique: true }, // Novo campo
}, { timestamps: true }); 

module.exports = mongoose.model('Product', productSchema);