# Double - 本地 AI 助手

你的隐私优先、开箱即用的 AI 助手应用。

## ✨ 特性

- 🤖 **双模型支持** - DeepSeek + Moonshot（Kimi）
- 🔒 **本地优先** - 所有数据本地存储，保护隐私
- 🌐 **AI 浏览器控制** - 自然语言操控浏览器，自动搜索和提取信息
- 📁 **文件分析** - 支持 PDF、Word、图片等文件上传分析
- 💾 **导出功能** - 支持导出 Markdown 和 PDF
- 🎨 **主题切换** - 深色/浅色模式

## 📥 下载安装

### Windows
下载 `Double-Setup-1.0.0.exe` 或便携版 `Double-1.0.0.exe`

### macOS
下载 `Double-1.0.0.dmg`

### Linux
下载 `Double-1.0.0.AppImage` 或 `.deb` 包

## 🚀 快速开始

1. 安装并启动 Double
2. 在设置中配置你的 API Key（DeepSeek 或 Moonshot）
3. 开始对话！

### 获取 API Key

- **DeepSeek**: https://platform.deepseek.com
- **Moonshot**: https://platform.moonshot.cn

## 💡 使用技巧

### AI 浏览器控制
尝试发送这些指令：
- "帮我在淘宝上搜索 iPhone 16 的价格"
- "查查京东上 MacBook Pro 的价格"
- "百度一下今天的天气"

### 文件分析
- 直接拖拽文件到输入框
- 支持 PDF、Word、TXT、Markdown 等格式

## 🛠️ 开发

```bash
# 克隆仓库
git clone https://github.com/ansaiii/double.git
cd double

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## 📂 数据存储位置

- **Windows**: `%APPDATA%/double-double-data/`
- **macOS**: `~/Library/Application Support/double/`
- **Linux**: `~/.config/double/`

## 📝 更新日志

### v1.0.0 (2024-02-24)
- ✨ 首次发布
- 🤖 支持 DeepSeek 和 Moonshot 双模型
- 🌐 AI 浏览器控制功能
- 📁 文件上传分析
- 💾 Markdown/PDF 导出
- 🎨 深色/浅色主题

## 📄 许可证

MIT License

## 👨‍💻 作者

Jack Monday

---

有问题或建议？欢迎提交 Issue 或 PR！
