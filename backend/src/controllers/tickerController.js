const { getBchBrlPrice } = require('../services/novadaxService');

/**
 * Controlador para obter o preço do BCH em BRL.
 * @param {object} req - Objeto de requisição.
 * @param {object} res - Objeto de resposta.
 */
async function getBchBrl(req, res) {
  try {
    const data = await getBchBrlPrice();
    res.json(data);
  } catch (error) {
    console.error('Erro ao obter preço do BCH:', error.message);
    res.status(500).json({ error: 'Erro ao obter preço do BCH' });
  }
}

module.exports = { getBchBrl };