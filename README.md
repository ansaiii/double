# Double - K12 教培助理

## 项目定位
面向 K12 教培从业者的 AI 助理，帮助老师高效完成作文批改、资料整理、课件制作和家长沟通。

---

## 快速开始

### 1. 安装依赖
\\\ash
npm install
\\\

### 2. 配置 API 密钥
启动应用后，在设置面板中配置：
- DeepSeek API Key（推荐）
- Moonshot API Key（备用）

### 3. 运行应用
\\\ash
npm start
\\\

---

## 核心功能

### ✅ 已实现 (v0.3)
- **学生档案管理** - 创建、编辑、删除学生信息
- **作文批改** - AI 自动批改电子档作文（Word/PDF/TXT）
- **评分系统** - 按年级（小学/初中/高中）自动评分
- **评语生成** - 个性化评语，支持鼓励/严格/平衡风格

### 🚧 开发中
- 批量批改
- 学情报告
- 家长消息模板

### 📅 计划中
- OCR 手写识别（百度 API）
- 资料剪藏
- PPT 课件生成

---

## API 接口

### 学生管理
\\\javascript
// 获取所有学生
ipcRenderer.invoke('student-get-all')

// 创建学生
ipcRenderer.invoke('student-create', {
  name: '张三',
  grade: '五年级',
  school: 'XX 小学'
})

// 删除学生
ipcRenderer.invoke('student-delete', studentId)
\\\

### 作文批改
\\\javascript
// AI 批改
ipcRenderer.invoke('composition-grade', text, {
  grade: 'primary',      // primary/middle/high
  maxScore: 100,
  commentStyle: 'encouraging'  // encouraging/strict/balanced
})

// 创建批改批次
ipcRenderer.invoke('composition-create-batch', studentId, '《我的妈妈》作文')
\\\

---

## 数据结构

### 学生 (Student)
\\\json
{
  "id": "stu-1709280000000-abc1",
  "name": "张三",
  "grade": "五年级",
  "school": "XX 小学",
  "stats": {
    "compositionCount": 5,
    "avgScore": 85.5,
    "weakPoints": ["错别字", "结尾仓促"]
  }
}
\\\

### 批改结果 (GradingResult)
\\\json
{
  "score": 85,
  "maxScore": 100,
  "errors": [
    {"type": "typo", "text": "在", "suggestion": "再"}
  ],
  "strengths": ["开头点题", "细节生动"],
  "weaknesses": ["结尾仓促"],
  "comment": "文章情感真挚..."
}
\\\

---

## 技术栈
- **框架**: Electron 28+
- **前端**: HTML/CSS/JS
- **后端**: Node.js (Electron 主进程)
- **AI**: DeepSeek/Moonshot API
- **存储**: JSON 本地存储

---

## 开发计划

### Phase 1: 作文批改 MVP（2 周） ✅
- [x] 学生档案服务
- [x] 作文批改服务
- [x] IPC 接口
- [ ] 前端界面
- [ ] 测试验证

### Phase 2: 批量处理 + 资料管理（2 周）
### Phase 3: 课件 + 沟通（2 周）
### Phase 4: 优化发布（1 周）

---

## 许可证
MIT License

---

**Version**: v0.3 - 2026-03-01
