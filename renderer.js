const { ipcRenderer } = require('electron'); 

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const openDevToolsButton = document.getElementById('openDevTools');
const consoleLog = document.getElementById('consoleLog');

startButton.addEventListener('click', () => {
  const wsToken = document.getElementById('wsToken').value;
  const solAmount = document.getElementById('solAmount').value;
  const telegramBotToken = document.getElementById('telegramBotToken').value;
  const telegramChatId = document.getElementById('telegramChatId').value;
  const blackList = document.getElementById('blacklistTextArea').value;

  if (!wsToken || !solAmount || !telegramBotToken || !telegramChatId || !blackList) {
    appendToConsoleLog('❌ Будь ласка, заповніть усі поля!');
    return;
  }
  
  ipcRenderer.send('start-main-process', {
    WS_TOKEN: wsToken,
    SOL_AMOUNT: solAmount,
    TELEGRAM_BOT_TOKEN: telegramBotToken,
    TELEGRAM_CHAT_ID: telegramChatId,
    BLACKLIST: blackList.replace(/\s+/g, '').split(',')
  });

  appendToConsoleLog('✅ Процес запущено...');
});

stopButton.addEventListener('click', () => {
  ipcRenderer.send('stop-main-process');
  appendToConsoleLog('🛑 Процес зупинено.');
});

openDevToolsButton.addEventListener('click', () => {
  ipcRenderer.send('open-devtools');
});

ipcRenderer.on('log-message', (event, message) => {
  appendToConsoleLog(message);
});

ipcRenderer.on('error-message', (event, message) => {
  appendToConsoleLog(`❌ Помилка: ${message}`);
});

function appendToConsoleLog(message) {
  const time = new Date().toLocaleTimeString();
  const messageElement = document.createElement('span');
  messageElement.textContent = `[${time}] ${message}`;
  consoleLog.appendChild(messageElement);
  consoleLog.scrollTop = consoleLog.scrollHeight;
}
