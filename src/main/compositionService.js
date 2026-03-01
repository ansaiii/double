/**
 * Composition Grading Service - 作文批改服务
 * 负责 AI 批改、评分、评语生成
 */

const fs = require('fs');
const path = require('path');
const { getDataPath } = require('./dataStore');
const { callAI } = require('./aiService');
const { getStudentById } = require('./studentService');

const COMPOSITIONS_DIR = path.join(getDataPath(), 'compositions');

// 确保目录存在
function ensureDir() {
  if (!fs.existsSync(COMPOSITIONS_DIR)) {
    fs.mkdirSync(COMPOSITIONS_DIR, { recursive: true });
  }
}

// 创建批改批次
function createBatch(studentId, title, files = []) {
  ensureDir();
  const batchId = 'batch-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
  const batchDir = path.join(COMPOSITIONS_DIR, batchId);
  
  fs.mkdirSync(batchDir, { recursive: true });
  fs.mkdirSync(path.join(batchDir, 'raw'), { recursive: true });
  fs.mkdirSync(path.join(batchDir, 'graded'), { recursive: true });
  
  const batch = {
    id: batchId,
    studentId,
    title,
    createdAt: new Date().toISOString(),
    status: 'pending',
    files: [],
    gradedCount: 0
  };
  
  fs.writeFileSync(path.join(batchDir, 'batch.json'), JSON.stringify(batch, null, 2));
  
  return batch;
}

// AI 批改作文
async function gradeComposition(text, options = {}) {
  const {
    grade = 'primary',
    maxScore = 100,
    commentStyle = 'encouraging'
  } = options;
  
  const prompt = buildGradingPrompt(text, grade, maxScore, commentStyle);
  
  try {
    const response = await callAI(prompt);
    const result = parseGradingResult(response);
    return result;
  } catch (error) {
    throw new Error('AI grading failed: ' + error.message);
  }
}

// 构建批改提示词
function buildGradingPrompt(text, grade, maxScore, commentStyle) {
  const gradeStandards = {
    'primary': '小学作文评分标准',
    'middle': '中考作文评分标准',
    'high': '高考作文评分标准'
  };
  
  const styleGuide = {
    'encouraging': '以鼓励为主，先肯定优点，再委婉指出不足',
    'strict': '严格要求，直接指出问题',
    'balanced': '平衡优缺点，客观评价'
  };
  
  return \你是一个专业的语文老师，请根据\批改这篇作文。

【评分要求】
- 满分：\分
- 评价风格：\

【批改内容】
1. 给出总分（0-\）
2. 找出错别字和病句（如有）
3. 指出文章亮点
4. 指出需要改进的地方
5. 写一段评语（100-200 字）

【输出格式】
请严格按照以下 JSON 格式输出：
{
  "score": 数字，
  "maxScore": \,
  "errors": [{"type": "typo"或"sentence", "text": "原文", "suggestion": "建议", "position": 位置}],
  "strengths": ["亮点 1", "亮点 2"],
  "weaknesses": ["不足 1", "不足 2"],
  "comment": "评语内容"
}

【作文内容】
\
\;
}

// 解析批改结果
function parseGradingResult(response) {
  try {
    // 尝试提取 JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // 如果解析失败，返回默认结构
    return {
      score: 75,
      maxScore: 100,
      errors: [],
      strengths: ['内容完整'],
      weaknesses: ['需要改进'],
      comment: response
    };
  } catch (e) {
    return {
      score: 75,
      maxScore: 100,
      errors: [],
      strengths: ['内容完整'],
      weaknesses: ['格式解析失败'],
      comment: response
    };
  }
}

// 保存批改结果
function saveGradingResult(batchId, fileName, gradingResult) {
  const batchDir = path.join(COMPOSITIONS_DIR, batchId);
  const resultFile = path.join(batchDir, 'graded', fileName.replace(/\\.[^.]+$/, '_graded.json'));
  
  fs.writeFileSync(resultFile, JSON.stringify(gradingResult, null, 2));
  return resultFile;
}

// 获取批改历史
function getGradingHistory(studentId, limit = 10) {
  if (!fs.existsSync(COMPOSITIONS_DIR)) return [];
  
  const batches = fs.readdirSync(COMPOSITIONS_DIR)
    .filter(dir => dir.startsWith('batch-'))
    .map(dir => {
      const batchFile = path.join(COMPOSITIONS_DIR, dir, 'batch.json');
      if (fs.existsSync(batchFile)) {
        return JSON.parse(fs.readFileSync(batchFile, 'utf-8'));
      }
      return null;
    })
    .filter(b => b && b.studentId === studentId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
  
  return batches;
}

module.exports = {
  createBatch,
  gradeComposition,
  saveGradingResult,
  getGradingHistory,
  ensureDir
};
