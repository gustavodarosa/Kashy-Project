// Ranked by notification speed test on [Date/Time of your test]
// Lower ms is better. This ranking can fluctuate.
const FULCRUM_SERVERS_RANKED_BY_NOTIFICATION = [
    // --- Top Performers in Test ---
    { host: 'blackie.c3-soft.com', port: 50002, protocol: 'ssl' },        // ~33.8s
    { host: 'fulcrum.criptolayer.net', port: 50002, protocol: 'ssl' },    // ~36.4s
    { host: 'bitcoincash.network', port: 50002, protocol: 'ssl' },        // ~36.6s
    { host: 'cashnode.bch.ninja', port: 50002, protocol: 'ssl' },         // ~36.7s
    { host: 'fulcrum.aglauck.com', port: 50002, protocol: 'ssl' },        // ~36.7s
    { host: 'fulcrum2.electroncash.de', port: 50002, protocol: 'ssl' },   // ~36.7s
    { host: 'node.minisatoshi.cash', port: 50002, protocol: 'ssl' },      // ~37.1s
    { host: 'bch.soul-dev.com', port: 50002, protocol: 'ssl' },           // ~37.1s
    { host: 'bch.imaginary.cash', port: 50002, protocol: 'ssl' },         // ~37.3s
    { host: 'bch0.kister.net', port: 50002, protocol: 'ssl' },            // ~37.3s
    { host: 'electrum.imaginary.cash', port: 50002, protocol: 'ssl' },    // ~37.4s
    { host: 'electroncash.de', port: 50002, protocol: 'ssl' },            // ~37.4s
    { host: 'fulcrum.jettscythe.xyz', port: 50002, protocol: 'ssl' },     // ~37.6s
    { host: 'electron.jochen-hoenicke.de', port: 51002, protocol: 'ssl' },// ~37.7s (Note Port)
    { host: 'bch.cyberbits.eu', port: 50002, protocol: 'ssl' },           // ~38.2s
    { host: 'fulcrum.greyh.at', port: 50002, protocol: 'ssl' },           // ~38.3s
    { host: 'bch.loping.net', port: 50002, protocol: 'ssl' },             // ~38.4s
    { host: 'electrs.bitcoinunlimited.info', port: 50002, protocol: 'ssl' },// ~39.4s
    { host: 'electroncash.dk', port: 50002, protocol: 'ssl' },            // ~40.2s

    // --- Servers That Did Not Respond/Notify in Time (or failed connection) ---
    // Keep these commented out or at the end if you want them as potential fallbacks
    // { host: 'bch.crypto.mldlabs.com', port: 50002, protocol: 'ssl' }, // Failed in test
    // { host: 'bch2.electroncash.dk', port: 50002, protocol: 'ssl' },    // Failed in test
    // { host: 'electrum.bitcoinverde.org', port: 50002, protocol: 'ssl' },// Failed in test
];

module.exports = {
    // You can export the ranked list directly if you only want to use that
    FULCRUM_SERVERS: FULCRUM_SERVERS_RANKED_BY_NOTIFICATION,

    // Or keep the original name pointing to the ranked list
    // FULCRUM_SERVERS: FULCRUM_SERVERS_RANKED_BY_NOTIFICATION,

    // Or export both if you want access to the original unranked list elsewhere
    // ORIGINAL_FULCRUM_SERVERS: [ /* Paste original list here if needed */ ],
    // RANKED_FULCRUM_SERVERS: FULCRUM_SERVERS_RANKED_BY_NOTIFICATION,
};
