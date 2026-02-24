const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    // Wait for app to be ready before getting paths
    if (!app.isReady()) {
      throw new Error('Logger must be initialized after app is ready');
    }
    
    this.logPath = path.join(app.getPath('userData'), 'logs');
    this.ensureLogDir();
    this.currentLogFile = path.join(this.logPath, `app-${this.getDateString()}.log`);
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logPath)) {
      fs.mkdirSync(this.logPath, { recursive: true });
    }
  }

  getDateString() {
    return new Date().toISOString().split('T')[0];
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = this.getTimestamp();
    const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
    return `[${timestamp}] [${level}] ${message} ${metaStr}\n`;
  }

  write(level, message, meta) {
    const logEntry = this.formatMessage(level, message, meta);
    
    // Write to file
    try {
      fs.appendFileSync(this.currentLogFile, logEntry);
    } catch (error) {
      console.error('Failed to write log:', error);
    }

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(logEntry.trim());
    }
  }

  info(message, meta) {
    this.write('INFO', message, meta);
  }

  warn(message, meta) {
    this.write('WARN', message, meta);
  }

  error(message, meta) {
    this.write('ERROR', message, meta);
  }

  debug(message, meta) {
    if (process.env.NODE_ENV === 'development') {
      this.write('DEBUG', message, meta);
    }
  }

  // Show error dialog to user
  showErrorDialog(title, message, detail = '') {
    dialog.showErrorBox(title, `${message}\n${detail}`);
    this.error(title, { message, detail });
  }

  // Get recent logs
  getRecentLogs(lines = 100) {
    try {
      if (!fs.existsSync(this.currentLogFile)) return [];
      const content = fs.readFileSync(this.currentLogFile, 'utf8');
      return content.split('\n').filter(line => line.trim()).slice(-lines);
    } catch (error) {
      return [];
    }
  }
}

// Global error handlers
function setupErrorHandlers(logger) {
  // Catch uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { 
      message: error.message, 
      stack: error.stack 
    });
    
    dialog.showErrorBox(
      '应用程序错误',
      `发生未预期的错误:\n${error.message}\n\n应用将关闭。`
    );
    
    app.quit();
  });

  // Catch unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { 
      reason: reason?.message || reason,
      stack: reason?.stack 
    });
  });

  // Handle Electron's render process crashes
  app.on('render-process-gone', (event, webContents, details) => {
    logger.error('Render Process Crashed', details);
  });
}

module.exports = { Logger, setupErrorHandlers };
