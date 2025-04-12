const BCHJS = require('@psf/bch-js');
const axios = require('axios');

// Inicializa o BCHJS para testnet (pode ser alterado para mainnet)
const bchjs = new BCHJS({ restURL: 'https://testnet3.fullstack.cash/v3/' });

/**
 * Gera um novo par de chaves (privada/pública) e retorna o endereço BCH.
 * @returns {object} - Contém a chave privada (WIF), chave pública e endereço BCH.
 */
async function generateAddress() {
  try {
    const mnemonic = bchjs.Mnemonic.generate(128); // Gera uma frase mnemônica
    const rootSeed = await bchjs.Mnemonic.toSeed(mnemonic);
    const hdNode = bchjs.HDNode.fromSeed(rootSeed, 'testnet'); // Use 'mainnet' para mainnet

    const keyPair = bchjs.HDNode.toKeyPair(hdNode);
    const wif = bchjs.HDNode.toWIF(hdNode); // Chave privada no formato WIF
    const publicKey = bchjs.HDNode.toPublicKey(hdNode);
    const address = bchjs.HDNode.toCashAddress(hdNode);

    return { mnemonic, wif, publicKey: publicKey.toString('hex'), address };
  } catch (error) {
    console.error('Erro ao gerar endereço:', error.message);
    throw new Error('Erro ao gerar endereço BCH.');
  }
}

/**
 * Valida se um endereço BCH é válido.
 * @param {string} address - O endereço BCH a ser validado.
 * @returns {boolean} - Retorna true se o endereço for válido, caso contrário false.
 */
function validateAddress(address) {
  try {
    return bchjs.Address.isCashAddress(address);
  } catch (error) {
    console.error('Erro ao validar endereço:', error.message);
    return false;
  }
}

/**
 * Retorna o saldo do endereço BCH.
 * @param {string} address - O endereço BCH.
 * @returns {object} - Saldo do endereço (mockado ou via API pública).
 */
async function getBalance(address) {
  try {
    const response = await axios.get(`https://testnet3.fullstack.cash/v3/address/details/${address}`);
    return {
      balance: response.data.balance,
      unconfirmedBalance: response.data.unconfirmedBalance,
    };
  } catch (error) {
    console.error('Erro ao obter saldo:', error.message);
    throw new Error('Erro ao obter saldo do endereço BCH.');
  }
}

/**
 * Envia BCH de uma carteira para outra.
 * @param {string} fromWif - A chave privada (WIF) da carteira de origem.
 * @param {string} toAddress - O endereço BCH de destino.
 * @param {number} amount - O valor a ser enviado (em BCH).
 * @returns {string} - ID da transação (txid).
 */
async function sendTransaction(fromWif, toAddress, amount) {
  try {
    const ecPair = bchjs.ECPair.fromWIF(fromWif, 'testnet'); // Use 'mainnet' para mainnet
    const fromAddress = bchjs.ECPair.toCashAddress(ecPair);

    // Obtém UTXOs (Unspent Transaction Outputs) do endereço de origem
    const utxosResponse = await axios.get(`https://testnet3.fullstack.cash/v3/address/utxo/${fromAddress}`);
    const utxos = utxosResponse.data.utxos;

    if (utxos.length === 0) {
      throw new Error('Saldo insuficiente.');
    }

    // Cria uma transação
    const transactionBuilder = new bchjs.TransactionBuilder('testnet');
    let originalAmount = 0;

    utxos.forEach((utxo) => {
      transactionBuilder.addInput(utxo.txid, utxo.vout);
      originalAmount += utxo.satoshis;
    });

    const satoshisToSend = bchjs.BitcoinCash.toSatoshi(amount);
    const fee = 250; // Taxa estimada (em satoshis)
    const change = originalAmount - satoshisToSend - fee;

    if (change < 0) {
      throw new Error('Saldo insuficiente para cobrir a transação e a taxa.');
    }

    // Adiciona saída para o destinatário
    transactionBuilder.addOutput(toAddress, satoshisToSend);

    // Adiciona saída para o troco (se houver)
    if (change > 0) {
      transactionBuilder.addOutput(fromAddress, change);
    }

    // Assina cada entrada
    utxos.forEach((utxo, index) => {
      transactionBuilder.sign(index, ecPair, null, transactionBuilder.hashTypes.SIGHASH_ALL, utxo.satoshis);
    });

    // Constrói e transmite a transação
    const tx = transactionBuilder.build();
    const txHex = tx.toHex();

    const broadcastResponse = await axios.post('https://testnet3.fullstack.cash/v3/rawtransactions/sendRawTransaction', {
      hex: txHex,
    });

    return broadcastResponse.data;
  } catch (error) {
    console.error('Erro ao enviar transação:', error.message);
    throw new Error('Erro ao enviar transação BCH.');
  }
}

module.exports = { generateAddress, validateAddress, getBalance, sendTransaction };