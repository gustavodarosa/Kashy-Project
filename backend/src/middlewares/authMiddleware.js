const jwt = require('jsonwebtoken');

/**
 * Middleware para validar o token JWT.
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */


const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    console.error('Token não fornecido.');
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decodificado:', decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Erro ao validar token:', err.message);
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};

module.exports = { authMiddleware };