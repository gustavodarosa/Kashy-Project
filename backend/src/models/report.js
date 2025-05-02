const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    
  title: { type: String, required: true },
  type: { type: String, required: true }, // Certifique-se de que 'type' é obrigatório
  dateRange: { type: String, required: true },
  generatedAt: { type: String, required: true },
  data: { type: Object, required: true }, // Certifique-se de que 'data' é obrigatório
  isAIGenerated: { type: Boolean, default: false },
  promptUsed: { type: String },
});

module.exports = mongoose.model('Report', reportSchema);