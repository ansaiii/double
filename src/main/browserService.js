const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

class BrowserService {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isRunning = false;
    this.currentTask = null;
    this.screenshotPath = null;
    this.onStatusUpdate = null;
  }

  setStatusCallback(callback) {
    this.onStatusUpdate = callback;
  }

  async updateStatus(status, detail = '') {
    this.currentTask = { status, detail, timestamp: Date.now() };
    if (this.onStatusUpdate) {
      this.onStatusUpdate({ status, detail });
    }
  }

  async launch() {
    if (this.browser) return;

    await this.updateStatus('launching', '正在启动浏览器...');

    // Try to find Chrome executable
    const chromePath = await this.findChrome();
    if (!chromePath) {
      throw new Error('未找到Chrome浏览器，请安装Chrome或Chromium');
    }

    this.browser = await puppeteer.launch({
      headless: false, // Show browser window for user visibility
      executablePath: chromePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,720'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 720 });
    
    // Set user agent to avoid detection
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await this.updateStatus('ready', '浏览器已就绪');
  }

  async findChrome() {
    // Common Chrome paths on Windows
    const winPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe'
    ];

    // Common Chrome paths on macOS
    const macPaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ];

    // Common Chrome paths on Linux
    const linuxPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser'
    ];

    const paths = process.platform === 'win32' ? winPaths : 
                  process.platform === 'darwin' ? macPaths : linuxPaths;

    for (const chromePath of paths) {
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    }

    return null;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isRunning = false;
    }
    await this.updateStatus('closed', '浏览器已关闭');
  }

  async executeTask(instruction, allowedDomains = []) {
    if (!this.browser) {
      await this.launch();
    }

    this.isRunning = true;
    let result = null;

    try {
      // Parse instruction to determine action
      const action = this.parseInstruction(instruction);
      
      switch (action.type) {
        case 'search':
          result = await this.performSearch(action.query, action.engine);
          break;
        case 'visit':
          result = await this.visitUrl(action.url, allowedDomains);
          break;
        case 'extract':
          result = await this.extractContent(action.selector);
          break;
        case 'click':
          result = await this.clickElement(action.text);
          break;
        case 'type':
          result = await this.typeText(action.selector, action.text);
          break;
        default:
          result = { error: true, message: '无法理解的指令: ' + instruction };
      }
    } catch (error) {
      result = { error: true, message: error.message };
    } finally {
      this.isRunning = false;
    }

    return result;
  }

  parseInstruction(instruction) {
    const lower = instruction.toLowerCase();

    // Search patterns
    if (lower.includes('搜索') || lower.includes('查找') || lower.includes('查一下')) {
      const match = instruction.match(/(?:搜索|查找|查一下|搜索一下|查)\s*(.+?)(?:的|在|价格|信息|$)/i);
      if (match) {
        const query = match[1].trim();
        let engine = 'google';
        if (lower.includes('淘宝')) engine = 'taobao';
        else if (lower.includes('京东')) engine = 'jd';
        else if (lower.includes('百度')) engine = 'baidu';
        return { type: 'search', query, engine };
      }
    }

    // Visit URL patterns
    if (lower.includes('打开') || lower.includes('访问') || lower.includes('进入')) {
      const urlMatch = instruction.match(/(?:打开|访问|进入)\s*(https?:\/\/\S+|\S+\.\S+)/i);
      if (urlMatch) {
        let url = urlMatch[1];
        if (!url.startsWith('http')) {
          url = 'https://' + url;
        }
        return { type: 'visit', url };
      }
    }

    // Extract content patterns
    if (lower.includes('提取') || lower.includes('获取') || lower.includes('总结')) {
      return { type: 'extract', selector: 'body' };
    }

    // Click patterns
    if (lower.includes('点击') || lower.includes('按')) {
      const textMatch = instruction.match(/(?:点击|按)\s*(.+?)(?:按钮|链接|$)/i);
      if (textMatch) {
        return { type: 'click', text: textMatch[1].trim() };
      }
    }

    // Default: try to search
    return { type: 'search', query: instruction, engine: 'google' };
  }

  async performSearch(query, engine) {
    await this.updateStatus('searching', `正在${engine}搜索: ${query}`);

    let searchUrl;
    switch (engine) {
      case 'taobao':
        searchUrl = `https://s.taobao.com/search?q=${encodeURIComponent(query)}`;
        break;
      case 'jd':
        searchUrl = `https://search.jd.com/Search?keyword=${encodeURIComponent(query)}`;
        break;
      case 'baidu':
        searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
        break;
      default:
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    }

    await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });
    await this.sleep(2000);

    await this.updateStatus('extracting', '正在提取搜索结果...');

    // Take screenshot
    const screenshot = await this.takeScreenshot();

    // Extract results based on site
    let results = [];
    if (engine === 'taobao') {
      results = await this.extractTaobaoResults();
    } else if (engine === 'jd') {
      results = await this.extractJDResults();
    } else {
      results = await this.extractGenericResults();
    }

    return {
      success: true,
      query,
      engine,
      results,
      screenshot,
      url: this.page.url()
    };
  }

  async extractTaobaoResults() {
    return await this.page.evaluate(() => {
      const items = [];
      const elements = document.querySelectorAll('[data-category="auctions"] .item');
      
      elements.slice(0, 5).forEach(el => {
        const titleEl = el.querySelector('.title a');
        const priceEl = el.querySelector('.price .strong');
        const salesEl = el.querySelector('.deal-cnt');
        
        if (titleEl && priceEl) {
          items.push({
            title: titleEl.textContent.trim(),
            price: priceEl.textContent.trim(),
            sales: salesEl ? salesEl.textContent.trim() : '',
            link: titleEl.href
          });
        }
      });
      
      return items;
    });
  }

  async extractJDResults() {
    return await this.page.evaluate(() => {
      const items = [];
      const elements = document.querySelectorAll('.gl-item');
      
      elements.slice(0, 5).forEach(el => {
        const titleEl = el.querySelector('.p-name a');
        const priceEl = el.querySelector('.p-price strong i');
        const commentEl = el.querySelector('.p-commit a');
        
        if (titleEl && priceEl) {
          items.push({
            title: titleEl.textContent.trim(),
            price: '¥' + priceEl.textContent.trim(),
            comments: commentEl ? commentEl.textContent.trim() : '',
            link: titleEl.href
          });
        }
      });
      
      return items;
    });
  }

  async extractGenericResults() {
    return await this.page.evaluate(() => {
      // Try to find common result patterns
      const items = [];
      
      // Generic selectors for search results
      const selectors = [
        'h3 a', // Common for Google, Baidu
        '.result a', // Generic result
        '.search-item a',
        '[data-result] a'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.slice(0, 5).forEach(el => {
            items.push({
              title: el.textContent.trim(),
              link: el.href
            });
          });
          break;
        }
      }
      
      return items;
    });
  }

  async visitUrl(url, allowedDomains) {
    await this.updateStatus('visiting', `正在访问: ${url}`);

    // Check if domain is allowed
    if (allowedDomains.length > 0) {
      const domain = new URL(url).hostname;
      const isAllowed = allowedDomains.some(d => domain.includes(d));
      if (!isAllowed) {
        throw new Error(`不允许访问该域名: ${domain}`);
      }
    }

    await this.page.goto(url, { waitUntil: 'networkidle2' });
    await this.sleep(2000);

    const screenshot = await this.takeScreenshot();
    const title = await this.page.title();

    return {
      success: true,
      title,
      url: this.page.url(),
      screenshot
    };
  }

  async extractContent(selector) {
    await this.updateStatus('extracting', '正在提取页面内容...');

    const content = await this.page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (!element) return null;
      
      // Remove script and style elements
      const scripts = element.querySelectorAll('script, style, nav, footer, header');
      scripts.forEach(s => s.remove());
      
      return {
        text: element.innerText.trim(),
        html: element.innerHTML
      };
    }, selector);

    return {
      success: true,
      content
    };
  }

  async clickElement(text) {
    await this.updateStatus('clicking', `正在点击: ${text}`);

    // Try to find and click element by text
    const clicked = await this.page.evaluate((searchText) => {
      const elements = document.querySelectorAll('a, button, [role="button"]');
      for (const el of elements) {
        if (el.textContent.toLowerCase().includes(searchText.toLowerCase())) {
          el.click();
          return true;
        }
      }
      return false;
    }, text);

    if (clicked) {
      await this.sleep(2000);
      const screenshot = await this.takeScreenshot();
      return {
        success: true,
        message: `已点击: ${text}`,
        screenshot
      };
    }

    return {
      error: true,
      message: `未找到可点击的元素: ${text}`
    };
  }

  async typeText(selector, text) {
    await this.updateStatus('typing', `正在输入: ${text}`);

    await this.page.focus(selector);
    await this.page.keyboard.type(text);

    return {
      success: true,
      message: `已输入: ${text}`
    };
  }

  async takeScreenshot() {
    if (!this.page) return null;
    
    try {
      const screenshot = await this.page.screenshot({
        encoding: 'base64',
        fullPage: false
      });
      return screenshot;
    } catch (error) {
      console.error('Screenshot error:', error);
      return null;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      currentTask: this.currentTask,
      hasBrowser: !!this.browser
    };
  }
}

module.exports = BrowserService;
