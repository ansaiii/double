const { ipcRenderer } = require('electron');

// State management
const state = {
  currentSession: null,
  sessions: [],
  config: null,
  isStreaming: false,
  currentModel: 'deepseek',
  theme: 'auto',
  pendingFiles: [],
  browserTask: null
};

// DOM Elements
const elements = {};

function initElements() {
  elements.sessionList = document.getElementById('session-list');
  elements.messagesContainer = document.getElementById('messages-container');
  elements.welcomeScreen = document.getElementById('welcome-screen');
  elements.messageInput = document.getElementById('message-input');
  elements.sendBtn = document.getElementById('send-btn');
  elements.newSessionBtn = document.getElementById('new-session-btn');
  elements.modelSelect = document.getElementById('model-select');
  elements.searchInput = document.getElementById('search-input');
  elements.settingsBtn = document.getElementById('settings-btn');
  elements.settingsModal = document.getElementById('settings-modal');
  elements.renameModal = document.getElementById('rename-modal');
  elements.attachmentBtn = document.getElementById('attachment-btn');
  elements.fileAttachments = document.getElementById('file-attachments');
  elements.currentModel = document.getElementById('current-model');
  elements.taskStatus = document.getElementById('task-status');
  elements.taskProgress = document.getElementById('task-progress');
  elements.browserPreview = document.getElementById('browser-preview');
  elements.browserScreenshot = document.getElementById('browser-screenshot');
  elements.browserLaunchBtn = document.getElementById('browser-launch-btn');
  elements.browserCloseBtn = document.getElementById('browser-close-btn');
  
  // Check if critical elements exist
  const criticalElements = ['sessionList', 'messagesContainer', 'welcomeScreen', 'messageInput', 'sendBtn'];
  for (const name of criticalElements) {
    if (!elements[name]) {
      console.error(`[Double] 关键元素缺失: ${name}`);
      return false;
    }
  }
  return true;
}

// Initialize
async function init() {
  console.log('[Double] 初始化开始...');
  
  // Initialize DOM elements first
  if (!initElements()) {
    alert('页面元素加载失败，请刷新重试');
    return;
  }
  console.log('[Double] DOM元素初始化完成');
  
  try {
    await loadConfig();
    console.log('[Double] 配置加载完成');
    
    await loadSessions();
    console.log('[Double] 会话列表加载完成');
    
    setupEventListeners();
    console.log('[Double] 事件监听器设置完成');
    
    setupTheme();
    console.log('[Double] 主题设置完成');
    
    // Check if API keys are configured
    const config = state.config;
    if (config && !config.models.deepseek?.apiKey && !config.models.moonshot?.apiKey) {
      showSettings();
    }
    
    console.log('[Double] 初始化完成！');
  } catch (error) {
    console.error('[Double] 初始化失败:', error);
    alert('应用初始化失败: ' + error.message);
  }
}

// Load configuration
async function loadConfig() {
  try {
    state.config = await ipcRenderer.invoke('get-config');
    state.currentModel = state.config.defaultModel || 'deepseek';
    state.theme = state.config.theme || 'auto';
    
    // Update UI
    if (elements.modelSelect) {
      elements.modelSelect.value = state.currentModel;
    }
    updateCurrentModelDisplay();
  } catch (error) {
    console.error('[Double] 加载配置失败:', error);
    // 使用默认配置
    state.config = {
      version: '1.0.0',
      theme: 'auto',
      models: {
        deepseek: { enabled: true, apiKey: '', defaultModel: 'deepseek-chat' },
        moonshot: { enabled: true, apiKey: '', defaultModel: 'moonshot-v1-128k' }
      },
      defaultModel: 'deepseek'
    };
    state.currentModel = 'deepseek';
    state.theme = 'auto';
  }
}

// Load all sessions
async function loadSessions() {
  try {
    state.sessions = await ipcRenderer.invoke('get-all-sessions');
    renderSessionList();
  } catch (error) {
    console.error('[Double] 加载会话失败:', error);
    state.sessions = [];
    renderSessionList();
  }
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
  
  // Use requestAnimationFrame for smooth rendering
  requestAnimationFrame(() => {
    renderMessages(session.messages);
    elements.welcomeScreen.style.display = 'none';
    elements.messagesContainer.style.display = 'block';
  });
}

// Render messages with virtualization for performance
function renderMessages(messages) {
  elements.messagesContainer.innerHTML = '';
  
  // Limit initial render for performance
  const BATCH_SIZE = 50;
  const totalMessages = messages.length;
  
  if (totalMessages <= BATCH_SIZE) {
    messages.forEach(msg => appendMessage(msg));
    scrollToBottom();
  } else {
    // Render last 50 messages first
    const recentMessages = messages.slice(-BATCH_SIZE);
    recentMessages.forEach(msg => appendMessage(msg));
    scrollToBottom();
    
    // Show load more button if there are older messages
    if (totalMessages > BATCH_SIZE) {
      const loadMoreBtn = document.createElement('div');
      loadMoreBtn.className = 'load-more-btn';
      loadMoreBtn.innerHTML = `加载更早的 ${totalMessages - BATCH_SIZE} 条消息`;
      loadMoreBtn.addEventListener('click', () => {
        loadMoreBtn.remove();
        const olderMessages = messages.slice(0, -BATCH_SIZE);
        const fragment = document.createDocumentFragment();
        olderMessages.forEach(msg => {
          const msgDiv = createMessageElement(msg);
          fragment.appendChild(msgDiv);
        });
        elements.messagesContainer.insertBefore(fragment, elements.messagesContainer.firstChild);
      });
      elements.messagesContainer.insertBefore(loadMoreBtn, elements.messagesContainer.firstChild);
    }
  }
}

// Create message element without appending
function createMessageElement(message) {
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
  
  return msgDiv;
}

// Append a single message
function appendMessage(message) {
  const msgDiv = createMessageElement(message);
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
  
  // Check for browser intent
  if (checkBrowserIntent(content)) {
    // Execute browser task
    await executeBrowserTask(content);
    return;
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

  // Browser status listener
  ipcRenderer.on('browser-status', (event, status) => {
    updateBrowserStatus(status);
  });

  // Browser control buttons
  elements.browserLaunchBtn.addEventListener('click', async () => {
    elements.browserLaunchBtn.disabled = true;
    elements.browserLaunchBtn.textContent = '🚀 启动中...';
    
    const result = await ipcRenderer.invoke('browser-launch');
    
    if (result.error) {
      alert('启动失败: ' + result.message);
      elements.browserLaunchBtn.textContent = '🚀 启动浏览器';
      elements.browserLaunchBtn.disabled = false;
    } else {
      elements.browserLaunchBtn.style.display = 'none';
      elements.browserCloseBtn.style.display = 'block';
    }
  });

  elements.browserCloseBtn.addEventListener('click', async () => {
    await ipcRenderer.invoke('browser-close');
    elements.browserCloseBtn.style.display = 'none';
    elements.browserLaunchBtn.style.display = 'block';
    elements.browserLaunchBtn.textContent = '🚀 启动浏览器';
    elements.browserLaunchBtn.disabled = false;
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

// Browser control functions
function updateBrowserStatus(status) {
  state.browserTask = status;
  
  if (status.status === 'closed') {
    elements.taskStatus.textContent = '浏览器已关闭';
    elements.taskProgress.innerHTML = '';
    elements.browserPreview.style.display = 'none';
    return;
  }
  
  if (status.detail) {
    elements.taskStatus.textContent = status.detail;
  }
  
  // Add step to progress
  if (status.status !== 'ready') {
    const step = document.createElement('div');
    step.className = 'step';
    step.textContent = status.detail;
    elements.taskProgress.appendChild(step);
    
    // Keep only last 3 steps
    while (elements.taskProgress.children.length > 3) {
      elements.taskProgress.removeChild(elements.taskProgress.firstChild);
    }
  }
}

// Check if message contains browser control intent
function checkBrowserIntent(content) {
  const keywords = [
    '搜索', '查找', '查一下', '查', '打开', '访问', '进入',
    '淘宝', '京东', '百度', 'google', '知乎'
  ];
  
  const lower = content.toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

// Execute browser task
async function executeBrowserTask(instruction) {
  // Show task panel
  elements.taskStatus.textContent = '正在执行浏览器任务...';
  elements.taskProgress.innerHTML = '';
  
  // Add browser message to chat
  const browserMsg = {
    role: 'assistant',
    content: `🔍 正在执行: ${instruction}...`,
    timestamp: new Date().toISOString(),
    type: 'browser'
  };
  appendMessage(browserMsg);
  
  try {
    const result = await ipcRenderer.invoke('browser-execute', instruction);
    
    if (result.error) {
      // Update message with error
      browserMsg.content = `❌ 浏览器任务失败: ${result.message}`;
      const msgDiv = elements.messagesContainer.querySelector('.message:last-child');
      if (msgDiv) {
        const textDiv = msgDiv.querySelector('.message-text');
        if (textDiv) textDiv.innerHTML = formatContent(browserMsg.content);
      }
      return null;
    }
    
    // Show screenshot if available
    if (result.screenshot) {
      elements.browserScreenshot.src = `data:image/png;base64,${result.screenshot}`;
      elements.browserPreview.style.display = 'block';
    }
    
    // Build result summary
    let summary = `✅ 任务完成!\n\n`;
    
    if (result.query) {
      summary += `搜索: ${result.query}\n`;
      summary += `来源: ${result.engine}\n\n`;
    }
    
    if (result.results && result.results.length > 0) {
      summary += `找到 ${result.results.length} 个结果:\n\n`;
      result.results.forEach((item, i) => {
        summary += `${i + 1}. ${item.title}`;
        if (item.price) summary += ` - ${item.price}`;
        summary += '\n';
      });
    }
    
    if (result.url) {
      summary += `\n🔗 ${result.url}`;
    }
    
    // Update message with result
    browserMsg.content = summary;
    const msgDiv = elements.messagesContainer.querySelector('.message:last-child');
    if (msgDiv) {
      const textDiv = msgDiv.querySelector('.message-text');
      if (textDiv) textDiv.innerHTML = formatContent(browserMsg.content);
    }
    
    // Save to session
    if (state.currentSession) {
      await ipcRenderer.invoke('add-message', state.currentSession.id, browserMsg);
    }
    
    return result;
  } catch (error) {
    console.error('Browser task error:', error);
    browserMsg.content = `❌ 浏览器任务失败: ${error.message}`;
    const msgDiv = elements.messagesContainer.querySelector('.message:last-child');
    if (msgDiv) {
      const textDiv = msgDiv.querySelector('.message-text');
      if (textDiv) textDiv.innerHTML = formatContent(browserMsg.content);
    }
    return null;
  }
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
