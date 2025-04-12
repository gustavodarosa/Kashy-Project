const bcrypt = require('bcrypt');

// Mock de usuários em memória
const users = [
  {
    id: 1,
    name: 'Bruce Wayne',
    email: 'bruce@wayne.com',
    password: bcrypt.hashSync('batman123', 10), // Senha criptografada
  },
  {
    id: 2,
    name: 'Clark Kent',
    email: 'clark@kent.com',
    password: bcrypt.hashSync('superman123', 10), // Senha criptografada
  },
];

/**
 * Encontra um usuário pelo email.
 * @param {string} email
 * @returns {object|null} Usuário ou null se não encontrado.
 */
function findUserByEmail(email) {
  return users.find(user => user.email === email);
}

module.exports = { findUserByEmail };