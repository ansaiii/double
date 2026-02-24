const { ipcRenderer } = require('electron');

// State management
const state = {
  currentSession: null,
  sessions: [],
  config: null,
  isStreaming: false,
  currentModel: 'deepseek',
  theme: 'auto',
  pendingFiles: []
};

// DOM Elements
const elements = {
  sessionList: document.getElementById('session-list'),
  messagesContainer: document.getElementById('messages-container'),
  welcomeScreen: document.getElementById('welcome-screen'),
  messageInput: document.getElementById('message-input'),
  sendBtn: document.getElementById('send-btn'),
  newSessionBtn: document.getElementById('new-session-btn'),
  modelSelect: document.getElementById('model-select'),
  searchInput: document.getElementById('search-input'),
  settingsBtn: document.getElementById('settings-btn'),
  settingsModal: document.getElementById('settings-modal'),
  renameModal: document.getElementById('rename-modal'),
  attachmentBtn: document.getElementById('attachment-btn'),
  fileAttachments: document.getElementById('file-attachments'),
  currentModel: document.getElementById('current-model')
};

// Initialize
async function init() {
  await loadConfig();
  await loadSessions();
  setupEventListeners();
  setupTheme();
  
  // Check if API keys are configured
  const config = state.config;
  if (!config.models.deepseek?.apiKey && !config.models.moonshot?.apiKey) {
    showSettings();
  }
}

// Load configuration
async function loadConfig() {
  state.config = await ipcRenderer.invoke('get-config');
  state.currentModel = state.config.defaultModel || 'deepseek';
  state.theme = state.config.theme || 'auto';
  
  // Update UI
  elements.modelSelect.value = state.currentModel;
  updateCurrentModelDisplay();
}

// Load all sessions
async function loadSessions() {
  state.sessions = await ipcRenderer.invoke('get-all-sessions');
  renderSessionList();
}

// Render session list
function renderSessionList() {
  elements.sessionList.innerHTML = '';
  
  if (state.sessions.length === 0) {
    elements.sessionList.innerHTML = `
      <div class="empty-state">
        <p>暂无会话</p>
        <p style="font-size: 12px; margin-top: 8px;">点击"新会话"开始</p>
      </div>
    `;
    return;
  }
  
  state.sessions.forEach(session => {
    const item = document.createElement('div');
    item.className = `session-item ${state.currentSession?.id === session.id ? 'active' : ''}`;
    item.innerHTML = `
      <div class="session-info">
        <div class="session-title">${escapeHtml(session.title)}</div>
        <div class="session-meta">${formatDate(session.updatedAt)} · ${session.messageCount}条消息</div>
      </div>
      <div class="session-actions">
        <button class="rename-btn" data-id="${session.id}" title="重命名">✏️</button>
        <button class="delete-btn" data-id="${session.id}" title="删除">🗑️</button>
      </div>
    `;
    
    item.addEventListener('click', (e) => {
      if (!e.target.closest('.session-actions')) {
        loadSession(session.id);
      }
    });
    
    elements.sessionList.appendChild(item);
  });
  
  // Add event listeners for action buttons
  document.querySelectorAll('.rename-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showRenameDialog(btn.dataset.id);
    });
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSession(btn.dataset.id);
    });
  });
}

// Load a specific session
async function loadSession(id) {
  const session = await ipcRenderer.invoke('get-session', id);
  if (!session) return;
  
  state.currentSession = session;
  renderSessionList();
  renderMessages(session.messages);
  
  elements.welcomeScreen.style.display = 'none';
  elements.messagesContainer.style.display = 'block';
}

// Render messages
function renderMessages(messages) {
  elements.messagesContainer.innerHTML = '';
  
  messages.forEach(msg => {
    appendMessage(msg);
  });
  
  scrollToBottom();
}

// Append a single message
function appendMessage(message) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${message.role}`;
  msgDiv.dataset.id = message.id;
  
  const avatar = message.role === 'user' ? '👤' : '🤖';
  const name = message.role === 'user' ? '你' : 'AI';
  
  msgDiv.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">
      <div class="message-header">${name} · ${formatTime(message.timestamp)}</div>
      <div class="message-text">${formatContent(message.content)}</div>
    </div>
  `;
  
  elements.messagesContainer.appendChild(msgDiv);
  scrollToBottom();
}

// Update streaming message
function updateStreamingMessage(content) {
  let msgDiv = elements.messagesContainer.querySelector('.message.assistant:last-child');
  
  if (!msgDiv || !msgDiv.classList.contains('streaming')) {
    msgDiv = document.createElement('div');
    msgDiv.className = 'message assistant streaming';
    msgDiv.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <div class="message-header">AI · ${formatTime(new Date().toISOString())}</div>
        <div class="message-text"></div>
      </div>
    `;
    elements.messagesContainer.appendChild(msgDiv);
  }
  
  const textDiv = msgDiv.querySelector('.message-text');
  textDiv.innerHTML = formatContent(content);
  scrollToBottom();
}

// Create new session
async function createSession() {
  const session = await ipcRenderer.invoke('create-session', '新会话');
  state.sessions.unshift(session);
  state.currentSession = session;
  renderSessionList();
  
  elements.welcomeScreen.style.display = 'none';
  elements.messagesContainer.style.display = 'block';
  elements.messagesContainer.innerHTML = '';
}

// Delete session
async function deleteSession(id) {
  if (!confirm('确定要删除这个会话吗？')) return;
  
  await ipcRenderer.invoke('delete-session', id);
  state.sessions = state.sessions.filter(s => s.id !== id);
  
  if (state.currentSession?.id === id) {
    state.currentSession = null;
    elements.welcomeScreen.style.display = 'flex';
    elements.messagesContainer.style.display = 'none';
    elements.messagesContainer.innerHTML = '';
  }
  
  renderSessionList();
}

// Show rename dialog
function showRenameDialog(id) {
  const session = state.sessions.find(s => s.id === id);
  if (!session) return;
  
  document.getElementById('rename-input').value = session.title;
  document.getElementById('rename-session-id').value = id;
  elements.renameModal.classList.add('show');
}

// Rename session
async function renameSession() {
  const id = document.getElementById('rename-session-id').value;
  const newTitle = document.getElementById('rename-input').value.trim();
  
  if (!newTitle) return;
  
  await ipcRenderer.invoke('rename-session', id, newTitle);
  
  const session = state.sessions.find(s => s.id === id);
  if (session) {
    session.title = newTitle;
  }
  
  renderSessionList();
  closeRenameDialog();
}

// Send message
async function sendMessage() {
  const content = elements.messageInput.value.trim();
  const hasAttachments = state.pendingFiles.length > 0;
  
  if ((!content && !hasAttachments) || state.isStreaming) return;
  
  // Check if session exists
  if (!state.currentSession) {
    await createSession();
  }
  
  // Clear input
  elements.messageInput.value = '';
  elements.messageInput.style.height = 'auto';
  
  // Build message content with attachments
  let fullContent = content;
  let attachments = [];
  
  if (hasAttachments) {
    for (const file of state.pendingFiles) {
      if (file.extractedText) {
        fullContent += `\n\n[文件: ${file.originalName}]\n${file.extractedText.substring(0, 5000)}`; // Limit text length
      }
      attachments.push(file);
    }
    
    // Clear pending files
    state.pendingFiles = [];
    renderPendingFiles();
  }
  
  // Add user message
  const userMessage = {
    role: 'user',
    content: fullContent,
    type: 'text',
    attachments: attachments.map(a => ({ name: a.originalName, path: a.path }))
  };
  
  const savedUserMsg = await ipcRenderer.invoke('add-message', state.currentSession.id, userMessage);
  appendMessage({
    ...savedUserMsg,
    content: content || '[文件内容]'
  });
  
  // Update session in list
  const session = state.sessions.find(s => s.id === state.currentSession.id);
  if (session) {
    session.messageCount++;
    session.updatedAt = new Date().toISOString();
    renderSessionList();
  }
  
  // Get AI response
  state.isStreaming = true;
  elements.sendBtn.disabled = true;
  
  try {
    const messages = state.currentSession.messages.map(m => ({
      role: m.role,
      content: m.content
    }));
    
    const result = await ipcRenderer.invoke('chat', state.currentSession.id, messages, state.currentModel);
    
    if (result.error) {
      appendMessage({
        role: 'assistant',
        content: `❌ 错误：${result.message}`,
        timestamp: new Date().toISOString()
      });
    } else {
      // Save assistant message
      const assistantMessage = {
        role: 'assistant',
        content: result.content,
        type: 'text'
      };
      
      const savedAssistantMsg = await ipcRenderer.invoke('add-message', state.currentSession.id, assistantMessage);
      
      // Remove streaming indicator and add final message
      const streamingMsg = elements.messagesContainer.querySelector('.message.streaming');
      if (streamingMsg) {
        streamingMsg.remove();
      }
      
      appendMessage(savedAssistantMsg);
      
      // Update session
      if (session) {
        session.messageCount++;
        session.updatedAt = new Date().toISOString();
        renderSessionList();
      }
    }
  } catch (error) {
    appendMessage({
      role: 'assistant',
      content: `❌ 请求失败：${error.message}`,
      timestamp: new Date().toISOString()
    });
  } finally {
    state.isStreaming = false;
    elements.sendBtn.disabled = false;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Send message
  elements.sendBtn.addEventListener('click', sendMessage);
  
  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  elements.messageInput.addEventListener('input', () => {
    elements.messageInput.style.height = 'auto';
    elements.messageInput.style.height = elements.messageInput.scrollHeight + 'px';
  });
  
  // New session
  elements.newSessionBtn.addEventListener('click', createSession);
  
  // Model select
  elements.modelSelect.addEventListener('change', (e) => {
    state.currentModel = e.target.value;
    updateCurrentModelDisplay();
  });
  
  // Search
  elements.searchInput.addEventListener('input', debounce(async (e) => {
    const query = e.target.value.trim();
    if (!query) {
      await loadSessions();
      return;
    }
    
    const results = await ipcRenderer.invoke('search-messages', query);
    // Show search results (simplified for now)
    if (results.length > 0) {
      const sessionIds = [...new Set(results.map(r => r.sessionId))];
      state.sessions = state.sessions.filter(s => sessionIds.includes(s.id));
      renderSessionList();
    }
  }, 300));
  
  // Settings
  elements.settingsBtn.addEventListener('click', showSettings);
  document.getElementById('close-settings').addEventListener('click', hideSettings);
  document.getElementById('open-settings-btn').addEventListener('click', showSettings);
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  
  // Settings tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
  
  // Test API buttons
  document.querySelectorAll('.btn-test').forEach(btn => {
    btn.addEventListener('click', async () => {
      const model = btn.dataset.model;
      btn.textContent = '测试中...';
      btn.disabled = true;
      
      const result = await testApiKey(model);
      
      btn.textContent = result.valid ? '✅ 有效' : '❌ 失败';
      setTimeout(() => {
        btn.textContent = '测试';
        btn.disabled = false;
      }, 2000);
    });
  });
  
  // Rename dialog
  document.getElementById('close-rename').addEventListener('click', closeRenameDialog);
  document.getElementById('cancel-rename').addEventListener('click', closeRenameDialog);
  document.getElementById('confirm-rename').addEventListener('click', renameSession);
  
  // Quick action items
  document.querySelectorAll('.quick-action-item').forEach(item => {
    item.addEventListener('click', () => {
      const prompt = item.dataset.prompt;
      elements.messageInput.value = prompt;
      sendMessage();
    });
  });
  
  // Theme buttons
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      setTheme(theme);
      
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  // Clear chat
  document.getElementById('clear-chat-btn').addEventListener('click', async () => {
    if (!state.currentSession) return;
    if (!confirm('确定要清空当前对话吗？')) return;
    
    // Delete and recreate session
    await ipcRenderer.invoke('delete-session', state.currentSession.id);
    await createSession();
  });
  
  // Export buttons
  document.getElementById('export-md-btn').addEventListener('click', exportToMarkdown);
  document.getElementById('export-pdf-btn').addEventListener('click', exportToPdf);
  
  // File attachment
  elements.attachmentBtn.addEventListener('click', selectFile);
  
  // Drag and drop
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await addPendingFile(file.path, file.name);
    }
  });
  
  // Window controls
  document.getElementById('minimize-btn').addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
  });
  
  document.getElementById('maximize-btn').addEventListener('click', () => {
    ipcRenderer.send('maximize-window');
  });
  
  document.getElementById('close-btn').addEventListener('click', () => {
    ipcRenderer.send('close-window');
  });
  
  // Chat stream listener
  ipcRenderer.on('chat-stream', (event, data) => {
    if (data.sessionId === state.currentSession?.id) {
      updateStreamingMessage(data.fullContent);
    }
  });
}

// Show settings modal
function showSettings() {
  const config = state.config;
  
  document.getElementById('deepseek-apikey').value = config.models.deepseek?.apiKey || '';
  document.getElementById('deepseek-model').value = config.models.deepseek?.defaultModel || 'deepseek-chat';
  document.getElementById('moonshot-apikey').value = config.models.moonshot?.apiKey || '';
  document.getElementById('moonshot-model').value = config.models.moonshot?.defaultModel || 'moonshot-v1-128k';
  document.getElementById('theme-select').value = config.theme || 'auto';
  
  elements.settingsModal.classList.add('show');
}

// Hide settings modal
function hideSettings() {
  elements.settingsModal.classList.remove('show');
}

// Save settings
async function saveSettings() {
  const config = {
    ...state.config,
    theme: document.getElementById('theme-select').value,
    models: {
      deepseek: {
        ...state.config.models.deepseek,
        apiKey: document.getElementById('deepseek-apikey').value.trim(),
        defaultModel: document.getElementById('deepseek-model').value
      },
      moonshot: {
        ...state.config.models.moonshot,
        apiKey: document.getElementById('moonshot-apikey').value.trim(),
        defaultModel: document.getElementById('moonshot-model').value
      }
    }
  };
  
  await ipcRenderer.invoke('save-config', config);
  state.config = config;
  
  setTheme(config.theme);
  hideSettings();
}

// Close rename dialog
function closeRenameDialog() {
  elements.renameModal.classList.remove('show');
}

// Test API key
async function testApiKey(model) {
  const config = { ...state.config };
  
  if (model === 'deepseek') {
    config.models.deepseek.apiKey = document.getElementById('deepseek-apikey').value.trim();
  } else {
    config.models.moonshot.apiKey = document.getElementById('moonshot-apikey').value.trim();
  }
  
  await ipcRenderer.invoke('save-config', config);
  
  return await ipcRenderer.invoke('validate-api-key', model);
}

// Update current model display
function updateCurrentModelDisplay() {
  const modelName = state.currentModel === 'deepseek' ? 'DeepSeek' : 'Moonshot';
  elements.currentModel.textContent = modelName;
}

// Theme management
function setupTheme() {
  setTheme(state.theme);
}

function setTheme(theme) {
  state.theme = theme;
  
  let effectiveTheme = theme;
  if (theme === 'auto') {
    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  document.documentElement.setAttribute('data-theme', effectiveTheme);
  
  // Update theme button states
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

// File handling functions
async function selectFile() {
  const fileInfo = await ipcRenderer.invoke('select-file');
  if (fileInfo) {
    await addPendingFile(fileInfo.path, fileInfo.name);
  }
}

async function addPendingFile(filePath, fileName) {
  const fileInfo = await ipcRenderer.invoke('upload-file', state.currentSession?.id || 'temp', filePath, fileName);
  if (fileInfo.error) {
    alert('文件上传失败: ' + fileInfo.message);
    return;
  }
  
  state.pendingFiles.push(fileInfo);
  renderPendingFiles();
}

function renderPendingFiles() {
  elements.fileAttachments.innerHTML = '';
  
  state.pendingFiles.forEach((file, index) => {
    const attachment = document.createElement('div');
    attachment.className = 'file-attachment';
    
    const icon = getFileIcon(file.fileName);
    attachment.innerHTML = `
      <span class="file-icon">${icon}</span>
      <span class="file-name">${escapeHtml(file.originalName)}</span>
      <button class="file-remove" data-index="${index}">✕</button>
    `;
    
    elements.fileAttachments.appendChild(attachment);
  });
  
  // Add remove listeners
  document.querySelectorAll('.file-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      state.pendingFiles.splice(index, 1);
      renderPendingFiles();
    });
  });
}

function getFileIcon(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const icons = {
    'pdf': '📄',
    'doc': '📝',
    'docx': '📝',
    'txt': '📃',
    'md': '📑',
    'png': '🖼️',
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'gif': '🖼️'
  };
  return icons[ext] || '📎';
}

// Export functions
async function exportToMarkdown() {
  if (!state.currentSession) {
    alert('请先选择一个会话');
    return;
  }
  
  const session = await ipcRenderer.invoke('get-session', state.currentSession.id);
  if (!session || !session.messages.length) {
    alert('会话中没有消息');
    return;
  }
  
  let content = `# ${session.title}\n\n`;
  content += `> 导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  content += `---\n\n`;
  
  session.messages.forEach(msg => {
    const role = msg.role === 'user' ? '👤 用户' : '🤖 AI';
    const time = new Date(msg.timestamp).toLocaleString('zh-CN');
    content += `## ${role} · ${time}\n\n${msg.content}\n\n---\n\n`;
  });
  
  const result = await ipcRenderer.invoke('export-markdown', state.currentSession.id, content);
  if (result.success) {
    showNotification(`已导出到: ${result.path}`);
  } else if (result.error) {
    alert('导出失败: ' + result.message);
  }
}

async function exportToPdf() {
  if (!state.currentSession) {
    alert('请先选择一个会话');
    return;
  }
  
  const session = await ipcRenderer.invoke('get-session', state.currentSession.id);
  if (!session || !session.messages.length) {
    alert('会话中没有消息');
    return;
  }
  
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(session.title)}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; line-height: 1.6; }
        h1 { color: #333; border-bottom: 2px solid #4a90d9; padding-bottom: 10px; }
        .meta { color: #666; margin-bottom: 20px; }
        .message { margin: 20px 0; padding: 15px; border-radius: 8px; }
        .message.user { background: #e3f2fd; }
        .message.assistant { background: #f5f5f5; }
        .role { font-weight: bold; margin-bottom: 8px; }
        .content { white-space: pre-wrap; }
        code { background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 4px; }
        pre { background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; overflow-x: auto; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(session.title)}</h1>
      <div class="meta">导出时间: ${new Date().toLocaleString('zh-CN')}</div>
  `;
  
  session.messages.forEach(msg => {
    const role = msg.role === 'user' ? '👤 用户' : '🤖 AI';
    const content = formatContentForPdf(msg.content);
    htmlContent += `
      <div class="message ${msg.role}">
        <div class="role">${role}</div>
        <div class="content">${content}</div>
      </div>
    `;
  });
  
  htmlContent += '</body></html>';
  
  const result = await ipcRenderer.invoke('export-pdf', htmlContent);
  if (result.success) {
    showNotification(`已导出到: ${result.path}`);
  } else if (result.error) {
    alert('导出失败: ' + result.message);
  }
}

function formatContentForPdf(content) {
  // Convert markdown-like to HTML
  let html = escapeHtml(content);
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function showNotification(message) {
  // Simple notification - could be improved with a toast component
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--success-color);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 9999;
    font-size: 14px;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatContent(content) {
  // Simple markdown-like formatting
  let formatted = escapeHtml(content);
  
  // Code blocks
  formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  
  // Inline code
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Line breaks
  formatted = formatted.replace(/\n/g, '<br>');
  
  return formatted;
}

function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  
  return date.toLocaleDateString('zh-CN');
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
  elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Start the app
init();
