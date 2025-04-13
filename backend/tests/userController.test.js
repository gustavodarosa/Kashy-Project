const userController = require('../src/controllers/userController');
const User = require('../src/models/user'); // Correct path for model

jest.mock('../src/utils/cryptoUtils', () => ({ // Add 'src/' to the path
    encrypt: jest.fn(() => 'mock-encrypted-data'),
    decrypt: jest.fn(() => 'mock-decrypted-mnemonic'),  
}));
  
  it('should link a wallet to a user', async () => {
    User.findOne.mockResolvedValue({ email: 'test@example.com', encryptedMnemonic: 'mock-encrypted-data' });
    const req = { body: { userIdentifier: 'test@example.com' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  
    await userController.linkWallet(req, res);
  
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ address: 'mock-address' });
  });