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
    if (!fromWif || !toAddress || amountBCH <= 0) {
      throw new Error('Invalid input for sendTransaction: WIF, toAddress, and positive amount required.');
    }
    // --- Use static method for validation ---
    if (!BCHJS.Address.isCashAddress(toAddress)) { // Use BCHJS.Address
        throw new Error(`Invalid recipient address: ${toAddress}`);
    }

    const amountSatoshis = Math.round(amountBCH * 1e8);

    // --- Use static methods for keypair/address derivation ---
    const keyPair = BCHJS.ECPair.fromWIF(fromWif); // Use BCHJS.ECPair
    const fromAddress = BCHJS.ECPair.toCashAddress(keyPair); // Use BCHJS.ECPair

    // --- Use REST instance for UTXOs ---
    const utxosResponse = await bchjs.Electrumx.utxo(fromAddress); // Use bchjs instance
     if (!utxosResponse || !utxosResponse.success || !utxosResponse.utxos) {
        console.error('Invalid UTXO response structure:', utxosResponse);
        throw new Error('Failed to retrieve valid UTXO structure.');
    }
    const utxos = utxosResponse.utxos;
    if (utxos.length === 0) throw new Error('No spendable UTXOs found.');

    // --- Use TransactionBuilder class from BCHJS ---
    const transactionBuilder = new BCHJS.TransactionBuilder(network); // Use BCHJS.TransactionBuilder

    let totalInputSatoshis = 0;
    utxos.forEach(utxo => {
      totalInputSatoshis += utxo.value;
      transactionBuilder.addInput(utxo.tx_hash, utxo.tx_pos);
    });

    // --- Use static method for byte count ---
    const byteCount = BCHJS.BitcoinCash.getByteCount( // Use BCHJS.BitcoinCash
        { P2PKH: utxos.length }, { P2PKH: 2 }
    );
    const feeSatoshis = byteCount;

    if (totalInputSatoshis < amountSatoshis + feeSatoshis) {
      throw new Error(
        `Insufficient funds. Required: ${amountSatoshis + feeSatoshis} satoshis, Available: ${totalInputSatoshis} satoshis.`
      );
    }

    transactionBuilder.addOutput(toAddress, amountSatoshis);
    const changeSatoshis = totalInputSatoshis - amountSatoshis - feeSatoshis;
    if (changeSatoshis > 546) {
      transactionBuilder.addOutput(fromAddress, changeSatoshis);
    }

    let inputIndex = 0;
    for (const utxo of utxos) {
      transactionBuilder.sign(
        inputIndex, keyPair, undefined,
        transactionBuilder.hashTypes.SIGHASH_ALL, utxo.value
      );
      inputIndex++;
    }

    const tx = transactionBuilder.build();
    const hex = tx.toHex();

    // --- Use REST instance for broadcasting ---
    const txid = await bchjs.RawTransactions.sendRawTransaction(hex); // Use bchjs instance
    return txid;

  } catch (error) {
    console.error('Error sending transaction with bch-js:', error);
    if (error.message && (error.message.includes('Insufficient funds') || error.message.includes('No spendable UTXOs'))) {
        throw error;
    }
    if (error.response && error.response.data && error.response.data.error) {
        throw new Error(`Error broadcasting transaction: ${error.response.data.error}`);
    }
    throw new Error(`Error sending BCH transaction: ${error.message}`);
  }
}


module.exports = {
    generateAddress,
    validateAddress,
    getBalance,
    sendTransaction,
};
