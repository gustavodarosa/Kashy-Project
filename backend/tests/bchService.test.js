const userController = require('../src/controllers/userController');
const User = require('../src/models/user'); // Correct path for model

// Mock the service this controller depends on
jest.mock('../src/services/bchService', () => ({
    generateAddress: jest.fn(),
    getBalance: jest.fn(),
    // Add mocks for any other bchService functions used by userController
}));
// You also need to require the mocked service *after* jest.mock
const bchService = require('../src/services/bchService');

// Mock cryptoUtils (looks like you already have this, ensure path is correct)
jest.mock('../src/utils/cryptoUtils', () => ({
    encrypt: jest.fn(() => 'mock-encrypted-data'),
    decrypt: jest.fn(() => 'mock-decrypted-mnemonic'),
}));
const cryptoUtils = require('../src/utils/cryptoUtils');

// Mock the User model (you already have this)
jest.mock('../src/models/user');


describe('User Controller', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset User mocks if needed
        User.findOne.mockReset();
        User.prototype.save = jest.fn(); // Mock save on prototype
    });

    // --- Test registerUser ---
    it('should register a user and generate wallet details', async () => {
        const req = {
            body: { email: 'newuser@test.com' },
            // Mock validationResult if your controller uses it directly
            // validationResult: jest.fn(() => ({ isEmpty: () => true }))
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn(); // Mock next for error handling

        // Mock User.findOne to show user doesn't exist
        User.findOne.mockResolvedValue(null);

        // Mock bchService.generateAddress response
        const mockWalletDetails = {
            mnemonic: 'mock test mnemonic phrase twelve words',
            wif: 'cMockWif',
            publicKey: 'mockPublicKey',
            address: 'bchtest:qmockaddressgenerated',
            derivationPath: "m/44'/145'/0'/0/0"
        };
        bchService.generateAddress.mockResolvedValue(mockWalletDetails);

        // Mock User.prototype.save response
        const mockSavedUser = {
            _id: 'newUser123',
            email: req.body.email,
            encryptedMnemonic: 'mock-encrypted-data', // From crypto mock
            encryptedDerivationPath: 'mock-encrypted-data', // From crypto mock
            bchAddress: mockWalletDetails.address
        };
        User.prototype.save.mockResolvedValue(mockSavedUser);

        // Mock validationResult (needed by the controller)
        const { validationResult } = require('express-validator');
        validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });


        await userController.registerUser(req, res, next);

        expect(User.findOne).toHaveBeenCalledWith({ email: req.body.email });
        expect(bchService.generateAddress).toHaveBeenCalledTimes(1);
        expect(cryptoUtils.encrypt).toHaveBeenCalledWith(mockWalletDetails.mnemonic, process.env.ENCRYPTION_KEY);
        expect(cryptoUtils.encrypt).toHaveBeenCalledWith(mockWalletDetails.derivationPath, process.env.ENCRYPTION_KEY);
        expect(User.prototype.save).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            _id: mockSavedUser._id,
            email: mockSavedUser.email,
            bchAddress: mockSavedUser.bchAddress,
            message: 'User registered successfully.'
        });
        expect(next).not.toHaveBeenCalled(); // Ensure no error was passed
    });

     it('should return 400 if user already exists during registration', async () => {
        const req = { body: { email: 'existing@test.com' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        // Mock User.findOne to return an existing user
        User.findOne.mockResolvedValue({ _id: 'existing123', email: req.body.email });

        // Mock validationResult
        const { validationResult } = require('express-validator');
        validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });

        await userController.registerUser(req, res, next);

        expect(User.findOne).toHaveBeenCalledWith({ email: req.body.email });
        expect(bchService.generateAddress).not.toHaveBeenCalled();
        expect(User.prototype.save).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'User already exists' });
        expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 if validation fails during registration', async () => {
        const req = { body: { email: 'invalid-email' } }; // Assume invalid
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        // Mock validationResult to return errors
        const { validationResult } = require('express-validator');
        const mockErrors = [{ msg: 'Invalid email', param: 'email' }];
        validationResult.mockReturnValue({ isEmpty: () => false, array: () => mockErrors });

        await userController.registerUser(req, res, next);

        expect(validationResult).toHaveBeenCalledWith(req);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ errors: mockErrors });
        expect(User.findOne).not.toHaveBeenCalled();
        expect(bchService.generateAddress).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });


    // --- Test recoverWallet ---
    it('should recover encrypted wallet data for authenticated user', async () => {
        const req = {
            user: { email: 'authed@test.com' } // Simulate authenticated user
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

         // Mock validationResult (needed by the controller)
        const { validationResult } = require('express-validator');
        validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });

        // Mock User.findOne response
        const mockUserData = {
            _id: 'authed123',
            email: req.user.email,
            encryptedMnemonic: 'encrypted-mnemonic-data',
            encryptedDerivationPath: 'encrypted-path-data',
            bchAddress: 'bchtest:qmockaddress'
        };
        User.findOne.mockResolvedValue(mockUserData);

        await userController.recoverWallet(req, res);

        expect(User.findOne).toHaveBeenCalledWith({ email: req.user.email });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            encryptedMnemonic: mockUserData.encryptedMnemonic,
            encryptedDerivationPath: mockUserData.encryptedDerivationPath,
            bchAddress: mockUserData.bchAddress
        });
    });

     it('should return 404 if wallet data not found during recovery', async () => {
        const req = { user: { email: 'notfound@test.com' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

         // Mock validationResult
        const { validationResult } = require('express-validator');
        validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });

        // Mock User.findOne to return null
        User.findOne.mockResolvedValue(null);

        await userController.recoverWallet(req, res);

        expect(User.findOne).toHaveBeenCalledWith({ email: req.user.email });
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: 'Wallet data not found for this user.' });
    });

    // Remove or adapt the old linkWallet test
    // it('should link a wallet to a user', async () => { ... });
});

// Need to mock express-validator's validationResult as well
jest.mock('express-validator', () => ({
    validationResult: jest.fn(() => ({ isEmpty: () => true, array: () => [] })), // Default mock
    body: jest.fn(() => ({ // Mock the body function used in routes
        isEmail: jest.fn(() => ({ normalizeEmail: jest.fn() })) // Chainable mock
    })),
}));

