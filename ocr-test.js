const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');

async function testTesseract(imagePath) {
  console.log('Testing Tesseract OCR...');
  try {
    const worker = await createWorker('chi_sim');
    const ret = await worker.recognize(imagePath);
    await worker.terminate();
    return { success: true, text: ret.data.text, confidence: ret.data.confidence };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  const testImage = path.join(__dirname, 'test-composition.jpg');
  if (!fs.existsSync(testImage)) {
    console.log('No test image found. Please save a composition image as test-composition.jpg');
    const readme = '# OCR Test\n\n1. Save handwriting image as test-composition.jpg\n2. Run: node ocr-test.js\n\nInstall: npm install tesseract.js';
    fs.writeFileSync(path.join(__dirname, 'OCR_TEST_README.md'), readme);
    console.log('Created OCR_TEST_README.md');
    return;
  }
  const result = await testTesseract(testImage);
  console.log('Result:', result);
}

main().catch(console.error);
