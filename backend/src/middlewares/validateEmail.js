const { check, validationResult } = require('express-validator');

const validateEmail = [ 
    // Define the check(s)
    check('email', 'Invalid email format')
      .isEmail()
      .normalizeEmail(), 

    // Define the handler for validation results
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // If errors, return 400
            return res.status(400).json({ errors: errors.array() });
        }
        // If no errors, proceed to the next middleware/handler
        next();
    }
];

module.exports = validateEmail; 
