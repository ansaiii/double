/**
 * Batch Grading Service - 批量批改服务
 */

const fs = require('fs');
const path = require('path');
const { getDataPath } = require('./dataStore');
const { gradeComposition, saveGradingResult } = require('./compositionService');
const { updateStudentStats } = require('./studentService');

const BATCHES_DIR = path.join(getDataPath(), 'batches');

function ensureDir() {
  if (!fs.existsSync(BATCHES_DIR)) {
    fs.mkdirSync(BATCHES_DIR, { recursive: true });
  }
}

// 创建批量批改任务
function createBatchTask(studentId, compositions) {
  ensureDir();
  const batchId = 'batch-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
  const batchDir = path.join(BATCHES_DIR, batchId);
  
  fs.mkdirSync(batchDir, { recursive: true });
  
  const batchTask = {
    id: batchId,
    studentId,
    compositions: compositions.map((c, i) => ({
      id: 'comp-' + i,
      title: c.title || '作文 ' + (i + 1),
      text: c.text,
      status: 'pending',
      result: null
    })),
    createdAt: new Date().toISOString(),
    status: 'pending',
    total: compositions.length,
    completed: 0,
    failed: 0
  };
  
  fs.writeFileSync(path.join(batchDir, 'batch.json'), JSON.stringify(batchTask, null, 2));
  return batchTask;
}

// 执行批量批改
async function executeBatch(batchId, options = {}, onProgress) {
  const batchDir = path.join(BATCHES_DIR, batchId);
  const batchFile = path.join(batchDir, 'batch.json');
  
  if (!fs.existsSync(batchFile)) {
    throw new Error('Batch not found');
  }
  
  const batch = JSON.parse(fs.readFileSync(batchFile, 'utf-8'));
  batch.status = 'processing';
  
  for (let i = 0; i < batch.compositions.length; i++) {
    const comp = batch.compositions[i];
    
    try {
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: batch.total,
          title: comp.title,
          status: 'processing'
        });
      }
      
      // AI 批改
      const result = await gradeComposition(comp.text, options);
      
      comp.status = 'completed';
      comp.result = result;
      batch.completed++;
      
      // 保存结果
      saveGradingResult(batchId, comp.title, result);
      
    } catch (error) {
      comp.status = 'failed';
      comp.error = error.message;
      batch.failed++;
      
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: batch.total,
          title: comp.title,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    // 更新进度
    fs.writeFileSync(batchFile, JSON.stringify(batch, null, 2));
  }
  
  batch.status = batch.failed > 0 ? 'completed_with_errors' : 'completed';
  batch.completedAt = new Date().toISOString();
  fs.writeFileSync(batchFile, JSON.stringify(batch, null, 2));
  
  // 更新学生统计
  if (batch.studentId && batch.completed > 0) {
    const avgScore = batch.compositions
      .filter(c => c.status === 'completed' && c.result?.score)
      .reduce((sum, c) => sum + c.result.score, 0) / batch.completed;
    
    updateStudentStats(batch.studentId, Math.round(avgScore));
  }
  
  return batch;
}

// 获取批量任务
function getBatchTask(batchId) {
  const batchFile = path.join(BATCHES_DIR, batchId, 'batch.json');
  if (fs.existsSync(batchFile)) {
    return JSON.parse(fs.readFileSync(batchFile, 'utf-8'));
  }
  return null;
}

// 获取所有批量任务
function getAllBatchTasks(studentId) {
  ensureDir();
  const batches = fs.readdirSync(BATCHES_DIR)
    .filter(dir => dir.startsWith('batch-'))
    .map(dir => {
      const batchFile = path.join(BATCHES_DIR, dir, 'batch.json');
      if (fs.existsSync(batchFile)) {
        return JSON.parse(fs.readFileSync(batchFile, 'utf-8'));
      }
      return null;
    })
    .filter(b => b && (!studentId || b.studentId === studentId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return batches;
}

module.exports = {
  createBatchTask,
  executeBatch,
  getBatchTask,
  getAllBatchTasks,
  ensureDir
};
