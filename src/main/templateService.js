/**
 * Template Service - 评语模板管理
 */

const fs = require('fs');
const path = require('path');
const { getDataPath } = require('./dataStore');

const TEMPLATES_DIR = path.join(getDataPath(), 'templates');
const COMMENTS_FILE = path.join(TEMPLATES_DIR, 'comments.json');

// 默认评语模板
const DEFAULT_TEMPLATES = {
  primary: [
    { id: 'p1', text: '文章写得真棒！字迹工整，语句通顺，继续加油！', tags: ['鼓励', '通用'] },
    { id: 'p2', text: '你的进步很大，如果能再多读几遍修改一下会更好。', tags: ['鼓励', '修改'] },
    { id: 'p3', text: '开头很吸引人，结尾再具体一点就更完美了。', tags: ['结构', '建议'] }
  ],
  middle: [
    { id: 'm1', text: '立意深刻，内容充实，是一篇优秀的作文。', tags: ['表扬', '优秀'] },
    { id: 'm2', text: '语言流畅，但部分段落过渡可以更自然。', tags: ['结构', '建议'] },
    { id: 'm3', text: '选材新颖，如果能加入更多细节描写会更好。', tags: ['内容', '建议'] }
  ],
  high: [
    { id: 'h1', text: '思想深刻，论证充分，展现了较强的思辨能力。', tags: ['表扬', '思辨'] },
    { id: 'h2', text: '文采斐然，但部分论点可以更深入展开。', tags: ['文采', '建议'] },
    { id: 'h3', text: '结构严谨，逻辑清晰，是一篇高质量的考场作文。', tags: ['结构', '优秀'] }
  ]
};

function ensureDir() {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  }
  if (!fs.existsSync(COMMENTS_FILE)) {
    fs.writeFileSync(COMMENTS_FILE, JSON.stringify(DEFAULT_TEMPLATES, null, 2));
  }
}

function getAllTemplates() {
  ensureDir();
  return JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf-8'));
}

function addTemplate(grade, text, tags = []) {
  ensureDir();
  const templates = getAllTemplates();
  const newTemplate = {
    id: 't' + Date.now(),
    text,
    tags,
    createdAt: new Date().toISOString(),
    usageCount: 0
  };
  
  if (!templates[grade]) templates[grade] = [];
  templates[grade].push(newTemplate);
  
  fs.writeFileSync(COMMENTS_FILE, JSON.stringify(templates, null, 2));
  return newTemplate;
}

function deleteTemplate(grade, templateId) {
  ensureDir();
  const templates = getAllTemplates();
  if (templates[grade]) {
    templates[grade] = templates[grade].filter(t => t.id !== templateId);
    fs.writeFileSync(COMMENTS_FILE, JSON.stringify(templates, null, 2));
  }
  return true;
}

function incrementUsage(grade, templateId) {
  ensureDir();
  const templates = getAllTemplates();
  const template = templates[grade]?.find(t => t.id === templateId);
  if (template) {
    template.usageCount = (template.usageCount || 0) + 1;
    fs.writeFileSync(COMMENTS_FILE, JSON.stringify(templates, null, 2));
  }
}

module.exports = {
  getAllTemplates,
  addTemplate,
  deleteTemplate,
  incrementUsage,
  ensureDir
};
