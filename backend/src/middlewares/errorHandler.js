const errorHandler = (err, req, res, next) => {
    console.error("Error Caught:", err.message); // Log the error message
    // console.error(err.stack); // Optionally log the full stack

    const statusCode = err.statusCode || 500; // Default to 500 Internal Server Error

    res.status(statusCode).json({
        success: false,
        status: statusCode,
        message: err.message || 'An unexpected error occurred',
        // Only include stack in development for security reasons
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

// --- Make sure you are exporting the function itself ---
module.exports = errorHandler;
