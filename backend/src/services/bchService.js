// backend/src/services/bchService.js

const ElectrumClient = require('electrum-client');
const BCHJS = require('@psf/bch-js'); // Importa a biblioteca bch-js
const config = require('../config'); // Importa a configuração da rede
const { FULCRUM_SERVERS } = require('../config/fullcrumConfig'); // Importa FULCRUM_SERVERS do fullcrumConfig
const logger = require('../utils/logger'); // Importe seu logger

const bchjs = new BCHJS();

/**
 * @desc Obtém a altura do bloco atual de um servidor Electrum.
 * @returns {Promise<number>} A altura do bloco atual.
 */
async function getCurrentBlockHeight() {
    let client = null;
    try {
        const server = FULCRUM_SERVERS[0]; // Usa o primeiro servidor da lista FULCRUM_SERVERS
        client = new ElectrumClient(server.host, server.port, server.protocol);
        await client.connect();
        const response = await client.blockchainHeadersSubscribe(); // Assina para obter o cabeçalho mais recente
        await client.close(); // Fecha a conexão
        return response.height;
    } catch (error) {
        if (client) await client.close();
        logger.error(`[bchService] Erro ao buscar altura do bloco atual: ${error.message}`);
        throw new Error('Não foi possível obter a altura do bloco atual da blockchain.');
    }
}

/**
 * @desc Gera um endereço BCH.
 */
async function generateAddress() {
    const mnemonic = bchjs.Mnemonic.generate(128); // Generate a mnemonic
    const seedBuffer = await bchjs.Mnemonic.toSeed(mnemonic);
    const hdNode = bchjs.HDNode.fromSeed(seedBuffer);
    const childNode = bchjs.HDNode.derivePath(hdNode, "m/44'/145'/0'/0/0");
    const address = bchjs.HDNode.toCashAddress(childNode);

    return {
        mnemonic,
        address,
        derivationPath: "m/44'/145'/0'/0/0",
    };
}

module.exports = {
    getCurrentBlockHeight,
    generateAddress,
};