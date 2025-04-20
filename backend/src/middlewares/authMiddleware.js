const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Middleware para validar o token JWT.
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    logger.warn('Token não fornecido.');
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    logger.info(`Token decodificado para o usuário: ${decoded.id}`);
    next();
  } catch (err) {
    logger.error(`Erro ao validar token: ${err.message}`);
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};

module.exports = { authMiddleware };