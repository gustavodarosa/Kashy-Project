const bcrypt = require('bcrypt');
const User = require('../models/user');
const jwt = require('jsonwebtoken');
const bchService = require('../services/bchService'); // Serviço para gerar endereço BCH
const cryptoUtils = require('../utils/cryptoUtils'); // Utilitário para criptografia

class AuthController {
  static async register(req, res) {
    const { email, password, username } = req.body;

    try {
      // Verifica se o usuário já existe
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Usuário já existe.' });
      }

      // Gera o hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);

      // Gera os detalhes da carteira BCH
      const walletDetails = await bchService.generateAddress();
      console.log('Mnemônico gerado:', walletDetails.mnemonic);

      const encryptedMnemonic = cryptoUtils.encrypt(walletDetails.mnemonic, process.env.ENCRYPTION_KEY);
      const encryptedDerivationPath = cryptoUtils.encrypt(walletDetails.derivationPath, process.env.ENCRYPTION_KEY);

      console.log('Mnemônico criptografado:', encryptedMnemonic);
      console.log('Caminho de derivação criptografado:', encryptedDerivationPath);
      console.log('Chave de criptografia usada no registro:', process.env.ENCRYPTION_KEY);

      // Cria o novo usuário
      const newUser = new User({
        email,
        password: hashedPassword,
        username,
        encryptedMnemonic,
        encryptedDerivationPath,
        bchAddress: walletDetails.address,
      });
      await newUser.save();

      // Salva o usuário no banco de dados
      const savedUser = await newUser.save();

      // Retorna o usuário criado
      res.status(201).json({
        _id: savedUser._id,
        email: savedUser.email,
        username: savedUser.username, 
        bchAddress: savedUser.bchAddress,
        message: 'Usuário registrado com sucesso.',
      });
    } catch (error) {
      console.error('Erro durante o registro do usuário:', error);
      res.status(500).json({ message: 'Erro interno no servidor.' });
    }
  }
  static async login(req, res) {
    const { email, password } = req.body;
  
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Credenciais inválidas.' });
      }
  
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Credenciais inválidas.' });
      }
  
      const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
      // Inclui o campo redirectTo na resposta
      res.status(200).json({
        token,
        userId: user._id, // Ensure this is included in the response
        message: 'Login realizado com sucesso!',
        redirectTo: '/DashboardHome', // URL para redirecionar o usuário
      });
    } catch (error) {
      console.error('Erro durante o login:', error);
      res.status(500).json({ message: 'Erro interno no servidor.' });
    }
  }
}


module.exports = AuthController;