const { ipcRenderer } = require('electron'); 

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const openDevToolsButton = document.getElementById('openDevTools');
const consoleLog = document.getElementById('consoleLog');

const toggleCheckbox = document.getElementById('toggleCheckbox');
const fileNameInput = document.getElementById('fileNameInput');
const tgSettingsBlock = document.getElementById('tg-settings');

toggleCheckbox.addEventListener('change', () => {
  if (toggleCheckbox.checked) {
    fileNameInput.classList.remove('hidden'); // Показати поле вводу
    tgSettingsBlock.classList.add('hidden');
  } else {
    fileNameInput.classList.add('hidden'); // Сховати поле вводу
    tgSettingsBlock.classList.remove('hidden');
    document.getElementById('fileName').value = '';
  }
});

startButton.addEventListener('click', () => {
  const wsToken = document.getElementById('wsToken').value;
  const solAmount = document.getElementById('solAmount').value;
  const telegramBotToken = document.getElementById('telegramBotToken').value;
  const telegramChatId = document.getElementById('telegramChatId').value;
  const blackList = document.getElementById('blacklistTextArea').value;
  const resultFileNameResult = document.getElementById('fileName').value;
  const isFileRequire = toggleCheckbox.checked ? resultFileNameResult.length : true;

  if (!solAmount || !blackList || !isFileRequire) {
    appendToConsoleLog('❌ Будь ласка, заповніть усі поля!');
    return;
  }
  ipcRenderer.send('start-main-process', {
    WS_TOKEN: wsToken,
    SOL_AMOUNT: solAmount,
    TELEGRAM_BOT_TOKEN: telegramBotToken,
    TELEGRAM_CHAT_ID: telegramChatId,
    BLACKLIST: blackList.replace(/\s+/g, '').split(','),
    FILENAME: resultFileNameResult,
    USE_FILE: toggleCheckbox.checked,
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
  if (consoleLog.childNodes.length > 100) {
    consoleLog.innerHTML = '';
  }
  consoleLog.appendChild(messageElement);
  consoleLog.scrollTop = consoleLog.scrollHeight;
}


