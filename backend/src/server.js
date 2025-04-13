// c:\Users\bruce lixo\OneDrive - SENAC-SC\kashy\Kashy-Project\backend\src\server.js
// (Assuming this file is actually in backend/src/ - if it's in backend/, adjust paths below)
// If server.js is in backend/ (one level up), the require paths would be:
// require('./src/app'), require('./src/config/db'), require('./src/services/spvMonitorService')

require('dotenv').config();
const app = require('./app'); // Loads the configured Express app from app.js
const connectDB = require('./config/db'); // Your DB connection function
const spvMonitorService = require('./services/spvMonitorService'); // Import the SPV service
const mongoose = require('mongoose'); // Often needed for graceful shutdown disconnect

const PORT = process.env.PORT || 3000;

// Wrap startup logic in an async function to handle await for DB connection
const startServer = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB(); // Wait for the database connection to complete
    console.log('MongoDB Connected.');

    // ----> START THE SPV MONITOR SERVICE HERE <----
    console.log('Starting SPV Monitor Service...');
    // We call start() but don't necessarily need to await it fully
    // if we want the HTTP server to start listening concurrently.
    // However, awaiting ensures the initial connection attempt/user fetch begins.
    await spvMonitorService.start();
    // The service will log its own connection/subscription progress.
    console.log('SPV Monitor Service initiated.');

    // Start the HTTP server AFTER the DB is connected and SPV service is starting
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('FATAL: Failed to start server:', error);
    process.exit(1); // Exit the process if critical startup fails
  }
};

// Execute the server startup
startServer();

// Optional: Add Graceful Shutdown Logic
process.on('SIGINT', async () => {
  console.log('\nSIGINT received. Shutting down gracefully...');
  try {
    await spvMonitorService.stop(); // Tell the monitor service to disconnect/clean up
    await mongoose.disconnect(); // Close the MongoDB connection
    console.log('SPV Monitor stopped. MongoDB disconnected.');
    process.exit(0); // Exit cleanly
  } catch (err) {
    console.error('Error during graceful shutdown:', err);
    process.exit(1); // Exit with error if shutdown fails
  }
});

// Optional: Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Consider shutting down gracefully here as well, or logging more details
  // process.exit(1); // Optionally exit on unhandled rejections
});
