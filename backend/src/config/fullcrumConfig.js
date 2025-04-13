const FULCRUM_SERVERS = [  
    
        
        { host: 'fulcrum.greyh.at', port: 50002, protocol: 'ssl' },
        { host: 'electrum.imaginary.cash', port: 50002, protocol: 'ssl' }, // Duplicate in new list, kept from original
        { host: 'bch.imaginary.cash', port: 50002, protocol: 'ssl' },    // Duplicate in new list, kept from original
        { host: 'bch.soul-dev.com', port: 50002, protocol: 'ssl' },      // Duplicate in new list, kept from original
        { host: 'bch.crypto.mldlabs.com', port: 50002, protocol: 'ssl' },
        { host: 'bch0.kister.net', port: 50002, protocol: 'ssl' }, // Note: Port 60002 failed before, trying 50002
        { host: 'bch.loping.net', port: 50002, protocol: 'ssl' },
        { host: 'blackie.c3-soft.com', port: 50002, protocol: 'ssl' },
        { host: 'electron.jochen-hoenicke.de', port: 51002, protocol: 'ssl' }, // Note: Different port
        { host: 'electroncash.dk', port: 50002, protocol: 'ssl' },
        { host: 'bch2.electroncash.dk', port: 50002, protocol: 'ssl' },
        { host: 'electroncash.de', port: 50002, protocol: 'ssl' }, // Note: Port 60002 failed before, trying 50002
        { host: 'fulcrum2.electroncash.de', port: 50002, protocol: 'ssl' },
        { host: 'electrs.bitcoinunlimited.info', port: 50002, protocol: 'ssl' },
        { host: 'bch.cyberbits.eu', port: 50002, protocol: 'ssl' },
        { host: 'bitcoincash.network', port: 50002, protocol: 'ssl' },
        { host: 'electrum.bitcoinverde.org', port: 50002, protocol: 'ssl' },
        { host: 'cashnode.bch.ninja', port: 50002, protocol: 'ssl' },
        { host: 'fulcrum.criptolayer.net', port: 50002, protocol: 'ssl' },
        { host: 'fulcrum.jettscythe.xyz', port: 50002, protocol: 'ssl' },
        { host: 'fulcrum.aglauck.com', port: 50002, protocol: 'ssl' },
        { host: 'node.minisatoshi.cash', port: 50002, protocol: 'ssl' },
    ];

module.exports = {
    FULCRUM_SERVERS,
};