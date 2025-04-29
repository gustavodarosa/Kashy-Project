// z:\Kashy-Project\backend\src\utils\asyncUtils.js
const logger = require('./logger'); // Assuming logger exists

/**
 * Wraps a promise with a timeout.
 * @param {Promise<any>} promise The promise to wrap.
 * @param {number} ms Timeout duration in milliseconds.
 * @param {string} [timeoutMessage='Operation timed out'] Message for the timeout error.
 * @returns {Promise<any>}
 */
function withTimeout(promise, ms, timeoutMessage = 'Operation timed out') {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(timeoutMessage));
        }, ms);

        promise
            .then(value => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch(err => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

/**
 * Returns the result of the first promise in the array that resolves successfully.
 * If all promises reject, it rejects with the error of the last promise encountered.
 * @param {Array<Promise<any>>} promises Array of promises to race.
 * @returns {Promise<any>}
 */
function raceSuccess(promises) {
    return new Promise((resolve, reject) => {
        let remaining = promises.length;
        let lastError = new Error('No promises provided or all promises rejected.'); // Default error

        if (remaining === 0) {
            return reject(lastError);
        }

        promises.forEach(promise => {
            Promise.resolve(promise) // Ensure we handle non-promise values gracefully if passed
                .then(value => {
                    // Resolve with the first successful result
                    resolve(value);
                    // Set remaining to 0 to prevent further rejection checks (optional optimization)
                    remaining = 0;
                })
                .catch(error => {
                    remaining--;
                    lastError = error; // Store the latest error
                    if (remaining === 0) {
                        // If all promises have failed, reject with the last error
                        reject(lastError);
                    }
                });
        });
    });
}


module.exports = {
    withTimeout,
    raceSuccess,
};
