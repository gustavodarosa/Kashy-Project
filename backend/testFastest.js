// z:\Kashy-Project\backend\rankBlockNotifiers.js (New file name suggested)
require('dotenv').config();
const ElectrumClient = require('electrum-client');
const { FULCRUM_SERVERS } = require('./src/config/fullcrumConfig');
// No BCHJS or crypto needed for this specific test

// --- Configuration ---
const TEST_DURATION_MS = 15 * 60 * 1000; // How long to listen for a new block (e.g., 15 minutes)
const CONNECT_TIMEOUT_MS = 10000; // Timeout for initial connection
const REQUEST_TIMEOUT_MS = 15000; // Timeout for subscribe request (less critical here)
const ELECTRUM_PROTOCOL_VERSION = '1.4';
// --- End Configuration ---

// --- Utilities ---
function withTimeout(promise, ms, timeoutMessage = 'Operation timed out') {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(timeoutMessage));
        }, ms);
    });
    return Promise.race([
        promise.finally(() => clearTimeout(timer)),
        timeoutPromise
    ]);
}
// --- End Utilities ---


async function rankBlockNotifiers() {
    console.log(`--- Ranking Server Block Header Notification Speed ---`);
    console.log(`Test Duration: ${TEST_DURATION_MS / 1000 / 60} minutes`);
    console.log(`Connect Timeout: ${CONNECT_TIMEOUT_MS / 1000} seconds`);
    console.log(`Request Timeout: ${REQUEST_TIMEOUT_MS / 1000} seconds`);
    console.log(`\n>>> Waiting for the next BCH block to be mined... <<<`);

    const clients = []; // Store clients for cleanup
    // Store results keyed by block height, then server
    // e.g., { 800000: [{ serverId: '...', timeMs: 1234 }, ...], 800001: [...] }
    const resultsByHeight = {};
    let firstNewBlockHeight = null;
    const startTime = Date.now();

    // Promise that resolves when the test duration is over
    let testEndResolver;
    const testEndPromise = new Promise(resolve => {
        testEndResolver = resolve;
    });

    // Overall timer for the test duration
    const timeoutHandle = setTimeout(() => {
        console.log(`\n--- Test duration (${TEST_DURATION_MS / 1000 / 60} minutes) ended ---`);
        if (testEndResolver) {
             testEndResolver(); // Resolve the promise to end the waiting period
        }
    }, TEST_DURATION_MS);

    console.log("\nConnecting to servers and subscribing to headers...");

    // Start connection/subscription attempts
    const connectionSetupPromises = FULCRUM_SERVERS.map(async (server) => {
        const serverId = `${server.host}:${server.port} (${server.protocol})`;
        let client = null;
        const connectionStartTime = Date.now();

        try {
            client = new ElectrumClient(server.port, server.host, server.protocol);

            await withTimeout(
                client.connect('kashy-block-rank-test', ELECTRUM_PROTOCOL_VERSION),
                CONNECT_TIMEOUT_MS,
                `Connection timeout to ${serverId}`
            );

            clients.push({ client, serverId }); // Keep track for cleanup

            client.onClose = () => {
                 const closeTime = Date.now();
                 if (Date.now() < startTime + TEST_DURATION_MS) {
                    console.warn(` -> [${(closeTime - startTime)}ms] Connection to ${serverId} closed unexpectedly.`);
                 }
            };

            // Subscribe to block headers
            const initialHeader = await withTimeout(
                client.request('blockchain.headers.subscribe', []), // No params needed
                REQUEST_TIMEOUT_MS,
                `Header subscribe timeout for ${serverId}`
            );
            console.log(` -> [${(Date.now() - connectionStartTime)}ms] Subscribed to headers on ${serverId}. Initial height: ${initialHeader?.height || 'N/A'}`);

            // Attach listener for header notifications
            client.subscribe.on('blockchain.headers.subscribe', (params) => {
                // Notification is an array containing the header object
                if (params && Array.isArray(params) && params.length === 1 && typeof params[0] === 'object') {
                    const header = params[0];
                    const height = header.height;
                    const timeReceived = Date.now();
                    const timeTaken = timeReceived - startTime;

                    // console.log(`>>> [${timeTaken}ms] Header received from ${serverId}. Height: ${height}`); // Optional debug

                    // If this is the first *new* block we've seen in this test run
                    if (firstNewBlockHeight === null && height > (initialHeader?.height || 0)) {
                        firstNewBlockHeight = height;
                        console.log(`\n🏁 First new block detected! Height: ${firstNewBlockHeight}`);
                    }

                    // If this notification is for the target block height we are tracking
                    if (height === firstNewBlockHeight) {
                        // Initialize results array for this height if needed
                        if (!resultsByHeight[height]) {
                            resultsByHeight[height] = [];
                        }
                        // Record only the first notification for this block from this server
                        if (!resultsByHeight[height].some(r => r.serverId === serverId)) {
                             console.log(`   -> [${timeTaken}ms] ${serverId} reported block ${height}`);
                             resultsByHeight[height].push({ serverId: serverId, timeMs: timeTaken });
                        }
                    }
                }
            });

        } catch (error) {
            console.warn(` -> Failure during setup for ${serverId}: ${error.message}`);
            if (client && !clients.find(c => c.client === client)) {
                 try { await client.close(); } catch (e) { /* ignore */ }
            }
        }
    });

    // Log connection setup errors after they settle
    Promise.allSettled(connectionSetupPromises).then(() => {
        console.log(`DEBUG: All connection/subscription attempts finished (settled).`);
    });

    // --- Wait HERE for the test duration to complete ---
    console.log("DEBUG: Waiting for test duration to end...");
    await testEndPromise; // This promise is resolved by the setTimeout
    console.log(`DEBUG: Test duration finished.`);
    // --- End Wait ---

    // Cleanup
    clearTimeout(timeoutHandle);
    console.log("\n--- Cleaning up connections ---");
    const closePromises = clients.map(async ({ client, serverId }) => {
        try { await client.close(); } catch (e) { /* ignore */ }
    });
    await Promise.allSettled(closePromises);


    console.log("\n--- Test Finished ---");

    // --- Rank and Display Results for the first new block found ---
    if (firstNewBlockHeight !== null && resultsByHeight[firstNewBlockHeight]) {
        const results = resultsByHeight[firstNewBlockHeight];
        console.log(`\n--- Block Header Notification Ranking (Block: ${firstNewBlockHeight}, ${results.length} servers responded) ---`);
        // Sort results by time ascending
        results.sort((a, b) => a.timeMs - b.timeMs);
        // Display ranked list
        results.forEach((result, index) => {
            // Calculate time relative to the *first* server that reported this block
            const relativeTime = result.timeMs - results[0].timeMs;
            console.log(`${index + 1}. ${result.serverId} - ${result.timeMs} ms (+${relativeTime} ms)`);
        });
    } else if (firstNewBlockHeight !== null) {
         console.log(`\nNo servers reported the first new block (Height: ${firstNewBlockHeight}) within the test duration.`);
    } else {
         console.log("\nNo new blocks were detected during the test duration.");
    }
    // --- End Ranking ---
}

// --- Run the Test ---
rankBlockNotifiers().catch(error => {
    console.error("\n--- UNEXPECTED SCRIPT ERROR ---");
    console.error(error);
    process.exit(1);
});
