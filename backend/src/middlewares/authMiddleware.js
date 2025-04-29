// z:\Kashy-Project\backend\src\middlewares\authMiddleware.js

// Use CommonJS require syntax
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger'); // Assuming utils/logger.js exists

/**
 * Middleware to verify the JWT token from the Authorization header.
 * If valid, attaches the decoded user payload to `req.user`.
 * If invalid or missing, sends a 401 Unauthorized response.
 */
const protect = (req, res, next) => {
  let token;

  // 1. Check if Authorization header exists and starts with 'Bearer'
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 2. Extract the token (remove 'Bearer ')
      token = req.headers.authorization.split(' ')[1];

      // 3. Verify the token using the secret from environment variables
      // We expect the payload to be an object containing at least an 'id' property.
      // The 'as' keyword is TypeScript; in JS, jwt.verify returns the payload directly or throws.
      const decoded = jwt.verify(token, process.env.JWT_SECRET); // Use process.env

      // 4. Attach the decoded payload (specifically the user ID) to the request object
      //    Ensure the payload actually has an 'id' property.
      if (!decoded || typeof decoded !== 'object' || !decoded.id) {
        logger.error('JWT verification successful but payload is invalid or missing ID.');
        throw new jwt.JsonWebTokenError('Invalid token payload'); // Treat as invalid token
      }

      req.user = {
        id: decoded.id,
        // You could add other decoded properties here if they exist and are needed
        // email: decoded.email,
      };

      logger.info(`Token verified successfully for user ID: ${req.user.id}`);

      // 5. Proceed to the next middleware or route handler
      next();

    } catch (error) {
      // Handle different JWT errors
      let errorMessage = 'Not authorized, token failed.';
      // Use error.name to check JWT error types in JavaScript
      if (error.name === 'TokenExpiredError') {
        errorMessage = 'Not authorized, token expired.';
        logger.warn(`Token expired for user attempt. Token: ${token?.substring(0, 10)}...`);
      } else if (error.name === 'JsonWebTokenError') {
        errorMessage = 'Not authorized, token invalid.';
        logger.warn(`Invalid token received: ${error.message}. Token: ${token?.substring(0, 10)}...`);
      } else {
        // Log other unexpected errors
        logger.error(`Unexpected error during token verification: ${error.message}`, error);
      }
      // Send 401 Unauthorized response
      res.status(401).json({ message: errorMessage });
    }
  }

  // If no token was found in the header
  if (!token) {
    logger.warn('Authorization token missing from request.');
    res.status(401).json({ message: 'Not authorized, no token provided.' });
  }
};

// Use module.exports for CommonJS export
// Exporting an object with 'protect' matches how it's imported in walletRoutes.js
module.exports = {
    protect: protect,
    // Keep the old name if needed for compatibility elsewhere
    authMiddleware: protect
};
