// z:\Kashy-Project\backend\src\middlewares\validators\index.js
const logger = require('../../utils/logger');

// Middleware factory para validação com Joi
const validate = (schema, property = 'body') => (req, res, next) => {
  const { error } = schema.validate(req[property], { abortEarly: false }); // Validate req.body, req.query, or req.params
  if (error) {
    const errorMessages = error.details.map(detail => detail.message).join(', ');
    logger.warn(`Validation Error (${property}): ${errorMessages}`);
    return res.status(400).json({ message: 'Validation Error', details: errorMessages });
  }
  next();
};

module.exports = { validate };