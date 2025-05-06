// z:\Kashy-Project\backend\src\middlewares\validators\productValidators.js
const Joi = require('joi');

const createProductSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow(''), // Allow empty description
  priceBRL: Joi.number().positive().required(),
  priceBCH: Joi.number().positive().required(),
  quantity: Joi.number().integer().min(0).required(),
  sku: Joi.string().required(),
  category: Joi.string().required(),
  isActive: Joi.boolean(), // Optional, defaults to true in model
  minimum: Joi.number().integer().min(0).required(),
  store: Joi.string().required(),
});

const updateProductSchema = Joi.object({
  name: Joi.string(),
  description: Joi.string().allow(''),
  priceBRL: Joi.number().positive(),
  priceBCH: Joi.number().positive(),
  quantity: Joi.number().integer().min(0),
  sku: Joi.string(),
  category: Joi.string(),
  isActive: Joi.boolean(),
  minimum: Joi.number().integer().min(0),
  store: Joi.string(),
}).min(1); // Require at least one field to update

const productIdParamSchema = Joi.object({
    id: Joi.string().hex().length(24).required() // Validate ObjectId format
});

module.exports = {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
};