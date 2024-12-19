const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { main } = require('./app.js');

let mainWindow;
let stopProcess = false;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'renderer.js'),
      contextIsolation: false, 
      nodeIntegration: true 
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
};

app.whenReady().then(() => {
  createWindow();

  ipcMain.on('start-main-process', (event, envData) => {
    process.env = { ...process.env, ...envData };
    stopProcess = false;
    main((message, type = 'log', envData) => {
      const channel = type === 'error' ? 'error-message' : 'log-message';
      mainWindow.webContents.send(channel, message);
    }, () => stopProcess);
  });

  ipcMain.on('stop-main-process', () => {
    stopProcess = true;
    mainWindow.webContents.send('log-message', '🛑 Основний процес зупинено.');
  });

  ipcMain.on('open-devtools', () => {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  });
});

app.on('window-all-closed', () => {
  console.log('🛑 Закрито всі вікна. Завершення процесу.');
  stopProcess = true;
  app.quit();
});

app.on('before-quit', () => {
  console.log('🛑 before-quit: Завершення процесу.');
  stopProcess = true;
});

app.on('quit', () => {
  console.log('🚪 Додаток закрито.');
  process.exit(0);
});
