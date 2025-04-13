// testFulcrumConnection.js
const ElectrumClient = require('electrum-client');
const { FULCRUM_SERVERS } = require('./src/config/fullcrumConfig');


const ELECTRUM_PROTOCOL_VERSION = '1.4';
const CONNECTION_TIMEOUT_MS = 10000; // 10 seconds

// --- Test Function ---
async function testConnections() {
    console.log('--- Testing Fulcrum Server Connections ---');
    let successfulConnections = 0;

    for (const server of FULCRUM_SERVERS) {
        const serverId = `${server.host}:${server.port} (${server.protocol})`;
        console.log(`\nAttempting to connect to: ${serverId}`);
        let client = null; // Define client here to access in finally block

        try {
            client = new ElectrumClient(server.port, server.host, server.protocol);

            // Connect with timeout
            console.log(` -> Connecting... (Timeout: ${CONNECTION_TIMEOUT_MS / 1000}s)`);
            const connectPromise = client.connect('kashy-connection-test', ELECTRUM_PROTOCOL_VERSION);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT_MS)
            );
            await Promise.race([connectPromise, timeoutPromise]);
            console.log(' -> Connection established.');

            // Handshake (check version compatibility)
            console.log(' -> Performing version handshake...');
            await client.server_version('kashy-connection-test', ELECTRUM_PROTOCOL_VERSION);
            console.log(' -> Version handshake successful.');

            console.log(`✅ SUCCESS: Connected and verified version for ${serverId}`);
            successfulConnections++;

        } catch (err) {
            console.error(`❌ FAILED: Could not connect or verify version for ${serverId}`);
            console.error(`   Error: ${err.message}`);
            // More detailed error logging if needed:
            // if (err.stack) console.error(err.stack);

        } finally {
            // Ensure the client connection is closed after each attempt
            if (client) {
                // console.log(` -> Closing connection to ${serverId}`);
                try {
                    await client.close();
                } catch (closeErr) {
                    // Ignore errors during close in this test script
                }
            }
        }
    }

    // --- Summary ---
    console.log('\n--- Test Summary ---');
    console.log(`Tested ${FULCRUM_SERVERS.length} servers.`);
    console.log(`Successfully connected to ${successfulConnections} server(s).`);

    if (successfulConnections === 0 && FULCRUM_SERVERS.length > 0) {
        console.warn('\n⚠️ WARNING: Could not connect to any specified Fulcrum servers.');
        console.warn('   Check your internet connection, firewall settings, and the server list.');
    } else {
        console.log('\nConnection test complete.');
    }
}

// --- Run the Test ---
testConnections().catch(error => {
    console.error("\n--- UNEXPECTED SCRIPT ERROR ---");
    console.error(error);
    process.exit(1); // Exit with error code
});
