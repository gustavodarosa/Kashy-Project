const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { findUserByEmail } = require('../models/user');

class AuthController {
  /**
   * Realiza login e retorna um token JWT.
   * @param {object} req
   * @param {object} res
   */
  static async login(req, res) {
    const { email, password } = req.body;

    // Valida se o email e a senha foram fornecidos
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    // Busca o usuário pelo email
    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    // Compara a senha fornecida com a senha armazenada
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    // Gera o token JWT
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: parseInt(process.env.JWT_EXPIRATION, 10) } // Expiração em segundos
    );

    res.status(200).json({ token });
  }
}

module.exports = AuthController;