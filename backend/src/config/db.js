// backend/src/config/db.js (Example using Mongoose - Keep your existing one)
const mongoose = require('mongoose');
const logger = require('../utils/logger'); // Assuming you have a logger

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Mongoose 6+ doesn't need these options anymore
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn; // Return connection object
  } catch (error) {
    logger.error(`MongoDB Connection Error: ${error.message}`);
    logger.error('MongoDB connection failed, retrying in 5 seconds...');
    // Consider more robust retry or exit logic
    setTimeout(connectDB, 5000);
    // process.exit(1); // Or exit if connection is critical on startup
  }
};

module.exports = connectDB;