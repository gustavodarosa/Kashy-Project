const Store = require('../models/store');
const User = require('../models/user');

exports.createStore = async (req, res) => {
  try {
    const { name } = req.body;
    const owner = req.user.id;
    const store = new Store({ name, owner, collaborators: [] });
    await store.save();
    res.status(201).json(store);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar loja.', error: error.message });
  }
};

exports.getMyStores = async (req, res) => {
  try {
    const userId = req.user.id;
    const stores = await Store.find({
      $or: [{ owner: userId }, { collaborators: userId }]
    });
    res.json(stores);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar lojas.', error: error.message });
  }
};

exports.addCollaborator = async (req, res) => {
  try {
    const { storeId, collaboratorId } = req.body;
    const store = await Store.findById(storeId);
    if (!store) return res.status(404).json({ message: 'Loja não encontrada.' });
    if (store.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Apenas o dono pode adicionar colaboradores.' });
    }
    if (!store.collaborators.includes(collaboratorId)) {
      store.collaborators.push(collaboratorId);
      await store.save();
    }
    res.json(store);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao adicionar colaborador.', error: error.message });
  }
};

exports.updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const store = await Store.findById(id);
    if (!store) return res.status(404).json({ message: 'Loja não encontrada.' });
    if (store.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Apenas o dono pode editar a loja.' });
    }
    store.name = name || store.name;
    await store.save();
    res.json(store);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao editar loja.', error: error.message });
  }
};

exports.deleteStore = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Store.findById(id);
    if (!store) return res.status(404).json({ message: 'Loja não encontrada.' });
    if (store.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Apenas o dono pode excluir a loja.' });
    }
    await store.deleteOne();
    res.json({ message: 'Loja excluída com sucesso.' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao excluir loja.', error: error.message });
  }
};