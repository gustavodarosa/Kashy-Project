// src/server.js
require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const spvMonitorService = require('./services/spvMonitorService'); // Import
const mongoose = require('mongoose');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('MongoDB Connected.');

    // --- DEBUGGING LINES ---
    console.log('--- Debugging spvMonitorService ---');
    console.log('Type:', typeof spvMonitorService);
    console.log('Value:', spvMonitorService);
    if (spvMonitorService && typeof spvMonitorService === 'object') {
        console.log('Keys:', Object.keys(spvMonitorService));
        console.log('Has start function?', typeof spvMonitorService.start === 'function');
    }
    console.log('--- End Debugging ---');
    // --- END DEBUGGING LINES ---

    console.log('Starting SPV Monitor Service...');
    await spvMonitorService.start(); // Line 26 (now maybe line 33 or so)

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('FATAL: Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// ... graceful shutdown ...
