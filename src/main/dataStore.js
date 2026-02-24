const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class DataStore {
  constructor() {
    this.dataPath = path.join(app.getPath('userData'), 'double-data');
    this.sessionsPath = path.join(this.dataPath, 'sessions');
    this.configPath = path.join(this.dataPath, 'config.json');
    this.indexPath = path.join(this.sessionsPath, 'index.json');
    
    this.init();
  }

  init() {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
    if (!fs.existsSync(this.sessionsPath)) {
      fs.mkdirSync(this.sessionsPath, { recursive: true });
    }
    if (!fs.existsSync(this.configPath)) {
      this.saveConfig(this.getDefaultConfig());
    }
    if (!fs.existsSync(this.indexPath)) {
      this.saveSessionIndex({ sessions: [] });
    }
  }

  getDefaultConfig() {
    return {
      version: '1.0.0',
      theme: 'auto',
      models: {
        deepseek: {
          enabled: true,
          apiKey: '',
          defaultModel: 'deepseek-chat',
          baseUrl: 'https://api.deepseek.com'
        },
        moonshot: {
          enabled: true,
          apiKey: '',
          defaultModel: 'moonshot-v1-128k',
          baseUrl: 'https://api.moonshot.cn'
        }
      },
      defaultModel: 'deepseek'
    };
  }

  // Config operations
  getConfig() {
    try {
      const data = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return this.getDefaultConfig();
    }
  }

  saveConfig(config) {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
  }

  // Session index operations
  getSessionIndex() {
    try {
      const data = fs.readFileSync(this.indexPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return { sessions: [] };
    }
  }

  saveSessionIndex(index) {
    fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2), 'utf8');
  }

  // Session operations
  generateSessionId() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8);
    return `${date}-${random}`;
  }

  createSession(title = '新会话') {
    const id = this.generateSessionId();
    const sessionPath = path.join(this.sessionsPath, id);
    fs.mkdirSync(sessionPath, { recursive: true });

    const metadata = {
      id,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
      model: this.getConfig().defaultModel
    };

    fs.writeFileSync(
      path.join(sessionPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf8'
    );

    fs.writeFileSync(
      path.join(sessionPath, 'messages.jsonl'),
      '',
      'utf8'
    );

    const index = this.getSessionIndex();
    index.sessions.unshift(metadata);
    this.saveSessionIndex(index);

    return metadata;
  }

  deleteSession(id) {
    const sessionPath = path.join(this.sessionsPath, id);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }

    const index = this.getSessionIndex();
    index.sessions = index.sessions.filter(s => s.id !== id);
    this.saveSessionIndex(index);
  }

  renameSession(id, newTitle) {
    const sessionPath = path.join(this.sessionsPath, id);
    const metadataPath = path.join(sessionPath, 'metadata.json');
    
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      metadata.title = newTitle;
      metadata.updatedAt = new Date().toISOString();
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

      const index = this.getSessionIndex();
      const session = index.sessions.find(s => s.id === id);
      if (session) {
        session.title = newTitle;
        session.updatedAt = metadata.updatedAt;
        this.saveSessionIndex(index);
      }
    }
  }

  getSession(id) {
    const sessionPath = path.join(this.sessionsPath, id);
    const metadataPath = path.join(sessionPath, 'metadata.json');
    const messagesPath = path.join(sessionPath, 'messages.jsonl');

    if (!fs.existsSync(metadataPath)) return null;

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    let messages = [];

    if (fs.existsSync(messagesPath)) {
      const content = fs.readFileSync(messagesPath, 'utf8');
      messages = content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    }

    return { ...metadata, messages };
  }

  getAllSessions() {
    return this.getSessionIndex().sessions;
  }

  // Message operations
  addMessage(sessionId, message) {
    const sessionPath = path.join(this.sessionsPath, sessionId);
    const messagesPath = path.join(sessionPath, 'messages.jsonl');
    const metadataPath = path.join(sessionPath, 'metadata.json');

    const messageWithId = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString()
    };

    fs.appendFileSync(
      messagesPath,
      JSON.stringify(messageWithId) + '\n',
      'utf8'
    );

    // Update metadata
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      metadata.messageCount++;
      metadata.updatedAt = new Date().toISOString();
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

      // Update index
      const index = this.getSessionIndex();
      const session = index.sessions.find(s => s.id === sessionId);
      if (session) {
        session.messageCount = metadata.messageCount;
        session.updatedAt = metadata.updatedAt;
        this.saveSessionIndex(index);
      }
    }

    return messageWithId;
  }

  // Search messages
  searchMessages(query) {
    const index = this.getSessionIndex();
    const results = [];

    for (const session of index.sessions) {
      const fullSession = this.getSession(session.id);
      if (!fullSession) continue;

      for (const message of fullSession.messages) {
        if (message.content && message.content.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            sessionId: session.id,
            sessionTitle: session.title,
            messageId: message.id,
            content: message.content,
            role: message.role,
            timestamp: message.timestamp
          });
        }
      }
    }

    return results;
  }
}

module.exports = DataStore;
