const express = require('express');
const walletController = require('../controllers/walletController');
const { authMiddleware } = require('../middlewares/authMiddleware'); // Correct middleware is imported here
const User = require('../models/user'); // <-- Import the User model (adjust path if needed, e.g., '../models/User')

const router = express.Router();

// Rota para obter dados da carteira (Uses authMiddleware)
router.get('/', authMiddleware, walletController.getWalletData);

// Rota para enviar BCH (Uses authMiddleware)
router.post('/send', authMiddleware, walletController.sendBCH);

// Rota para obter o endereço da carteira (Corrected to use authMiddleware)
router.get('/address', authMiddleware, async (req, res) => { // <-- Changed authenticateToken to authMiddleware
    // The authMiddleware should have already verified the token
    // and attached user info to req.user.

    // Defensive check: Ensure middleware attached user info
    if (!req.user || !req.user.id) {
      console.error('[GET /address] Error: User ID not found after authentication.');
      // This usually indicates a problem with the authMiddleware
      return res.status(401).json({ message: 'Falha na autenticação: ID do usuário não encontrado.' });
    }

    const userId = req.user.id;
    console.log(`[GET /address] Attempting to fetch address for user ID: ${userId}`);

    try {
      // Find the user in the database by the ID from the token payload
      // Only select the bchAddress field for efficiency
      const user = await User.findById(userId).select('bchAddress'); // Now User is defined

      // Check if the user exists in the database
      if (!user) {
        console.warn(`[GET /address] User not found in DB for ID: ${userId}`);
        return res.status(404).json({ message: 'Usuário não encontrado.' });
      }

      // Check if the user has a BCH address assigned
      if (!user.bchAddress) {
        console.warn(`[GET /address] BCH address field is missing or empty for user ID: ${userId}`);
        // You might decide if this is a 404 (address not found) or maybe 500/400 if it should always exist
        return res.status(404).json({ message: 'Endereço da carteira BCH não está configurado para este usuário.' });
      }

      // Success! Return the address
      console.log(`[GET /address] Successfully found address for user ID ${userId}`);
      res.status(200).json({ address: user.bchAddress });

    } catch (error) {
      // Handle potential database errors or other unexpected issues
      console.error(`[GET /address] Server error fetching address for user ID ${userId}:`, error);
      res.status(500).json({ message: 'Erro interno do servidor ao buscar o endereço da carteira.' });
    }
});

// Make sure this router is exported (Only one export needed)
module.exports = router;

// module.exports = router; // <-- Remove this duplicate export
