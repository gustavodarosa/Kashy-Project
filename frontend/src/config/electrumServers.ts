// frontend/src/config/electrumServers.ts

// Define the type for clarity
type ElectrumServer = {
    host: string;
    port: number;
    protocol: 'ssl' | 'tcp'; // Add other protocols if needed
};

// Copied and adapted from backend/src/config/fullcrumConfig.js
// Ranked by notification speed test (according to backend file)
// Updated based on frontend connection failures (commented out failures)
export const FULCRUM_SERVERS: ElectrumServer[] = [
    // --- Servers that failed connection attempts ---
    // { host: 'blackie.c3-soft.com', port: 50002, protocol: 'ssl' },
    // { host: 'fulcrum.criptolayer.net', port: 50002, protocol: 'ssl' },
    // { host: 'bitcoincash.network', port: 50002, protocol: 'ssl' },
    // { host: 'cashnode.bch.ninja', port: 50002, protocol: 'ssl' },
    // { host: 'fulcrum.aglauck.com', port: 50002, protocol: 'ssl' },
    // { host: 'fulcrum2.electroncash.de', port: 50002, protocol: 'ssl' },
    // { host: 'node.minisatoshi.cash', port: 50002, protocol: 'ssl' },
    // { host: 'bch.soul-dev.com', port: 50002, protocol: 'ssl' },
    // { host: 'bch.imaginary.cash', port: 50002, protocol: 'ssl' },
    // { host: 'bch0.kister.net', port: 50002, protocol: 'ssl' },
    // { host: 'electrum.imaginary.cash', port: 50002, protocol: 'ssl' },
    // { host: 'electroncash.de', port: 50002, protocol: 'ssl' },
    // { host: 'electron.jochen-hoenicke.de', port: 51002, protocol: 'ssl' }, // Note Port
    // { host: 'bch.cyberbits.eu', port: 50002, protocol: 'ssl' },
    // { host: 'fulcrum.greyh.at', port: 50002, protocol: 'ssl' },
    // { host: 'bch.loping.net', port: 50002, protocol: 'ssl' },
    // { host: 'electrs.bitcoinunlimited.info', port: 50002, protocol: 'ssl' },
    // { host: 'electroncash.dk', port: 50002, protocol: 'ssl' },

    // --- Servers potentially working (or not in error list) ---
     // Wasn't in the error list

    // --- Known WSS servers on port 50004 ---
    { host: 'bch.imaginary.cash', port: 50004, protocol: 'ssl' },
    { host: 'blackie.c3-soft.com', port: 50004, protocol: 'ssl' },
    // { host: 'fulcrum.fountainhead.cash', port: 50004, protocol: 'ssl' }, // Often cited but check status

    // --- Servers That Did Not Respond/Notify in Time (or failed connection in backend test) ---
    // Keep commented out or handle as lower priority fallbacks
    // { host: 'bch.crypto.mldlabs.com', port: 50002, protocol: 'ssl' },
    // { host: 'bch2.electroncash.dk', port: 50002, protocol: 'ssl' },
    // { host: 'electrum.bitcoinverde.org', port: 50002, protocol: 'ssl' },
];

// Helper to get WSS URLs from the list
export function getWssServerUrls(): string[] {
    return FULCRUM_SERVERS
        .filter(server => server.protocol === 'ssl') // Ensure only 'ssl' protocol is used for wss://
        .map(server => `wss://${server.host}:${server.port}`);
        // Optional: Add randomization or use ranking if needed
        // .sort(() => Math.random() - 0.5); // Randomize
}
