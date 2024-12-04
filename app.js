const { Connection } = require('@solana/web3.js');
require('dotenv').config()

const main = async () => {
  try {
    // Встановіть ваш API-ключ Alchemy
    const rpcUrl = `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`;
    const connection = new Connection(rpcUrl, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
    });

    console.log('Підключення до мережі Solana...');

    // // Отримання останнього слота
    const latestSlot = await connection.getSlot();

    // Отримання блоку за останнім слотом
    const block = await connection.getBlock(latestSlot, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0, // Указуємо підтримку нових версій транзакцій
        transactionDetails: 'full', // Повна інформація про транзакції
        rewards: true, // Якщо потрібна інформація про нагороди
    });
    if (!block || block.transactions.length === 0) {
      console.log("У цьому блоці немає транзакцій.");
      return;
    }

    console.log(JSON.stringify(block.transactions[0]));

    // // Отримання підпису останньої транзакції
    // const latestTransactionSignature = block.transactions[block.transactions.length - 1].transaction.signatures[0];
    // console.log("Підпис останньої транзакції:", latestTransactionSignature);

    // Отримання деталей останньої транзакції
    // const transactionDetails = await connection.getTransaction('bnsfdiCEV4WhdxpjUE9FycU45mct76Noue15xY2huJLj9ZWEhm85LSQsoZybjzEmRxrfXsDbbpGcA3EKQxAKoEa', {
    //   commitment: 'confirmed',
    //   maxSupportedTransactionVersion: 0,
    // });

    console.log("Деталі останньої транзакції:");
    console.log(JSON.stringify(transactionDetails, null, 2));
  } catch (error) {
    console.error(error);
  }
};

main();
