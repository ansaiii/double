const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const DataStore = require('./dataStore');
const AIService = require('./aiService');
const FileService = require('./fileService');

let mainWindow;
let dataStore;
let aiService;
let fileService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize data store
  dataStore = new DataStore();
  
  // Initialize AI service with config
  const config = dataStore.getConfig();
  aiService = new AIService(config);
  
  // Initialize file service
  fileService = new FileService(dataStore.dataPath);

  createWindow();
  setupIPC();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function setupIPC() {
  // Config operations
  ipcMain.handle('get-config', () => {
    return dataStore.getConfig();
  });

  ipcMain.handle('save-config', (event, config) => {
    dataStore.saveConfig(config);
    // Update AI service with new config
    aiService = new AIService(config);
    return true;
  });

  // Session operations
  ipcMain.handle('create-session', (event, title) => {
    return dataStore.createSession(title);
  });

  ipcMain.handle('delete-session', (event, id) => {
    dataStore.deleteSession(id);
    return true;
  });

  ipcMain.handle('rename-session', (event, id, newTitle) => {
    dataStore.renameSession(id, newTitle);
    return true;
  });

  ipcMain.handle('get-session', (event, id) => {
    return dataStore.getSession(id);
  });

  ipcMain.handle('get-all-sessions', () => {
    return dataStore.getAllSessions();
  });

  // Message operations
  ipcMain.handle('add-message', (event, sessionId, message) => {
    return dataStore.addMessage(sessionId, message);
  });

  // Search
  ipcMain.handle('search-messages', (event, query) => {
    return dataStore.searchMessages(query);
  });

  // AI Chat
  ipcMain.handle('chat', async (event, sessionId, messages, model) => {
    try {
      const config = dataStore.getConfig();
      
      // Check if API key is configured
      if (!config.models[model]?.apiKey) {
        return { 
          error: true, 
          message: `${model} API密钥未配置，请在设置中添加` 
        };
      }

      let fullContent = '';
      
      await aiService.chat(messages, model, (chunk, full) => {
        fullContent = full;
        // Send streaming update to renderer
        event.sender.send('chat-stream', {
          sessionId,
          chunk,
          fullContent
        });
      });

      return { content: fullContent };
    } catch (error) {
      console.error('Chat error:', error);
      return { 
        error: true, 
        message: error.message || '请求失败，请检查网络或API密钥' 
      };
    }
  });

  // Validate API key
  ipcMain.handle('validate-api-key', async (event, model) => {
    return await aiService.validateApiKey(model);
  });

  // Show settings dialog
  ipcMain.handle('show-settings', async () => {
    const config = dataStore.getConfig();
    
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '设置',
      message: '请在设置面板中配置API密钥',
      buttons: ['打开设置', '取消']
    });

    return result.response === 0;
  });

  // File operations
  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: '所有支持的文件', extensions: ['pdf', 'docx', 'doc', 'txt', 'md', 'png', 'jpg', 'jpeg', 'gif'] },
        { name: '文档', extensions: ['pdf', 'docx', 'doc', 'txt', 'md'] },
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return fileService.getFileInfo(result.filePaths[0]);
    }
    return null;
  });

  ipcMain.handle('upload-file', async (event, sessionId, filePath, originalName) => {
    try {
      return await fileService.saveFile(sessionId, filePath, originalName);
    } catch (error) {
      console.error('Upload file error:', error);
      return { error: true, message: error.message };
    }
  });

  ipcMain.handle('read-file-content', async (event, filePath) => {
    try {
      const ext = path.extname(filePath).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(ext)) {
        // For images, return base64
        const base64 = await fileService.getImageBase64(filePath);
        return { type: 'image', data: base64, mimeType: fileService.getMimeType(ext) };
      } else {
        // For text files, return content
        const content = fs.readFileSync(filePath, 'utf8');
        return { type: 'text', content };
      }
    } catch (error) {
      return { error: true, message: error.message };
    }
  });

  // Export operations
  ipcMain.handle('export-markdown', async (event, sessionId, content) => {
    try {
      const session = dataStore.getSession(sessionId);
      if (!session) return { error: true, message: '会话不存在' };

      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: `${session.title}.md`,
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      });

      if (!result.canceled) {
        fs.writeFileSync(result.filePath, content, 'utf8');
        return { success: true, path: result.filePath };
      }
      return { canceled: true };
    } catch (error) {
      return { error: true, message: error.message };
    }
  });

  ipcMain.handle('export-pdf', async (event, htmlContent) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: '对话.pdf',
        filters: [
          { name: 'PDF', extensions: ['pdf'] }
        ]
      });

      if (!result.canceled) {
        // Use Electron's print to PDF feature
        const win = new BrowserWindow({ show: false });
        await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
        const pdfBuffer = await win.webContents.printToPDF({
          marginsType: 1,
          printBackground: true,
          printSelectionOnly: false,
          landscape: false
        });
        fs.writeFileSync(result.filePath, pdfBuffer);
        win.close();
        return { success: true, path: result.filePath };
      }
      return { canceled: true };
    } catch (error) {
      return { error: true, message: error.message };
    }
  });
}
