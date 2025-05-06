// z:\Kashy-Project\backend\src\middlewares\validators\userValidators.js
const Joi = require('joi');

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('user', 'merchant'), // Opcional, default é 'user' no model
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const updateUserSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30),
  // Adicione outros campos permitidos para atualização aqui
}).min(1); // Garante que pelo menos um campo seja enviado para atualização

// Validador para parâmetros de rota (exemplo, se necessário)
const userIdParamSchema = Joi.object({
    id: Joi.string().hex().length(24).required() // Exemplo para validar ObjectId do Mongoose
});

module.exports = {
  registerSchema,
  loginSchema,
  updateUserSchema,
  userIdParamSchema,
};