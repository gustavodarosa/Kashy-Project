// z:\Kashy-Project\backend\src\middlewares\validators\walletValidators.js
const Joi = require('joi');

const sendTransactionSchema = Joi.object({
  address: Joi.string().required(), // Validação mais específica de endereço BCH pode ser adicionada
  amount: Joi.string().pattern(/^[0-9]+(\.[0-9]+)?$/).required(), // Valida string numérica
  fee: Joi.string().valid('low', 'medium', 'high').required(),
});

const transactionIdParamSchema = Joi.object({
    txid: Joi.string().hex().length(64).required() // Valida formato de TXID
});

module.exports = {
  sendTransactionSchema,
  transactionIdParamSchema,
};