require('dotenv').config(); // Load environment variables
// Correct import name based on package.json (usually 'bitcoincashjs-lib' or similar if using older versions, but @psf/bch-js is common now)
const BCHJS = require('@psf/bch-js'); // Assuming this is the correct package name installed

// --- Configuration ---
const isTestnet = process.env.BCH_NETWORK === 'testnet';
const network = isTestnet ? 'testnet' : 'mainnet';
const BCH_MAINNET_API_URL = process.env.BCH_MAINNET_API || 'https://free-main.fullstack.cash/v3/';
const BCH_TESTNET_API_URL = process.env.BCH_TESTNET_API || 'https://free-test.fullstack.cash/v3/';

// Instance for REST API interactions (keep this)
const bchjs = new BCHJS({ restURL: isTestnet ? BCH_TESTNET_API_URL : BCH_MAINNET_API_URL });

const DEFAULT_DERIVATION_PATH = "m/44'/145'/0'/0/0";
// --- End Configuration ---

/**
 * Generates a new BCH address and wallet details using bch-js.
 * @returns {object} - Contains mnemonic, private key (WIF), public key, and address.
 */
const generateAddress = async () => {
  try {
    const mnemonic = bchjs.Mnemonic.generate(128); // Gera uma frase mnemônica
    const rootSeed = await bchjs.Mnemonic.toSeed(mnemonic);
    const hdNode = bchjs.HDNode.fromSeed(rootSeed);
    const childNode = bchjs.HDNode.derivePath(hdNode, "m/44'/145'/0'/0/0");
    const address = bchjs.HDNode.toCashAddress(childNode);

    return {
      mnemonic,
      derivationPath: "m/44'/145'/0'/0/0",
      address,
    };
  } catch (error) {
    console.error('Erro ao gerar endereço BCH:', error);
    throw new Error('Erro ao gerar endereço BCH.');
  }
};

/**
 * Validates if a BCH address is valid using bch-js.
 * @param {string} address - The BCH address to validate.
 * @returns {boolean} - Returns true if the address is valid, otherwise false.
 */
function validateAddress(address) {
  try {
    // --- Use static method from BCHJS.Address ---
    return BCHJS.Address.isCashAddress(address);
  } catch (error) {
    console.error('Error validating address with bch-js:', error.message);
    return false;
  }
}

/**
 * Gets the balance of a BCH address using bch-js (via REST instance).
 * @param {string} address - The BCH address.
 * @returns {Promise<object>} - Balance of the address in BCH.
 */
async function getBalance(address) {
  try {
    // Converte o endereço para formato CashAddress
    const cashAddress = bchjs.Address.toCashAddress(address);

    // Obtém o saldo usando a API ElectrumX
    const balanceResult = await bchjs.Electrumx.balance(cashAddress);

    if (!balanceResult || !balanceResult.success || !balanceResult.balance) {
      console.error('Resposta de saldo inválida:', balanceResult);
      throw new Error('Falha ao obter estrutura de saldo válida.');
    }

    const confirmedSatoshis = balanceResult.balance.confirmed;
    const unconfirmedSatoshis = balanceResult.balance.unconfirmed;

    return {
      balance: confirmedSatoshis / 1e8, // Converte satoshis para BCH
      unconfirmedBalance: unconfirmedSatoshis / 1e8,
    };
  } catch (error) {
    console.error(`Erro ao obter saldo para ${address} com bch-js:`, error);
    throw new Error(`Erro ao obter saldo do endereço BCH: ${error.message}`);
  }
}

/**
 * Sends BCH from one wallet to another using bch-js.
 * @param {string} fromWif - The private key (WIF) of the sender's wallet.
 * @param {string} toAddress - The recipient's BCH address.
 * @param {number} amountBCH - The amount to send (in BCH).
 * @returns {Promise<string>} - Transaction ID (txid).
 */
async function sendTransaction(fromWif, toAddress, amountBCH) {
  try {
    const keyPair = BCHJS.ECPair.fromWIF(fromWif);
    const fromAddress = BCHJS.ECPair.toCashAddress(keyPair);

    // Obter UTXOs e construir a transação
    const utxosResponse = await bchjs.Electrumx.utxo(fromAddress);
    const utxos = utxosResponse.utxos;

    const transactionBuilder = new BCHJS.TransactionBuilder('mainnet');
    let totalInputSatoshis = 0;

    utxos.forEach(utxo => {
      totalInputSatoshis += utxo.value;
      transactionBuilder.addInput(utxo.tx_hash, utxo.tx_pos);
    });

    const amountSatoshis = Math.round(amountBCH * 1e8);
    const byteCount = BCHJS.BitcoinCash.getByteCount({ P2PKH: utxos.length }, { P2PKH: 2 });
    const feeSatoshis = byteCount;

    if (totalInputSatoshis < amountSatoshis + feeSatoshis) {
      throw new Error('Saldo insuficiente.');
    }

    transactionBuilder.addOutput(toAddress, amountSatoshis);

    const changeSatoshis = totalInputSatoshis - amountSatoshis - feeSatoshis;
    if (changeSatoshis > 546) {
      transactionBuilder.addOutput(fromAddress, changeSatoshis);
    }

    let inputIndex = 0;
    utxos.forEach(utxo => {
      transactionBuilder.sign(
        inputIndex,
        keyPair,
        undefined,
        transactionBuilder.hashTypes.SIGHASH_ALL,
        utxo.value
      );
      inputIndex++;
    });

    const tx = transactionBuilder.build();
    const hex = tx.toHex();
    const txid = await bchjs.RawTransactions.sendRawTransaction(hex);

    return { txid, fromAddress, toAddress, amountBCH };
  } catch (error) {
    console.error('Erro ao enviar transação:', error);
    throw new Error('Erro ao enviar transação.');
  }
}


module.exports = {
    generateAddress,
    validateAddress,
    getBalance,
    sendTransaction,
};
