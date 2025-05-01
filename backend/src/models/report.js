const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  title: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  data: { type: Object, required: true }, // Ajuste conforme necessário
});

module.exports = mongoose.model('Report', reportSchema);