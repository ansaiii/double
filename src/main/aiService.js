const https = require('https');

class AIService {
  constructor(config) {
    this.config = config;
  }

  async chat(messages, model, onStream) {
    const modelConfig = this.config.models[model];
    if (!modelConfig || !modelConfig.enabled) {
      throw new Error(`Model ${model} is not enabled`);
    }

    if (model === 'deepseek') {
      return this.chatDeepSeek(messages, modelConfig, onStream);
    } else if (model === 'moonshot') {
      return this.chatMoonshot(messages, modelConfig, onStream);
    } else {
      throw new Error(`Unknown model: ${model}`);
    }
  }

  async chatDeepSeek(messages, modelConfig, onStream) {
    const data = JSON.stringify({
      model: modelConfig.defaultModel || 'deepseek-chat',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      stream: true
    });

    const options = {
      hostname: 'api.deepseek.com',
      port: 443,
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelConfig.apiKey}`,
        'Content-Length': data.length
      }
    };

    return this.makeRequest(options, data, onStream);
  }

  async chatMoonshot(messages, modelConfig, onStream) {
    const data = JSON.stringify({
      model: modelConfig.defaultModel || 'moonshot-v1-128k',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      stream: true
    });

    const options = {
      hostname: 'api.moonshot.cn',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelConfig.apiKey}`,
        'Content-Length': data.length
      }
    };

    return this.makeRequest(options, data, onStream);
  }

  makeRequest(options, data, onStream) {
    return new Promise((resolve, reject) => {
      let fullContent = '';

      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        res.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              if (jsonStr === '[DONE]') continue;
              
              try {
                const json = JSON.parse(jsonStr);
                const content = json.choices?.[0]?.delta?.content || '';
                if (content) {
                  fullContent += content;
                  if (onStream) {
                    onStream(content, fullContent);
                  }
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        });

        res.on('end', () => {
          resolve(fullContent);
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  async validateApiKey(model) {
    const modelConfig = this.config.models[model];
    if (!modelConfig || !modelConfig.apiKey) {
      return { valid: false, error: 'API key not configured' };
    }

    try {
      const messages = [{ role: 'user', content: 'Hi' }];
      await this.chat(messages, model, () => {});
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

module.exports = AIService;

// ========== Simple AI Call Function ==========
// For non-streaming calls (grading, analysis, etc.)

async function callAI(prompt, model = 'deepseek') {
  const AIService = require('./aiService');
  const { getConfig } = require('./dataStore');
  
  const config = getConfig();
  const aiService = new AIService(config);
  
  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: prompt }
  ];
  
  let fullContent = '';
  await aiService.chat(messages, model, (chunk) => {
    fullContent += chunk;
  });
  
  return fullContent;
}

module.exports = { callAI };
