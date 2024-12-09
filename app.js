const { Connection } = require('@solana/web3.js');
require('dotenv').config();

const { SOL_AMOUNT = 10, WS_TOKEN } = process.env;

// Функція для очікування затримки
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Функція для повторного запиту блоку з кількома спробами
const getBlockWithRetry = async (connection, slot, maxRetries = 5, delay = 3000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Спроба ${attempt} отримати блок для слота: ${slot}`);
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
      console.error(`Помилка отримання блоку для слота ${slot} (спроба ${attempt}/${maxRetries}):`, error.message);
    }
    
    console.log(`Очікування ${delay} мс перед повтором...`);
    await wait(delay);
  }

  throw new Error(`Блок для слота ${slot} не знайдено після ${maxRetries} спроб.`);
};

const main = async () => {
  try {
    const httpUrl = `https://rpc-mainnet.solanatracker.io/?api_key=${WS_TOKEN}`;
    const connectionHttp = new Connection(httpUrl, 'finalized');

    console.log('Підключення до Solana через HTTP RPC...');

    let lastSlot = await connectionHttp.getSlot('finalized');
    console.log(`Початковий слот: ${lastSlot}`);

    setInterval(async () => {
      try {
        const currentSlot = await connectionHttp.getSlot('finalized');

        if (currentSlot > lastSlot) {
          console.log(`Новий слот виявлено: ${currentSlot}`);
          lastSlot = currentSlot;

          const block = await getBlockWithRetry(connectionHttp, currentSlot);
          console.log('Отримано кількість транзакцій у блоці:', block.transactions.length);
          
          const systemProgramId = '11111111111111111111111111111111';
          const minAmountLamports = BigInt(SOL_AMOUNT * 1e9); 

          const highValueTransactions = await Promise.all(
            block.transactions.map(async (tx) => {
              if (!tx.transaction || !tx.transaction.message || !tx.transaction.message.instructions) {
                return null;
              }

              const accountKeys = tx.transaction.message.accountKeys;
              const instructions = tx.transaction.message.instructions;

              for (const instruction of instructions) {
                if (!accountKeys[instruction.programIdIndex]) {
                  console.warn(`ProgramIdIndex ${instruction.programIdIndex} виходить за межі accountKeys у транзакції:`, tx.transaction.signatures[0]);
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
                      console.log(`Отримувач: ${receiverAddress}, Лампорти: ${lamports} (${solAmount} SOL)`);

                      // Отримати баланс перед транзакцією
                      const preBalance = await connectionHttp.getBalance(receiverAddress, 'processed');
                      console.log(`Баланс до транзакції: ${preBalance / 1e9} SOL для отримувача: ${receiverAddress}`);

                      if (preBalance === 0) {
                        console.log(`💰 Новий гаманець виявлено: ${receiverAddress} отримав ${solAmount} SOL`);
                      }

                      return {
                        signature: tx.transaction.signatures[0],
                        receiver: receiverAddress,
                        solAmount
                      };
                    }
                  } else {
                    console.warn(`Недостатньо байтів у dataBuffer для зчитування лампортів. Транзакція: ${tx.transaction.signatures[0]}`);
                  }
                }
              }
              return null;
            })
          );

          const validTransactions = highValueTransactions.filter(tx => tx !== null);

          console.log(`Кількість транзакцій із трансфером ${SOL_AMOUNT}+ SOL: ${validTransactions.length}`);
          validTransactions.forEach((tx, index) => {
            console.log(`Транзакція з трансфером ${SOL_AMOUNT}+ SOL ${index + 1}: Підпис: ${tx.signature}, Отримувач: ${tx.receiver}, Сума: ${tx.solAmount} SOL`);
          });
        }
      } catch (error) {
        console.error('Помилка при обробці слота:', error.message);
      }
    }, 1000);
  } catch (error) {
    console.error('Помилка:', error.message);
    console.error(error);
  }
};

main();
