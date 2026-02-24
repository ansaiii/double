const fs = require('fs');
const path = require('path');
const PDFParser = require('pdf2json');
const mammoth = require('mammoth');
const sharp = require('sharp');

class FileService {
  constructor(dataPath) {
    this.uploadsPath = path.join(dataPath, 'uploads');
    this.ensureUploadsDir();
  }

  ensureUploadsDir() {
    if (!fs.existsSync(this.uploadsPath)) {
      fs.mkdirSync(this.uploadsPath, { recursive: true });
    }
  }

  getSessionUploadsPath(sessionId) {
    const sessionPath = path.join(this.uploadsPath, sessionId);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }
    return sessionPath;
  }

  async saveFile(sessionId, filePath, originalName) {
    const sessionUploadsPath = this.getSessionUploadsPath(sessionId);
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const random = Math.random().toString(36).substring(2, 6);
    const fileName = `${baseName}-${random}${ext}`;
    const destPath = path.join(sessionUploadsPath, fileName);

    // Copy file
    fs.copyFileSync(filePath, destPath);

    // Extract text based on file type
    const extractedText = await this.extractText(destPath, ext.toLowerCase());

    // Save extracted text as markdown
    if (extractedText) {
      const mdPath = `${destPath}.extracted.md`;
      fs.writeFileSync(mdPath, extractedText, 'utf8');
    }

    return {
      originalName,
      fileName,
      path: destPath,
      extractedText,
      size: fs.statSync(destPath).size
    };
  }

  async extractText(filePath, ext) {
    try {
      switch (ext) {
        case '.pdf':
          return await this.extractPdf(filePath);
        case '.docx':
        case '.doc':
          return await this.extractDocx(filePath);
        case '.txt':
        case '.md':
        case '.json':
        case '.js':
        case '.html':
        case '.css':
          return fs.readFileSync(filePath, 'utf8');
        case '.png':
        case '.jpg':
        case '.jpeg':
        case '.gif':
        case '.bmp':
        case '.webp':
          return `[图片文件: ${path.basename(filePath)}]`;
        default:
          return `[不支持的文件格式: ${ext}]`;
      }
    } catch (error) {
      console.error('Extract text error:', error);
      return `[文件解析失败: ${error.message}]`;
    }
  }

  async extractPdf(filePath) {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();
      
      pdfParser.on('pdfParser_dataError', (errData) => {
        reject(new Error(errData.parserError));
      });
      
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        // Extract text from all pages
        let text = '';
        if (pdfData.formImage && pdfData.formImage.Pages) {
          pdfData.formImage.Pages.forEach((page, pageIndex) => {
            if (pageIndex > 0) text += '\n\n';
            text += `--- Page ${pageIndex + 1} ---\n`;
            if (page.Texts) {
              page.Texts.forEach(textItem => {
                if (textItem.R && textItem.R[0] && textItem.R[0].T) {
                  text += decodeURIComponent(textItem.R[0].T) + ' ';
                }
              });
            }
          });
        }
        resolve(text.trim());
      });
      
      pdfParser.loadPDF(filePath);
    });
  }

  async extractDocx(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  async getImageBase64(filePath) {
    try {
      // Resize image for API (max 4MB for most APIs)
      const buffer = await sharp(filePath)
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      
      return buffer.toString('base64');
    } catch (error) {
      console.error('Image processing error:', error);
      return null;
    }
  }

  deleteSessionFiles(sessionId) {
    const sessionPath = path.join(this.uploadsPath, sessionId);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
  }

  getFileInfo(filePath) {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    return {
      name: path.basename(filePath),
      size: stats.size,
      type: this.getMimeType(ext),
      ext
    };
  }

  getMimeType(ext) {
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = FileService;
