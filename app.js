const { Connection } = require('@solana/web3.js');
const axios = require('axios');
const { ipcMain } = require('electron');
require('dotenv').config();

const { SOL_AMOUNT = 10, WS_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

const sendTelegramMessage = async (message, log) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await axios.post(url, {
      chat_id: chatId,
      text: message
    });

    console.log('Повідомлення надіслано в Telegram:', response.data);
    log('Повідомлення надіслано в Telegram: ' + message);
  } catch (error) {
    console.error('Помилка при відправці повідомлення в Telegram:', error.message);
    log('Помилка при відправці повідомлення: ' + error.message);
  }
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getBlockWithRetry = async (connection, slot, log, maxRetries = 5, delay = 3000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Спроба ${attempt} отримати блок для слота: ${slot}`);
      log(`Спроба ${attempt} отримати блок для слота: ${slot}`);
      const block = await connection.getBlock(slot, {
        commitment: 'finalized',
        transactionDetails: 'full', 
        rewards: true, 
        maxSupportedTransactionVersion: 0, 
      });

      if (block) {
        console.log(`Блок для слота ${slot} успішно отримано.`);
        log(`Блок для слота ${slot} успішно отримано.`);
        return block;
      }
    } catch (error) {
      console.error(`Помилка отримання блоку для слота ${slot} (спроба ${attempt}/${maxRetries}):`, error.message);
      log(`Помилка отримання блоку для слота ${slot} (спроба ${attempt}/${maxRetries}): ${error.message}`);
    }
    
    console.log(`Очікування ${delay} мс перед повтором...`);
    await wait(delay);
  }

  throw new Error(`Блок для слота ${slot} не знайдено після ${maxRetries} спроб.`);
};

const main = async (log, stopCallback) => {
  try {
    const httpUrl = `https://rpc-mainnet.solanatracker.io/?api_key=${process.env.WS_TOKEN}`;
    const connectionHttp = new Connection(httpUrl, 'finalized');

    log('📡 Підключення до Solana через HTTP RPC...');

    let lastSlot = await connectionHttp.getSlot('finalized');
    log(`📦 Початковий слот: ${lastSlot}`);

    while (true) {
      if (stopCallback()) {
        log('🛑 Основний процес зупинено.');
        break;
      }

      log(`📦 Обробляється слот: ${lastSlot}`);

      try {
        const block = await getBlockWithRetry(connectionHttp, lastSlot, log);

        log(`🔍 Кількість транзакцій у блоці: ${block.transactions.length}`);

        const systemProgramId = '11111111111111111111111111111111';
        const minAmountLamports = BigInt(process.env.SOL_AMOUNT * 1e9); 

        const highValueTransactions = await Promise.all(
          block.transactions.map(async (tx) => {
            if (!tx.transaction || !tx.transaction.message || !tx.transaction.message.instructions) {
              return null;
            }

            const accountKeys = tx.transaction.message.accountKeys;
            const instructions = tx.transaction.message.instructions;

            for (const instruction of instructions) {
              if (!accountKeys[instruction.programIdIndex]) {
                log(`⚠️ ProgramIdIndex ${instruction.programIdIndex} виходить за межі accountKeys у транзакції: ${tx.transaction.signatures[0]}`);
                continue;
              }

              const programId = accountKeys[instruction.programIdIndex].toString();
              const dataBuffer = Buffer.from(instruction.data, 'base64');

              if (programId === systemProgramId && dataBuffer[0] === 2) {
                if (dataBuffer.length >= 9) {
                  const lamports = dataBuffer.readBigUInt64LE(1);
                  const solAmount = Number(lamports) / 1e9;

                  if (lamports >= minAmountLamports) {
                    const receiverIndex = instruction.accounts[1]; 
                    const receiverAddress = accountKeys[receiverIndex].toString();
                    log(`💸 Отримувач: ${receiverAddress}, Лампорти: ${lamports} (${solAmount} SOL)`);

                    // Отримати баланс перед транзакцією
                    const preBalance = await connectionHttp.getBalance(receiverAddress, 'processed');
                    log(`💰 Баланс до транзакції: ${preBalance / 1e9} SOL для отримувача: ${receiverAddress}`);

                    if (preBalance === 0) {
                      const message = `💰 Новий гаманець виявлено: ${receiverAddress} отримав ${solAmount} SOL`;
                      log(message);
                      await sendTelegramMessage(message);
                    }

                    return {
                      signature: tx.transaction.signatures[0],
                      receiver: receiverAddress,
                      solAmount
                    };
                  }
                } else {
                  log(`⚠️ Недостатньо байтів у dataBuffer для зчитування лампортів. Транзакція: ${tx.transaction.signatures[0]}`);
                }
              }
            }
            return null;
          })
        );

        const validTransactions = highValueTransactions.filter(tx => tx !== null);

        log(`📋 Кількість транзакцій із трансфером ${process.env.SOL_AMOUNT}+ SOL: ${validTransactions.length}`);

        validTransactions.forEach((tx, index) => {
          log(`🔗 Транзакція з трансфером ${process.env.SOL_AMOUNT}+ SOL ${index + 1}: Підпис: ${tx.signature}, Отримувач: ${tx.receiver}, Сума: ${tx.solAmount} SOL`);
        });

      } catch (error) {
        log(`❌ Помилка при обробці слота ${lastSlot}: ${error.message}`);
      }

      lastSlot += 1; // Збільшуємо слот вручну
      log(`📦 Слот збільшено до: ${lastSlot}`);
    }
  } catch (error) {
    log(`❌ Помилка: ${error.message}`);
  }
};

module.exports = { main };
