// backend/src/services/bchService.js

const ElectrumClient = require('electrum-client');
const BCHJS = require('@psf/bch-js'); // Importa a biblioteca bch-js
const config = require('../config'); // Importa a configuração da rede
const { FULCRUM_SERVERS } = require('../config/fullcrumConfig'); // Importa FULCRUM_SERVERS do fullcrumConfig
const logger = require('../utils/logger'); // Importe seu logger

// Inicializa bch-js com a rede correta
const network = config.network === 'testnet' ? 'testnet' : 'mainnet';
const bchjs = new BCHJS({ restURL: network === 'testnet' ? 'https://api.testnet.cash' : 'https://api.mainnet.cash' });

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
 * @desc Gera um novo endereço BCH, mnemonic e caminho de derivação.
 * @returns {Promise<{mnemonic: string, derivationPath: string, address: string}>} Detalhes da nova carteira.
 */
async function generateAddress() {
    try {
        // Gera um novo mnemonic de 12 palavras (128 bits de entropia)
        const mnemonic = bchjs.Mnemonic.generate(128);

        // Deriva o seed raiz do mnemonic
        const rootSeedBuffer = await bchjs.Mnemonic.toSeed(mnemonic);

        // Cria o HDNode mestre
        const masterHDNode = bchjs.HDNode.fromSeed(rootSeedBuffer, network);

        // Caminho de derivação BIP44 para BCH: m/44'/145'/0'/0/0 (external chain, first address)
        const derivationPath = `m/44'/145'/0'/0/0`;
        const childNode = masterHDNode.derivePath(derivationPath);

        // Obtém o endereço Cash Address
        const address = bchjs.HDNode.toCashAddress(childNode);

        logger.info(`[bchService] Generated new wallet: ${address}`);
        return { mnemonic, derivationPath, address };
    } catch (error) {
        logger.error(`[bchService] Erro ao gerar novo endereço BCH: ${error.message}`);
        throw new Error(`Erro ao gerar endereço BCH: ${error.message}`);
    }
}

module.exports = {
    getCurrentBlockHeight,
    generateAddress, // Exporta a nova função
};