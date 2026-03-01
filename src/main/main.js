const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const DataStore = require('./dataStore');
const AIService = require('./aiService');
const FileService = require('./fileService');
const BrowserService = require('./browserService');
const { Logger, setupErrorHandlers } = require('./logger');

let mainWindow;
let dataStore;
let aiService;
let fileService;
let browserService;
let logger;

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
  try {
    // Initialize logger first (after app is ready)
    logger = new Logger();
    setupErrorHandlers(logger);
    logger.info('Application starting', { version: app.getVersion() });
    
    // Initialize data store
    dataStore = new DataStore();
    logger.info('DataStore initialized');
    
    // Initialize AI service with config
    const config = dataStore.getConfig();
    aiService = new AIService(config);
    logger.info('AIService initialized');
    
    // Initialize file service
    fileService = new FileService(dataStore.dataPath);
    logger.info('FileService initialized');
    
    // Initialize browser service
    browserService = new BrowserService();
    browserService.setStatusCallback((status) => {
      if (mainWindow) {
        mainWindow.webContents.send('browser-status', status);
      }
    });
    logger.info('BrowserService initialized');

    createWindow();
    setupIPC();
    logger.info('Application ready');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    if (logger) {
      logger.error('Failed to initialize application', { error: error.message, stack: error.stack });
    }
    dialog.showErrorBox('鍒濆鍖栭敊璇?, `搴旂敤鍚姩澶辫触: ${error.message}`);
    app.quit();
  }
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
        logger.warn('Chat attempted without API key', { model });
        return { 
          error: true, 
          message: `${model} API瀵嗛挜鏈厤缃紝璇峰湪璁剧疆涓坊鍔燻 
        };
      }

      logger.info('Chat request', { model, messageCount: messages.length });
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

      logger.info('Chat completed', { model, responseLength: fullContent.length });
      return { content: fullContent };
    } catch (error) {
      logger.error('Chat error', { error: error.message, model });
      return { 
        error: true, 
        message: error.message || '璇锋眰澶辫触锛岃妫€鏌ョ綉缁滄垨API瀵嗛挜' 
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
      title: '璁剧疆',
      message: '璇峰湪璁剧疆闈㈡澘涓厤缃瓵PI瀵嗛挜',
      buttons: ['鎵撳紑璁剧疆', '鍙栨秷']
    });

    return result.response === 0;
  });

  // File operations
  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: '鎵€鏈夋敮鎸佺殑鏂囦欢', extensions: ['pdf', 'docx', 'doc', 'txt', 'md', 'png', 'jpg', 'jpeg', 'gif'] },
        { name: '鏂囨。', extensions: ['pdf', 'docx', 'doc', 'txt', 'md'] },
        { name: '鍥剧墖', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] },
        { name: '鎵€鏈夋枃浠?, extensions: ['*'] }
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
      if (!session) return { error: true, message: '浼氳瘽涓嶅瓨鍦? };

      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: `${session.title}.md`,
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: '鎵€鏈夋枃浠?, extensions: ['*'] }
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
        defaultPath: '瀵硅瘽.pdf',
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

  // Browser control operations
  ipcMain.handle('browser-launch', async () => {
    try {
      await browserService.launch();
      return { success: true };
    } catch (error) {
      return { error: true, message: error.message };
    }
  });

  ipcMain.handle('browser-close', async () => {
    await browserService.close();
    return { success: true };
  });

  ipcMain.handle('browser-execute', async (event, instruction) => {
    try {
      const config = dataStore.getConfig();
      const allowedDomains = config.browser?.allowedDomains || [];
      
      const result = await browserService.executeTask(instruction, allowedDomains);
      return result;
    } catch (error) {
      return { error: true, message: error.message };
    }
  });

  ipcMain.handle('browser-status', () => {
    return browserService.getStatus();
  });
}

  // ========== Student Management ==========
  ipcMain.handle('student-get-all', async () => {
    try {
      const studentService = require('./studentService');
      const students = studentService.getAllStudents();
      return { success: true, data: students };
    } catch (error) {
      return { error: true, message: error.message };
    }
  });

  ipcMain.handle('student-create', async (event, data) => {
    try {
      const studentService = require('./studentService');
      const student = studentService.createStudent(data);
      return { success: true, data: student };
    } catch (error) {
      return { error: true, message: error.message };
    }
  });

  ipcMain.handle('student-delete', async (event, studentId) => {
    try {
      const studentService = require('./studentService');
      studentService.deleteStudent(studentId);
      return { success: true };
    } catch (error) {
      return { error: true, message: error.message };
    }
  });

  // ========== Composition Grading ==========
  ipcMain.handle('composition-grade', async (event, text, options) => {
    try {
      const { gradeComposition } = require('./compositionService');
      const result = await gradeComposition(text, options);
      return { success: true, data: result };
    } catch (error) {
      return { error: true, message: error.message };
    }
  });

  ipcMain.handle('composition-create-batch', async (event, studentId, title) => {
    try {
      const { createBatch } = require('./compositionService');
      const batch = createBatch(studentId, title);
      return { success: true, data: batch };
    } catch (error) {
      return { error: true, message: error.message };
    }
  });


  // Open grading interface
  ipcMain.handle('open-grading', () => {
    const gradingWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    gradingWindow.loadFile(path.join(__dirname, '../renderer/grading.html'));
    return { success: true };
  });


  // ========== Template Management ==========
  ipcMain.handle('template-get-all', async () => {
    try {
      const { getAllTemplates } = require('./templateService');
      const templates = getAllTemplates();
      return { success: true, data: templates };
    } catch (error) {
      return { error: true, message: error.message };
    }
  });

  ipcMain.handle('template-add', async (event, grade, text, tags) => {
    try {
      const { addTemplate } = require('./templateService');
      const template = addTemplate(grade, text, tags);
      return { success: true, data: template };
    } catch (error) {
      return { error: true, message: error.message };
    }
  });

  ipcMain.handle('template-delete', async (event, grade, templateId) => {
    try {
      const { deleteTemplate } = require('./templateService');
      deleteTemplate(grade, templateId);
      return { success: true };
    } catch (error) {
      return { error: true, message: error.message };
    }
  });

  // ========== Batch Grading ==========
  ipcMain.handle('batch-create', async (event, studentId, compositions) => {
    try {
      const { createBatchTask } = require('./batchService');
      const batch = createBatchTask(studentId, compositions);
      return { success: true, data: batch };
    } catch (error) {
      return { error: true, message: error.message };
    }
  });

  ipcMain.handle('batch-execute', async (event, batchId, options) => {
    try {
      const { executeBatch } = require('./batchService');
      const result = await executeBatch(batchId, options);
      return { success: true, data: result };
    } catch (error) {
      return { error: true, message: error.message };
    }
  });

  ipcMain.handle('batch-get', async (event, batchId) => {
    try {
      const { getBatchTask } = require('./batchService');
      const batch = getBatchTask(batchId);
      return { success: true, data: batch };
    } catch (error) {
      return { error: true, message: error.message };
    }
  });

  ipcMain.handle('batch-list', async (event, studentId) => {
    try {
      const { getAllBatchTasks } = require('./batchService');
      const batches = getAllBatchTasks(studentId);
      return { success: true, data: batches };
    } catch (error) {
      return { error: true, message: error.message };
    }
  });

  // Open additional pages
  ipcMain.handle('open-batch-grading', () => {
    const win = new BrowserWindow({ width: 1200, height: 800, webPreferences: { nodeIntegration: true, contextIsolation: false } });
    win.loadFile(path.join(__dirname, '../renderer/batch-grading.html'));
    return { success: true };
  });

  ipcMain.handle('open-report', () => {
    const win = new BrowserWindow({ width: 1000, height: 800, webPreferences: { nodeIntegration: true, contextIsolation: false } });
    win.loadFile(path.join(__dirname, '../renderer/report.html'));
    return { success: true };
  });

  ipcMain.handle('open-parent-comm', () => {
    const win = new BrowserWindow({ width: 1200, height: 800, webPreferences: { nodeIntegration: true, contextIsolation: false } });
    win.loadFile(path.join(__dirname, '../renderer/parent-comm.html'));
    return { success: true };
  });
