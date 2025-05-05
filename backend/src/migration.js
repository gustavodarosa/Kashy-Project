// z:\Kashy-Project\backend\src\migration.js
const mongoose = require('mongoose'); // Ou seu driver de DB
const User = require('./models/User'); // Ajuste o caminho se necessário
const { encrypt } = require('./utils/cryptoUtils'); // Sua função ATUAL de criptografia
const crypto = require('crypto');

require('dotenv').config(); // Para carregar process.env.ENCRYPTION_KEY e MONGO_URI

// --- Função de Descriptografia Temporária (para o formato antigo) ---
// --- CORRIGIDO: Assume que o algoritmo antigo era CBC ---
const OLD_ALGORITHM = 'aes-256-cbc';

// Função para derivar a chave (igual à sua atual em cryptoUtils.js)
const deriveKey = (baseKey) => {
  return crypto.createHash('sha256').update(String(baseKey)).digest();
};

const decryptOldFormat = (encryptedText) => {
  try {
    // Verifica se o input é uma string válida
    if (!encryptedText || typeof encryptedText !== 'string') {
      throw new Error("Invalid encrypted text provided.");
    }
    const textParts = encryptedText.split(':');
    // O formato antigo SÓ TEM 2 partes
    if (textParts.length !== 2) {
      // Se não for o formato antigo, retorna null
      return null; // Indica que não é o formato antigo
    }

    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedData = Buffer.from(textParts[1], 'hex'); // No formato antigo, a segunda parte é o ciphertext
    const baseKey = process.env.ENCRYPTION_KEY; // Sua chave do .env
    if (!baseKey) throw new Error("ENCRYPTION_KEY is not set.");

    const key = deriveKey(baseKey);
    if (key.length !== 32) throw new Error("Invalid key length for AES-256.");
    // --- CORRIGIDO: CBC usa IV de 16 bytes ---
    if (iv.length !== 16) throw new Error(`Unexpected IV length for CBC: ${iv.length}. Expected 16.`);


    // --- CORRIGIDO: Usa o algoritmo CBC ---
    const decipher = crypto.createDecipheriv(OLD_ALGORITHM, key, iv);

    // !! IMPORTANTE: NÃO definimos setAuthTag() aqui !!

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');

    try {
        decrypted += decipher.final('utf8'); // Tenta finalizar
    } catch (err) {
        // Se falhar aqui, pode ser que o algoritmo antigo fosse CBC, ou dados corrompidos.
        console.error(`Decryption finalization failed for old format (CBC) text: ${encryptedText.substring(0, 20)}...`, err);
        throw new Error("Failed to finalize decryption for old format.");
    }
    return decrypted;
  } catch (error) {
    // Log de erro mais seguro
    console.error(`Decryption Error (Old Format) for input text "${typeof encryptedText === 'string' ? encryptedText.substring(0, 20) : '[Invalid Input]' }...":`, error.message);
    throw error; // Lança o erro para ser pego no loop de migração
  }
};
// --- Fim da Função Temporária ---

const runMigration = async () => {
  try {
    // Conecta ao DB usando MONGO_URI
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conectado ao MongoDB para migração.');

    // Busca Users que têm o mnemonic, selecionando os campos protegidos
    const usersToMigrate = await User.find({
        encryptedMnemonic: { $exists: true, $ne: null }
    }).select('+encryptedMnemonic +encryptedDerivationPath');

    console.log(`Encontrados ${usersToMigrate.length} usuários com chaves para verificar.`);
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of usersToMigrate) {
      let needsSave = false; // Flag para salvar o usuário
      let userHadError = false; // Flag para erro neste usuário

      console.log(`\nProcessando usuário ${user._id}...`);

      try {
        // --- Migra Mnemonic ---
        const oldEncryptedMnemonic = user.encryptedMnemonic;
        if (oldEncryptedMnemonic && typeof oldEncryptedMnemonic === 'string') {
            console.log(`   - Tentando descriptografar mnemonic...`);
            const decryptedMnemonic = decryptOldFormat(oldEncryptedMnemonic);

            if (decryptedMnemonic !== null) { // Era formato antigo
              const newEncryptedMnemonic = encrypt(decryptedMnemonic, process.env.ENCRYPTION_KEY); // Usa a função encrypt ATUAL
              if (user.encryptedMnemonic !== newEncryptedMnemonic) {
                  user.encryptedMnemonic = newEncryptedMnemonic;
                  needsSave = true;
                  console.log(`   - Mnemonic preparado para atualização.`);
              } else {
                  console.log(`   - Mnemonic já estava atualizado (valor re-criptografado igual).`);
              }
            } else { // Já era formato novo ou inválido para o decryptOldFormat
              console.log(`   - Mnemonic pulado (provavelmente formato novo ou inválido para decryptOldFormat).`);
            }
        } else {
            console.warn(`   - WARN: encryptedMnemonic para usuário ${user._id} é inválido ou ausente:`, typeof oldEncryptedMnemonic);
            // Considerar se isso deve contar como erro ou ser pulado
        }

        // --- Migra Derivation Path ---
        const oldEncryptedPath = user.encryptedDerivationPath;
        if (oldEncryptedPath && typeof oldEncryptedPath === 'string') {
            console.log(`   - Tentando descriptografar derivation path...`);
            const decryptedPath = decryptOldFormat(oldEncryptedPath);

            if (decryptedPath !== null) { // Era formato antigo
                const newEncryptedPath = encrypt(decryptedPath, process.env.ENCRYPTION_KEY); // Usa a função encrypt ATUAL
                 if (user.encryptedDerivationPath !== newEncryptedPath) {
                    user.encryptedDerivationPath = newEncryptedPath;
                    needsSave = true;
                    console.log(`   - Derivation path preparado para atualização.`);
                 } else {
                     console.log(`   - Derivation path já estava atualizado (valor re-criptografado igual).`);
                 }
            } else { // Já era formato novo ou inválido para o decryptOldFormat
                 console.log(`   - Derivation path pulado (provavelmente formato novo ou inválido para decryptOldFormat).`);
            }
        } else if (user.hasOwnProperty('encryptedDerivationPath')) {
            console.warn(`   - WARN: encryptedDerivationPath para usuário ${user._id} é inválido ou ausente:`, typeof oldEncryptedPath);
        } else {
             console.log(`   - encryptedDerivationPath não presente para usuário ${user._id}. Pulando.`);
        }

      } catch (error) {
        // Captura erro da tentativa de descriptografia/criptografia para este usuário
        console.error(`Erro ao processar dados para usuário ${user._id}:`, error.message);
        userHadError = true; // Marca que houve erro neste usuário
        errorCount++;
      }

      // --- Salva se houver mudanças E não houve erro ---
      if (needsSave && !userHadError) {
        try {
          await user.save();
          console.log(`Usuário ${user._id} atualizado com sucesso.`);
          migratedCount++;
        } catch (saveError) {
           console.error(`Erro ao SALVAR usuário ${user._id} após preparar atualização:`, saveError.message);
           // Se falhou ao salvar, conta como erro também, mesmo que a descriptografia tenha funcionado
           if (!userHadError) errorCount++; // Evita contar o erro duas vezes
        }
      } else if (!needsSave && !userHadError) {
          // Se não precisou salvar E não houve erro, verifica se foi pulado corretamente
          const mnemonicIsOld = user.encryptedMnemonic && typeof user.encryptedMnemonic === 'string' ? decryptOldFormat(user.encryptedMnemonic) !== null : false;
          const pathIsOld = user.encryptedDerivationPath && typeof user.encryptedDerivationPath === 'string' ? decryptOldFormat(user.encryptedDerivationPath) !== null : false;

          // Conta como pulado se NENHUM dos campos era do formato antigo (ou seja, já estavam ok ou eram inválidos antes)
          if (!mnemonicIsOld && !pathIsOld) {
               skippedCount++;
               console.log(`   - Usuário ${user._id} contado como pulado (nenhum campo precisou de migração).`);
          }
      }
      // Se userHadError for true, já foi contado em errorCount no catch
    } // Fim do loop for

    console.log('\n--- Resumo da Migração ---');
    console.log(`Usuários verificados: ${usersToMigrate.length}`);
    console.log(`Migradas com sucesso: ${migratedCount}`);
    console.log(`Puladas (formato novo/inválido/sem necessidade): ${skippedCount}`);
    console.log(`Erros durante a migração: ${errorCount}`);

  } catch (error) {
    // Captura erros fatais (conexão DB, query inicial)
    console.error('Erro fatal durante a migração:', error);
  } finally {
    // Garante que desconecta do DB
    await mongoose.disconnect();
    console.log('Desconectado do MongoDB.');
  }
};

// Execute a migração
runMigration();
