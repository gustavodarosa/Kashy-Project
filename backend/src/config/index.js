require('dotenv').config();

// Use module.exports for CommonJS compatibility
module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'YOUR_VERY_SECRET_KEY', // CHANGE THIS!
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173', // Adjust to your frontend port
  network: process.env.BCH_NETWORK || 'mainnet', // 'mainnet' or 'chipnet'
  electrumServers: process.env.ELECTRUM_SERVERS?.split(',') || [
      // Default servers if not in .env
      'wss://electrum.bitcoinunlimited.info:50004', // Example mainnet
      'wss://blackie.c3-soft.com:50004'           // Example mainnet
      // Add chipnet servers if needed
  ],
  // !! VERY INSECURE - FOR DEMO ONLY !! Replace with secure key management
  exampleUserWif: process.env.EXAMPLE_USER_WIF,
  // Add Database connection string if used
  // databaseUrl: process.env.DATABASE_URL,
};
