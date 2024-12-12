const { Connection } = require('@solana/web3.js');
require('dotenv').config();

const { WS_TOKEN } = process.env;

const main = async () => {
  console.log('start');
  
  try {
    const httpUrl = `https://rpc-mainnet.solanatracker.io/?api_key=${WS_TOKEN}`;
    const connectionHttp = new Connection(httpUrl, 'finalized');

      try {
        const block = await connectionHttp.getBlock(306973314, {
            commitment: 'finalized',
            transactionDetails: 'full', 
            rewards: true, 
            maxSupportedTransactionVersion: 0, 
        });
        
        const tx = await connectionHttp.getTransaction('58S9WjwdWaciZmomuijg9brqPK1MEa8iEib55V3gzqUjFHYuwYDkfZg9EnvcrTQBuPwma74dXdWmxzQuFGZw7ZZv');
        
        const accountKeys = tx.transaction.message.accountKeys;
        const instructions = tx.transaction.message.instructions;
        for (const instruction of instructions) {
          if (!accountKeys[instruction.programIdIndex]) {
            console.log('break');
            continue;
          }

          const programId = accountKeys[instruction.programIdIndex].toString();
          const dataBuffer = Buffer.from(instruction.data, 'base64');
          
          const systemProgramId = '11111111111111111111111111111111';
          
          if (programId === systemProgramId && dataBuffer[0] === 220) {
            const preBalances = tx.meta.preBalances;
            const postBalances = tx.meta.postBalances;
            
            // Обчислюємо зміну балансу для кожного акаунту
            const balanceChanges = preBalances.map((preBalance, index) => {
              const postBalance = postBalances[index];
              const change = postBalance - preBalance;
              return {
                account: tx.transaction.message.accountKeys[index] || `Account${index + 1}`,
                preBalance: preBalance / 1e9, // Конвертуємо лампорти у SOL
                postBalance: postBalance / 1e9, // Конвертуємо лампорти у SOL
                change: change / 1e9 // Конвертуємо зміну у SOL
              };
            });
            
            // Визначаємо відправників та одержувачів
            const senders = balanceChanges.filter(change => change.change < 0);
            const receivers = balanceChanges.filter(change => change.change > 0);
            console.log(receivers[0].account.toString());
            
          }
        }
      } catch (error) {
        console.log('tx: ', error);
      }
  } catch (error) {
    console.log('connection: ', error);
    
  }
};

main();

// module.exports = { main };