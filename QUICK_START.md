# Double Electron App - Quick Start

## 🚀 Project Setup Complete!

Your cross-platform Electron app is ready to go.

## 📁 Project Structure
```
double/
├── src/
│   ├── main.js          # Electron main process
│   └── index.html       # App UI (with beautiful design!)
├── package.json         # Project configuration
├── electron-builder.json # Build configuration
├── run-test.bat        # Test script
└── dist/               # Build output (created on build)
```

## 🏃‍♂️ How to Run

### Option 1: Using the test script
```bash
.\run-test.bat
```

### Option 2: Manual commands
1. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```

2. **Run the app**:
   ```bash
   npm start
   ```

## 🛠 Building for Platforms

### Windows
```bash
npm run build:win
```
Output: `dist/*.exe` installer

### macOS (requires macOS machine)
```bash
npm run build:mac
```
Output: `dist/*.dmg` or `dist/*.app`

### Linux
```bash
npm run build:linux
```
Output: `dist/*.AppImage`

### All platforms
```bash
npm run build
```

## 🎨 App Features
- Beautiful gradient UI
- Platform detection
- Version information display
- Interactive platform badges
- Responsive design

## 🔧 Customization
1. Edit `src/index.html` to change the UI
2. Modify `src/main.js` to change app behavior
3. Update `electron-builder.json` for build settings
4. Change `package.json` for project metadata

## 📦 Dependencies
- **Electron**: Desktop app framework
- **Electron Builder**: Cross-platform packaging

## 🚨 Troubleshooting
If `npm start` doesn't work:
1. Make sure dependencies are installed: `npm install`
2. Check Node.js version: `node --version` (should be 16+)
3. Run with admin privileges if needed

## 🎯 Next Steps
1. Test the app: `npm start`
2. Customize the UI in `src/index.html`
3. Add your application logic
4. Build for your target platforms
5. Distribute your app!