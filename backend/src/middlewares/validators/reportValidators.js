// z:\Kashy-Project\backend\src\middlewares\validators\reportValidators.js
const Joi = require('joi');

const saveReportSchema = Joi.object({
  title: Joi.string().required(),
  type: Joi.string().required(),
  dateRange: Joi.string().required(),
  generatedAt: Joi.string().isoDate().required(), // Validate as ISO date string
  previewData: Joi.object().required(), // Or more specific schema if needed
  isAIGenerated: Joi.boolean(),
  promptUsed: Joi.string().allow(null, ''), // Allow null or empty string
});

const generateAIReportSchema = Joi.object({
  prompt: Joi.string().trim().min(1).required(),
});

const reportIdParamSchema = Joi.object({
    id: Joi.string().hex().length(24).required() // Validate ObjectId format
});

module.exports = {
  saveReportSchema,
  generateAIReportSchema,
  reportIdParamSchema,
};