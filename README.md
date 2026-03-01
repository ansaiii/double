# Double - K12 教培助理

> AI 驱动的作文批改工具，帮助老师高效完成作业批改

[![Version](https://img.shields.io/github/package-json/v/ansaiii/double)](https://github.com/ansaiii/double)
[![License](https://img.shields.io/github/license/ansaiii/double)](https://github.com/ansaiii/double/blob/master/LICENSE)

---

## 🎯 产品定位

**Double** 是面向 K12 教培从业者的 AI 助理，专注于：
- 📝 **智能作文批改** - AI 自动评分 + 个性化评语
- 📊 **学情数据分析** - 成长轨迹可视化
- 💬 **家长沟通提效** - 一键生成学情报告

---

## ⚡ 快速开始

### 1. 安装依赖
`ash
npm install
`

### 2. 配置 API 密钥
启动应用后，在设置中配置：
- **DeepSeek API Key**（推荐）- https://platform.deepseek.com
- **Moonshot API Key**（备用）- https://platform.moonshot.cn

### 3. 运行应用
`ash
npm start
`

### 4. 使用作文批改
1. 点击欢迎屏幕的「作文批改」按钮
2. 添加学生档案
3. 输入或粘贴作文内容
4. 点击「开始批改」，AI 自动生成评分和评语

---

## 📸 功能预览

### 作文批改界面
`
┌─────────────────────────────────────────────┐
│  📚 学生档案    │  📝 输入作文              │
│  ────────────    │  ──────────────────────  │
│  + 添加学生      │  [作文文本框]            │
│                  │                          │
│  张三 (五年级)   │  [开始批改]              │
│  李四 (三年级)   │                          │
│  王五 (六年级)   │  📊 批改结果            │
│                  │  ──────────────────────  │
│                  │  分数：85/100            │
│                  │  ✨ 亮点：开头点题...    │
│                  │  ⚠️ 改进：结尾仓促...   │
│                  │  💬 评语：...            │
└─────────────────────────────────────────────┘
`

---

## 🎓 评分标准

### 小学作文
- 内容完整 (30 分)
- 语言通顺 (30 分)
- 结构清晰 (20 分)
- 书写规范 (20 分)

### 初中作文
- 立意深刻 (25 分)
- 内容充实 (25 分)
- 语言优美 (25 分)
- 结构严谨 (25 分)

### 高中作文
- 思想深度 (30 分)
- 论证充分 (30 分)
- 文采斐然 (20 分)
- 创新表达 (20 分)

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Electron 28+ |
| 前端 | HTML/CSS/JS |
| 后端 | Node.js |
| AI | DeepSeek/Moonshot API |
| 存储 | JSON 本地存储 |

---

## 📅 开发计划

| 版本 | 功能 | 状态 |
|------|------|------|
| v0.3 | 学生档案 + 作文批改 | ✅ 完成 |
| v0.4 | 批量批改 + 评语模板 | 🚧 开发中 |
| v0.5 | 学情报告 + 数据看板 | ⏳ 计划 |
| v0.6 | 家长沟通 + 消息模板 | ⏳ 计划 |
| v1.0 | 正式发布 | ⏳ 计划 |

---

## 📖 API 文档

### 学生管理
`javascript
// 获取所有学生
ipcRenderer.invoke('student-get-all')

// 创建学生
ipcRenderer.invoke('student-create', {
  name: '张三',
  grade: '五年级'
})

// 删除学生
ipcRenderer.invoke('student-delete', studentId)
`

### 作文批改
`javascript
// AI 批改
ipcRenderer.invoke('composition-grade', text, {
  grade: 'primary',
  maxScore: 100,
  commentStyle: 'encouraging'
})
`

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License

---

**Version**: v0.3 - 2026-03-01  
**Author**: Jack Monday (ansaiii)
