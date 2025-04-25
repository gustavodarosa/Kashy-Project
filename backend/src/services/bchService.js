require('dotenv').config(); // Load environment variables

// --- Library Imports ---
const BCHJS = require('@psf/bch-js'); // Main library object/constructor
const ElectrumClient = require('electrum-client'); // For Electrum connection
const crypto = require('crypto'); // Used in calculateScriptHashFromKeyPair
const cryptoUtils = require('../utils/cryptoUtils'); // For encryption/decryption
// --- End Library Imports ---

// --- Configuration ---
const isTestnet = process.env.BCH_NETWORK === 'testnet';
const network = isTestnet ? 'testnet' : 'mainnet'; // Network name for context
const SATOSHIS_PER_BCH = 1e8; // Define constant for satoshis per BCH

// BCHJS Instance - Use this instance for most operations
const bchjs = new BCHJS({
  restURL: isTestnet
    ? process.env.BCH_TESTNET_API || 'https://api.testnet.bcash.rocks/v3/' // Updated testnet endpoint
    : process.env.BCH_MAINNET_API || 'https://api.mainnet.bch.rocks/v3/', // Updated mainnet endpoint
  // Consider adding apiToken: process.env.BCH_API_KEY if using paid REST calls
});

// Electrum Server Configuration (Consider moving to .env or a config file)
const ELECTRUM_HOST = process.env.ELECTRUM_HOST || 'bch.imaginary.cash'; // Replace with reliable public server or your own
const ELECTRUM_PORT = parseInt(process.env.ELECTRUM_PORT || '50002', 10);
const ELECTRUM_PROTOCOL = process.env.ELECTRUM_PROTOCOL || 'ssl';

const DEFAULT_DERIVATION_PATH = "m/44'/145'/0'/0/0";
// --- End Configuration ---


// --- Wallet Functions ---

/**
 * Generates a new BCH address and wallet details using bch-js.
 * @returns {Promise<{mnemonic: string, derivationPath: string, address: string}>} - Contains mnemonic, derivation path, and address.
 */
const generateAddress = async () => {
  try {
    // Uses bchjs instance
    const mnemonic = bchjs.Mnemonic.generate(128);
    const rootSeed = await bchjs.Mnemonic.toSeed(mnemonic);
    const hdNode = bchjs.HDNode.fromSeed(rootSeed, network); // Pass network type
    const childNode = bchjs.HDNode.derivePath(hdNode, DEFAULT_DERIVATION_PATH);
    const address = bchjs.HDNode.toCashAddress(childNode);

    return {
      mnemonic,
      derivationPath: DEFAULT_DERIVATION_PATH,
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
  if (!address || typeof address !== 'string') {
    return false;
  }
  try {
    // Use the INSTANCE 'bchjs' for validation methods
    return bchjs.Address.isCashAddress(address) || bchjs.Address.isLegacyAddress(address);
  } catch (error) {
    // Log validation errors specifically
    console.error(`Erro ao validar endereço '${address}': ${error.message}`);
    return false;
  }
}

/**
 * Gets the balance of a BCH address using bch-js ElectrumX methods (via REST).
 * @param {string} address - The BCH address.
 * @returns {Promise<{balance: number, unconfirmedBalance: number}>} - Balance of the address in BCH.
 */
async function getBalance(address) {
  try {
    // Use the bchjs instance for conversion for consistency
    const cashAddress = bchjs.Address.toCashAddress(address);
    const balanceResult = await bchjs.Electrumx.balance(cashAddress); // Uses REST via instance

    if (!balanceResult || !balanceResult.success || !balanceResult.balance) {
      console.error('Resposta de saldo inválida via REST:', balanceResult);
      throw new Error('Falha ao obter estrutura de saldo válida via REST.');
    }
    const confirmedSatoshis = balanceResult.balance.confirmed;
    const unconfirmedSatoshis = balanceResult.balance.unconfirmed;
    return {
      balance: confirmedSatoshis / SATOSHIS_PER_BCH,
      unconfirmedBalance: unconfirmedSatoshis / SATOSHIS_PER_BCH,
    };
  } catch (error) {
    console.error(`Erro ao obter saldo para ${address} via REST:`, error);
    // Check for specific network or API errors if possible
    if (error.response) { // Axios-like error structure
        console.error('API Response Error:', error.response.data);
    }
    throw new Error(`Erro ao obter saldo do endereço BCH via REST: ${error.message}`);
  }
}

/**
 * Derives the private key (WIF) from encrypted mnemonic and path.
 * @param {string} encryptedMnemonic - The encrypted mnemonic.
 * @param {string} encryptedDerivationPath - The encrypted derivation path.
 * @param {string} encryptionKey - The encryption key.
 * @returns {Promise<string>} - The private key (WIF).
 */
async function derivePrivateKey(encryptedMnemonic, encryptedDerivationPath, encryptionKey) {
  try {
    // Uses cryptoUtils and bchjs instance
    const mnemonic = cryptoUtils.decrypt(encryptedMnemonic, encryptionKey);
    const derivationPath = cryptoUtils.decrypt(encryptedDerivationPath, encryptionKey);

    const rootSeed = await bchjs.Mnemonic.toSeed(mnemonic);
    const hdNode = bchjs.HDNode.fromSeed(rootSeed, network); // Pass network type
    const childNode = bchjs.HDNode.derivePath(hdNode, derivationPath);
    const privateKeyWIF = bchjs.HDNode.toWIF(childNode);

    console.log('Chave privada WIF derivada com sucesso (usando bchjs).');
    return privateKeyWIF;
  } catch (error) {
    console.error('Erro ao derivar chave privada:', error);
    // Add specific error handling if decryption fails vs. derivation fails
    if (error.message.includes('decrypt')) {
         throw new Error(`Erro ao descriptografar dados da carteira: ${error.message}`);
    } else {
         throw new Error(`Erro ao derivar chave privada a partir do mnemônico/caminho: ${error.message}`);
    }
  }
}

// --- End Wallet Functions ---


// --- Electrum Implementation Functions ---

/**
 * Connects to the configured Electrum server.
 * @returns {Promise<ElectrumClient>}
 */
async function connectToElectrum() {
  console.log(`Conectando ao servidor Electrum: ${ELECTRUM_HOST}:${ELECTRUM_PORT} (${ELECTRUM_PROTOCOL})`);
  const client = new ElectrumClient(ELECTRUM_PORT, ELECTRUM_HOST, ELECTRUM_PROTOCOL);
  try {
      // Add connection timeout logic if needed
      await client.connect('kashy-bch-service', '1.4'); // Identify client, specify protocol version
      console.log('Conectado ao servidor Electrum.');
      return client;
  } catch (err) {
      console.error(`Falha ao conectar ao servidor Electrum: ${err.message}`);
      // Consider adding retry logic or alternative server handling here
      throw err; // Re-throw connection error
  }
}

/**
 * Calculates the Electrum script hash directly from a key pair's public key using bchjs.
 * @param {object} keyPair - The ECPair object from bchjs (must have publicKey property as a Buffer).
 * @returns {string} Script hash (reversed hex).
 */
function calculateScriptHashFromKeyPair(keyPair) {
  try {
    if (!keyPair || !keyPair.publicKey || !Buffer.isBuffer(keyPair.publicKey)) {
      throw new Error('KeyPair ou publicKey (Buffer) inválido fornecido.');
    }
    console.log(`[Debug] Calculando script hash a partir da publicKey: ${keyPair.publicKey.toString('hex')}`);

    // 1. Get the hash160 of the public key using bchjs instance
    const pubKeyHash = bchjs.Crypto.hash160(keyPair.publicKey);

    // 2. Build the P2PKH scriptPubKey using bchjs instance methods
    const scriptPubKey = bchjs.Script.encode([
      bchjs.Script.opcodes.OP_DUP,
      bchjs.Script.opcodes.OP_HASH160,
      pubKeyHash, // Buffer of the hash160
      bchjs.Script.opcodes.OP_EQUALVERIFY,
      bchjs.Script.opcodes.OP_CHECKSIG,
    ]);
    console.log(`[Debug] ScriptPubKey P2PKH construído: ${scriptPubKey.toString('hex')}`);

    // 3. Calculate the SHA256 hash of the scriptPubKey using Node's crypto
    const scriptHash = crypto.createHash('sha256').update(scriptPubKey).digest();

    // 4. Reverse the bytes and convert to hexadecimal
    const reversedScriptHashHex = Buffer.from(scriptHash.reverse()).toString('hex');
    console.log(`[Debug] Script hash calculado e invertido: ${reversedScriptHashHex}`);

    return reversedScriptHashHex;

  } catch (error) {
    console.error(`Erro ao calcular script hash a partir do keyPair: ${error.message}`);
    throw new Error(`Erro ao calcular script hash: ${error.message}`);
  }
}


/**
 * Gets UTXOs for a keyPair using Electrum's listunspent.
 * Calculates script hash directly from the keyPair.
 * @param {ElectrumClient} client - Connected Electrum client instance.
 * @param {object} keyPair - The ECPair object from bchjs (with publicKey Buffer).
 * @param {string} address - The corresponding address (for logging purposes).
 * @returns {Promise<Array<{tx_hash: string, tx_pos: number, value: number, height: number}>>} - Array of UTXO objects.
 */
async function getUTXOsElectrumForKeyPair(client, keyPair, address) {
  const scriptHash = calculateScriptHashFromKeyPair(keyPair); // Use the helper function

  console.log(`Obtendo UTXOs (listunspent) para o endereço ${address} (scriptHash: ${scriptHash})...`);
  try {
      const utxos = await client.request('blockchain.scripthash.listunspent', [scriptHash]);
      console.log(`UTXOs (listunspent) obtidos: ${utxos?.length || 0}`);
      // Ensure structure matches expected format if necessary
      return (utxos || []).map(utxo => ({
          tx_hash: utxo.tx_hash,
          tx_pos: utxo.tx_pos,
          value: utxo.value, // Value is in satoshis
          height: utxo.height
      }));
  } catch (error) {
      console.error(`Erro ao obter UTXOs via Electrum para ${address} (scriptHash: ${scriptHash}): ${error.message}`);
      throw new Error(`Falha ao buscar UTXOs via Electrum: ${error.message}`);
  }
}

/**
 * Sends BCH using Electrum for network calls and bchjs for transaction logic.
 * Calculates script hash directly from keypair.
 * WARNING: Uses fixed fees. Dynamic calculation is strongly recommended for production.
 * @param {string} fromWif - The private key (WIF) of the sender's wallet.
 * @param {string} toAddress - The recipient's BCH address.
 * @param {number} amountBCH - The amount to send (in BCH).
 * @returns {Promise<string>} - Transaction ID (txid).
 */
async function sendTransactionWithElectrum(fromWif, toAddress, amountBCH) {
  let client; // Define client in the outer scope for finally block
  try {
    client = await connectToElectrum(); // Establish connection first
    console.log(`Iniciando transação (Electrum/BCHJS) para ${toAddress}, Valor: ${amountBCH} BCH`);

    // --- Validate Inputs ---
    if (!fromWif || typeof fromWif !== 'string') {
        throw new Error("Chave privada (WIF) do remetente é inválida ou ausente.");
    }
    if (!validateAddress(toAddress)) { // Use the corrected validateAddress
        throw new Error(`Endereço de destino inválido: ${toAddress}`);
    }
    if (typeof amountBCH !== 'number' || amountBCH <= 0) {
        throw new Error(`Quantia inválida para envio: ${amountBCH}`);
    }

    // --- Derive KeyPair and Address using bchjs instance ---
    console.log(`[Debug] Tentando derivar keyPair do WIF (via bchjs): ${fromWif.substring(0, 5)}...`);
    let keyPair;
    try {
        keyPair = bchjs.ECPair.fromWIF(fromWif);
        // Ensure publicKey is a Buffer - bchjs usually handles this, but explicit check can help
        if (!Buffer.isBuffer(keyPair.publicKey)) {
            // Attempt to get it if the method exists (older versions might differ)
            if (typeof keyPair.getPublicKeyBuffer === 'function') {
                 keyPair.publicKey = keyPair.getPublicKeyBuffer();
                 console.log('[Debug] Public key buffer obtido via getPublicKeyBuffer() e atribuído a keyPair.publicKey.');
            } else {
                 throw new Error('keyPair.publicKey não é um Buffer e getPublicKeyBuffer() não está disponível.');
            }
        }
        console.log('[Debug] keyPair derivado com sucesso (via bchjs).');
        console.log(`[Debug] keyPair.publicKey (Buffer): ${keyPair.publicKey.toString('hex')}`);
    } catch (keyPairError) {
        console.error('[Debug] Erro ao derivar keyPair/publicKey do WIF:', keyPairError);
        throw new Error(`Falha ao derivar keyPair/publicKey do WIF: ${keyPairError.message}`);
    }

    let fromAddress;
    try {
        fromAddress = bchjs.ECPair.toCashAddress(keyPair);
        console.log('[Debug] Endereço CashAddr do remetente derivado com sucesso (via bchjs).');
    } catch (addrError) {
        console.error('[Debug] Erro durante a derivação do endereço do remetente (via bchjs):', addrError);
        throw new Error('Erro ao derivar endereço do remetente via bchjs.');
    }
    console.log('Endereço do remetente (derivado de bchjs):', fromAddress);

    // --- Get UTXOs using Electrum ---
    const utxos = await getUTXOsElectrumForKeyPair(client, keyPair, fromAddress);
    if (!utxos || utxos.length === 0) {
      throw new Error('Nenhum UTXO encontrado para o endereço do remetente via Electrum.');
    }

    // --- Build Transaction using bchjs TransactionBuilder ---
    const transactionBuilder = new bchjs.TransactionBuilder(network);
    let totalInputSatoshis = 0;
    const inputsAddedData = []; // Store UTXO data along with rawTxHex for signing

    console.log("Fetching raw transaction data for each UTXO...");
    // Fetch raw hex for inputs needed for signing
    for (const utxo of utxos) {
      console.log(`Processing UTXO: hash=${utxo.tx_hash}, index=${utxo.tx_pos}, value=${utxo.value}`);
      let rawTxHex;
      try {
          // Request verbose transaction data if needed, otherwise just hex
          rawTxHex = await client.request('blockchain.transaction.get', [utxo.tx_hash]); // Get raw hex
          if (!rawTxHex || typeof rawTxHex !== 'string') {
              throw new Error('Resposta inválida para blockchain.transaction.get');
          }
      } catch (fetchError) {
          console.error(`Falha ao obter rawTx para ${utxo.tx_hash}: ${fetchError.message}. Pulando UTXO.`);
          continue; // Skip this UTXO if fetching fails
      }

      transactionBuilder.addInput(utxo.tx_hash, utxo.tx_pos);
      totalInputSatoshis += utxo.value;
      inputsAddedData.push({ ...utxo, rawTxHex }); // Store raw hex with UTXO data
    }

    if (inputsAddedData.length === 0) {
        throw new Error("Nenhum input válido pôde ser adicionado à transação após buscar rawTx.");
    }
    console.log(`Total de inputs adicionados: ${inputsAddedData.length}, Valor total: ${totalInputSatoshis} satoshis`);

    // --- Calculate Outputs and Fees ---
    const amountSatoshis = Math.round(amountBCH * SATOSHIS_PER_BCH);
    // !!! IMPORTANT: Replace fixed fee with dynamic calculation !!!
    // Example placeholder for dynamic fee (adjust based on tx size)
    // const estimatedTxSizeBytes = bchjs.BitcoinCash.getByteCount({ P2PKH: inputsAddedData.length }, { P2PKH: 2 }); // Estimate size
    // const feeRateSatPerByte = 1.1; // Get from network or config
    // const feeSatoshis = Math.ceil(estimatedTxSizeBytes * feeRateSatPerByte);
    const feeSatoshis = 1000; // FIXED FEE - VERY BAD FOR PRODUCTION
    console.warn(`!!! ADVERTÊNCIA: Usando taxa fixa de ${feeSatoshis} satoshis. Recomenda-se cálculo dinâmico urgente. !!!`);

    const changeSatoshis = totalInputSatoshis - amountSatoshis - feeSatoshis;

    if (changeSatoshis < 0) {
      throw new Error(`Saldo insuficiente (${totalInputSatoshis} sat) para cobrir o valor (${amountSatoshis} sat) e as taxas (${feeSatoshis} sat). Necessário: ${amountSatoshis + feeSatoshis} sat.`);
    }

    // Add main output
    transactionBuilder.addOutput(toAddress, amountSatoshis);

    // Add change output if it's above dust threshold
    const DUST_THRESHOLD = 546; // Standard dust threshold for P2PKH
    if (changeSatoshis >= DUST_THRESHOLD) {
      console.log(`Adicionando saída de troco: ${changeSatoshis} satoshis para ${fromAddress}`);
      transactionBuilder.addOutput(fromAddress, changeSatoshis);
    } else {
      console.log(`Troco (${changeSatoshis} sat) abaixo do limite de poeira (${DUST_THRESHOLD} sat). Será adicionado à taxa.`);
      // Note: The 'lost' change effectively becomes part of the miner fee.
    }

    // --- Sign Inputs ---
    console.log('Assinando inputs...');
    inputsAddedData.forEach((inputData, index) => {
        transactionBuilder.sign(
            index,                              // Input index
            keyPair,                            // KeyPair with private key
            null, // Redeem script (null for P2PKH)
            transactionBuilder.hashTypes.SIGHASH_ALL, // Hash type
            inputData.value,                    // Input value (satoshis)
            null, // Signature algorithm (null for default ECDSA)
            // Pass the raw transaction hex of the input being spent
            // Note: Some versions/implementations might expect the scriptPubKey here instead.
            // bchjs TransactionBuilder typically handles this internally if rawTxHex isn't needed directly.
            // Let's rely on bchjs internal logic first. If signing fails, we might need:
            // Buffer.from(inputData.rawTxHex, 'hex')
        );
        console.log(`Input ${index} (txid: ${inputData.tx_hash.substring(0, 8)}...) assinado.`);
    });

    // --- Build and Broadcast ---
    console.log('Construindo transação final...');
    const tx = transactionBuilder.build();
    const txHex = tx.toHex();

    console.log('Transação construída (Electrum/BCHJS). Enviando para a rede...');
    console.log('TX Hex (primeiros 100 chars):', txHex.substring(0, 100) + '...');

    // Broadcast using Electrum
    const txid = await client.request('blockchain.transaction.broadcast', [txHex]);

    // Validate the response TXID format
    if (typeof txid !== 'string' || !/^[a-fA-F0-9]{64}$/.test(txid)) {
        console.error('Resposta inválida ao enviar transação (txid esperado):', txid);
        throw new Error(`Resposta inesperada ou inválida do Electrum broadcast: ${JSON.stringify(txid)}`);
    }

    console.log('Transação enviada com sucesso (Electrum/BCHJS). TXID:', txid);
    return txid;

  } catch (error) {
    // Log detailed error information
    console.error('--- ERRO CAPTURADO EM sendTransactionWithElectrum ---');
    console.error('Tipo do Erro:', typeof error);
    console.error('Mensagem:', error?.message);
    console.error('Erro Completo:', error);
    console.error('Stack Trace (se disponível):', error?.stack);
    console.error('--- FIM DO ERRO CAPTURADO ---');

    // Provide a more specific error message to the caller
    let errorMessage = 'Erro desconhecido ao enviar transação via Electrum/BCHJS';
     if (error instanceof Error) {
        errorMessage = error.message; // Use the error message directly
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else if (error && typeof error === 'object') {
        // Try to extract a meaningful message from Electrum errors
        errorMessage = error.message || error.error || JSON.stringify(error);
    }
    // Avoid exposing raw internal errors directly if not needed
    throw new Error(`Erro ao enviar transação (Electrum/BCHJS): ${errorMessage}`);

  } finally {
    // Ensure the Electrum client connection is always closed
    if (client) {
      try {
          await client.close();
          console.log('Conexão com o servidor Electrum encerrada.');
      } catch (closeError) {
          console.error('Erro ao fechar a conexão Electrum:', closeError);
      }
    }
  }
}

// --- End Electrum Implementation Functions ---


// --- Module Exports ---
module.exports = {
    // Core wallet functions
    generateAddress,
    validateAddress,
    getBalance,
    derivePrivateKey,
    // Primary transaction function (using Electrum + BCHJS)
    sendTransaction: sendTransactionWithElectrum,

    // Export helper/utility functions if needed elsewhere (optional)
    connectToElectrum,
    calculateScriptHashFromKeyPair,
    getUTXOsElectrumForKeyPair,
};
// --- End Module Exports ---
