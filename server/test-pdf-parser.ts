import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join } from 'path';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

async function testPDFParser() {
  console.log('=== PDF Parser Test ===\n');
  
  // Create a simple test buffer (this would be your PDF data)
  const testBuffer = Buffer.from('test');
  console.log('1. Test buffer created:', testBuffer.length, 'bytes');
  
  // Convert to Uint8Array
  const uint8Array = new Uint8Array(testBuffer);
  console.log('2. Converted to Uint8Array:', uint8Array.length, 'bytes');
  console.log('3. Type check:', uint8Array instanceof Uint8Array);
  
  // Try to create PDFParse instance
  try {
    console.log('\n4. Creating PDFParse instance...');
    const parser = new PDFParse(uint8Array);
    console.log('5. PDFParse instance created successfully');
    
    console.log('\n6. Attempting to get text...');
    const textResult = await parser.getText();
    console.log('7. Text extraction result:', textResult);
  } catch (error) {
    console.error('ERROR:', error);
  }
}

testPDFParser().catch(console.error);
