const { ipcRenderer } = require('electron'); 

// Отримуємо доступ до елементів DOM
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const openDevToolsButton = document.getElementById('openDevTools');
const consoleLog = document.getElementById('consoleLog'); // Блок для логів

// Додаємо обробник кліку на кнопку "Запуск"
startButton.addEventListener('click', () => {
  const wsToken = document.getElementById('wsToken').value;
  const solAmount = document.getElementById('solAmount').value;
  const telegramBotToken = document.getElementById('telegramBotToken').value;
  const telegramChatId = document.getElementById('telegramChatId').value;

  if (!wsToken || !solAmount || !telegramBotToken || !telegramChatId) {
    appendToConsoleLog('❌ Будь ласка, заповніть усі поля!');
    return;
  }

  ipcRenderer.send('start-main-process', {
    WS_TOKEN: wsToken,
    SOL_AMOUNT: solAmount,
    TELEGRAM_BOT_TOKEN: telegramBotToken,
    TELEGRAM_CHAT_ID: telegramChatId
  });

  appendToConsoleLog('✅ Процес запущено...');
});

// Додаємо обробник кліку на кнопку "Зупинити"
stopButton.addEventListener('click', () => {
  ipcRenderer.send('stop-main-process'); // Відправити подію для зупинки основного процесу
  appendToConsoleLog('🛑 Процес зупинено.');
});

openDevToolsButton.addEventListener('click', () => {
  ipcRenderer.send('open-devtools'); // Відправити подію для відкриття DevTools
});

// Слухаємо повідомлення від основного процесу та відображаємо їх у консолі
ipcRenderer.on('log-message', (event, message) => {
  appendToConsoleLog(message);
});

ipcRenderer.on('error-message', (event, message) => {
  appendToConsoleLog(`❌ Помилка: ${message}`);
});

// Функція для додавання повідомлень до блоку логів
function appendToConsoleLog(message) {
  const time = new Date().toLocaleTimeString();
  const messageElement = document.createElement('span');
  messageElement.textContent = `[${time}] ${message}`;
  consoleLog.appendChild(messageElement);
  consoleLog.scrollTop = consoleLog.scrollHeight; // Прокручуємо лог вниз
}
