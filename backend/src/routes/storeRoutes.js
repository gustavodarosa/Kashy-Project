const express = require('express');
const router = express.Router();
const Store = require('../models/store');
const { protect } = require('../middlewares/authMiddleware');
const storeController = require('../controllers/storeController');
const User = require('../models/user'); // Certifique-se de que o caminho para o modelo User está correto

router.post('/', protect, storeController.createStore);
router.get('/my', protect, storeController.getMyStores);
router.post('/add-collaborator', protect, storeController.addCollaborator);
router.put('/:id', protect, storeController.updateStore);
router.delete('/:id', protect, storeController.deleteStore);
router.get('/all', protect, storeController.getAllStores); // Nova rota para buscar todas as lojas
router.get('/by-email', protect, async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ message: 'Email é obrigatório.' });
  try {
    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('_id email username');
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar usuário por email.' });
  }
});

// Remover colaborador de uma loja
router.post('/remove-collaborator', protect, async (req, res) => {
  const { storeId, collaboratorId } = req.body;
  try {
    const store = await Store.findById(storeId);
    if (!store) return res.status(404).json({ message: 'Loja não encontrada.' });

    store.collaborators = (store.collaborators || []).filter(id => id.toString() !== collaboratorId);
    await store.save();

    res.status(200).json({ message: 'Colaborador removido com sucesso.' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao remover colaborador.' });
  }
});

module.exports = router;