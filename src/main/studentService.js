/**
 * Student Service - 学生档案管理
 * 负责学生信息的 CRUD 操作
 */

const fs = require('fs');
const path = require('path');
const { getDataPath } = require('./dataStore');

const STUDENTS_DIR = path.join(getDataPath(), 'students');
const INDEX_FILE = path.join(STUDENTS_DIR, 'index.json');

// 确保目录存在
function ensureDir() {
  if (!fs.existsSync(STUDENTS_DIR)) {
    fs.mkdirSync(STUDENTS_DIR, { recursive: true });
  }
}

// 初始化索引
function initIndex() {
  ensureDir();
  if (!fs.existsSync(INDEX_FILE)) {
    fs.writeFileSync(INDEX_FILE, JSON.stringify({ students: [] }, null, 2));
  }
}

// 获取所有学生
function getAllStudents() {
  initIndex();
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  return index.students;
}

// 根据 ID 获取学生
function getStudentById(studentId) {
  initIndex();
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  return index.students.find(s => s.id === studentId);
}

// 创建学生
function createStudent(data) {
  initIndex();
  const studentId = 'stu-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
  
  const student = {
    id: studentId,
    name: data.name,
    grade: data.grade || '',
    school: data.school || '',
    parentContact: data.parentContact || '',
    createdAt: new Date().toISOString(),
    settings: {
      compositionScoreStandard: data.scoreStandard || 'primary-school',
      commentStyle: data.commentStyle || 'encouraging'
    },
    stats: {
      compositionCount: 0,
      avgScore: 0,
      weakPoints: []
    }
  };
  
  // 保存到索引
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  index.students.push(student);
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
  
  // 创建学生个人目录
  const studentDir = path.join(STUDENTS_DIR, studentId);
  fs.mkdirSync(studentDir, { recursive: true });
  
  // 保存详细信息
  fs.writeFileSync(
    path.join(studentDir, 'profile.json'),
    JSON.stringify(student, null, 2)
  );
  
  // 创建作文目录
  fs.mkdirSync(path.join(studentDir, 'compositions'), { recursive: true });
  
  return student;
}

// 更新学生信息
function updateStudent(studentId, updates) {
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  const studentIndex = index.students.findIndex(s => s.id === studentId);
  
  if (studentIndex === -1) {
    throw new Error('Student not found');
  }
  
  const student = { ...index.students[studentIndex], ...updates };
  index.students[studentIndex] = student;
  
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
  fs.writeFileSync(
    path.join(STUDENTS_DIR, studentId, 'profile.json'),
    JSON.stringify(student, null, 2)
  );
  
  return student;
}

// 删除学生
function deleteStudent(studentId) {
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  const studentIndex = index.students.findIndex(s => s.id === studentId);
  
  if (studentIndex === -1) {
    throw new Error('Student not found');
  }
  
  // 删除索引
  index.students.splice(studentIndex, 1);
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
  
  // 删除目录
  const studentDir = path.join(STUDENTS_DIR, studentId);
  if (fs.existsSync(studentDir)) {
    fs.rmSync(studentDir, { recursive: true, force: true });
  }
  
  return true;
}

// 更新学生统计
function updateStudentStats(studentId, compositionScore) {
  const student = getStudentById(studentId);
  if (!student) return null;
  
  student.stats.compositionCount += 1;
  
  // 计算新平均分
  const totalScore = student.stats.avgScore * (student.stats.compositionCount - 1) + compositionScore;
  student.stats.avgScore = Math.round(totalScore / student.stats.compositionCount * 10) / 10;
  
  updateStudent(studentId, { stats: student.stats });
  return student.stats;
}

module.exports = {
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  updateStudentStats,
  ensureDir
};
