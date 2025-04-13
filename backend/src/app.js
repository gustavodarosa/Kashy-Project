const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const userRoutes = require('./routes/userRoutes');

const errorHandler = require('./middlewares/errorHandler');
require('dotenv').config(); // Load env vars

const app = express();

// Middleware
app.use(cors()); // Apply CORS
app.use(express.json()); // Crucial for parsing JSON request bodies
app.use(express.urlencoded({ extended: true })); // Optional, for form data
app.use('/api/users', userRoutes);

// Mount API routes
app.use('/api', routes); // Make sure this line exists and is correct

// Global error handler (should be last)
app.use(errorHandler);

module.exports = app; // Export the app instance
