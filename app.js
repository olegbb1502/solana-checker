const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const configFilePath = path.join(__dirname, 'config.txt');

const sendTelegramMessage = async (message, log) => {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown',
    });
  } catch (error) {
    console.error('Помилка при відправці повідомлення в Telegram:', error.message);
  }
};

const writeToFile = async (filename, message, log) => {
  const filePath = path.join(__dirname, filename);
  const formattedMessage = `${message}\n`;
  fs.appendFile(filePath, formattedMessage, (err) => {
    if (err) {
      console.error('Помилка запису у файл:', err);
    }
  });
};

const getBlockWithRetry = async (connection, slot) => {
  try {
    const block = await connection.getBlock(slot, {
      commitment: 'finalized',
      transactionDetails: 'full',
      rewards: true,
      maxSupportedTransactionVersion: 0,
    });

    if (block) {
      console.log(`Блок для слота ${slot} успішно отримано.`);
      return block;
    }
  } catch (error) {
    console.error(`Помилка отримання блоку для слота ${slot}:`, error.message);
  }
  throw new Error(`Блок для слота ${slot} не знайдено.`);
};

const processTransactions = (transactions, systemProgramIds) => {
  return transactions.filter((tx) => {
    if (!tx.transaction || !tx.transaction.message || !tx.transaction.message.instructions) {
      return false;
    }

    const accountKeys = tx.transaction.message.accountKeys;
    const instructions = tx.transaction.message.instructions;

    return instructions.some(
      (instruction) =>
        accountKeys[instruction.programIdIndex] &&
        systemProgramIds.includes(accountKeys[instruction.programIdIndex].toString())
    );
  });
};

const timeoutPromise = (promise, ms) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), ms)
  );
  return Promise.race([promise, timeout]);
};

const main = async (log, stopCallback, envData) => {
  const {
    SOL_AMOUNT = 10,
    WS_TOKEN,
    FILENAME,
    BLACKLIST = [],
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
    USE_FILE,
  } = process.env;
  let rpcToken = WS_TOKEN;

  if (!rpcToken.length) {
    const configFileData = fs.readFileSync(configFilePath, 'utf8');
    rpcToken = configFileData.split('\n')[0];
  }

  if (!USE_FILE && !TELEGRAM_BOT_TOKEN.length && !TELEGRAM_CHAT_ID.length) {
    const configFileData = fs.readFileSync(configFilePath, 'utf8');
    process.env.TELEGRAM_BOT_TOKEN = configFileData.split('\n')[1];
    process.env.TELEGRAM_CHAT_ID = configFileData.split('\n')[2];
  }

  try {
    const httpUrl = `https://rpc-mainnet.solanatracker.io/?api_key=${rpcToken}`;
    const connectionHttp = new Connection(httpUrl, 'finalized');

    log('📡 Підключення до Solana через HTTP RPC...');

    let lastSlot = await connectionHttp.getSlot('finalized');
    log(`📦 Початковий слот: ${lastSlot}`);

    const systemProgramIds = ['11111111111111111111111111111111', 'ComputeBudget111111111111111111111111111111'];

    while (true) {
      if (stopCallback()) {
        log('🛑 Основний процес зупинено.');
        break;
      }

      // log(`📦 Обробляється слот: ${lastSlot}`);

      try {
        const block = await getBlockWithRetry(connectionHttp, lastSlot);

        const filteredTransactions = processTransactions(block.transactions, systemProgramIds);
        
        // await Promise.all(
        const successWallets = filteredTransactions.map((tx) => {
          const accountKeys = tx.transaction.message.accountKeys;
          const instructions = tx.transaction.message.instructions;

          for (const instruction of instructions) {
            const programId = accountKeys[instruction.programIdIndex].toString();
            if (!systemProgramIds.includes(programId)) {
              break;
            }
            if (!accountKeys[instruction.programIdIndex]) {
              continue;
            }

            const dataBuffer = Buffer.from(instruction.data, 'base64');
            if (dataBuffer[0] === 220) {
              const preBalances = tx.meta.preBalances;
              const postBalances = tx.meta.postBalances;
              const balanceChanges = preBalances.map((preBalance, index) => {
                const postBalance = postBalances[index];
                const change = postBalance - preBalance;
                return {
                  account: tx.transaction.message.accountKeys[index] || `Account${index + 1}`,
                  preBalance: preBalance / 1e9,
                  postBalance: postBalance / 1e9,
                  change: change / 1e9,
                };
              });

              const receivers = balanceChanges.filter((change) => change.change > 0);
              const senders = balanceChanges.filter((change) => change.change < 0);

              if (receivers[0] && !BLACKLIST.includes(senders[0]?.account.toString())) {
                if (receivers[0].change >= 1 && receivers[0].change <= SOL_AMOUNT && receivers[0].preBalance === 0) {
                  receivers[0].transaction = tx.transaction.signatures[0];
                  return receivers[0];
                }
              }
            }
          }
          return null;
        }).filter(w => w !== null);

        const blockResult = successWallets.map((wallet) => {
          const receiverWallet = wallet.account.toString();
          const walletMessage = USE_FILE
            ? receiverWallet
            : `[wallet](https://solscan.io/account/${receiverWallet}#transfers)`;
          return `${USE_FILE && `[${new Date().toISOString()}]`} Транзакція \`${wallet.transaction}\`\nКористувач ${walletMessage} отримав ${wallet.change} SOL`;
        });

        if (blockResult.length) {
          const message = blockResult.join('\n');
          log(`✅ Знайдено ${blockResult.length} транзакцій.`);
          if (USE_FILE) {
            writeToFile(FILENAME, message, log);
          } else {
            sendTelegramMessage(message, log, envData);
          }
        }
        // );

        delete block;
      } catch (error) {
        if (error.message === 'Timeout') {
          log(`⚠️ Слот ${lastSlot} пропущено через тайм-аут.`);
        } else {
          console.error(error);
        }
      }

      lastSlot += 1;
    }
  } catch (error) {
    console.error(`❌ Помилка: ${error.message}`);
    log(`❌ Помилка: ${error.message}`);
  }
};

module.exports = { main };
