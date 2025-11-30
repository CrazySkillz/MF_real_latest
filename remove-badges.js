const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/pages/linkedin-analytics.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Pattern 1: Remove badge rendering blocks with getBenchmarkForMetric
// This matches the IIFE pattern: {(() => { const benchmark = getBenchmarkForMetric... })()}
const pattern1 = /\{\/\*[^*]*Show badge[^*]*\*\/\}\s*\{\(\(\) => \{[\s\S]*?getBenchmarkForMetric[\s\S]*?return renderPerformanceBadge[\s\S]*?\}\)\(\)\}/g;

// Pattern 2: Remove badge rendering blocks without comment
const pattern2 = /\{\(\(\) => \{[\s\S]*?getBenchmarkForMetric[\s\S]*?return renderPerformanceBadge[\s\S]*?\}\)\(\)\}/g;

// Pattern 3: Remove simpler badge blocks
const pattern3 = /\{\(\(\) => \{[\s\S]*?const \w+Benchmark = getBenchmarkForMetric[\s\S]*?\}\)\(\)\}/g;

console.log('Removing badge rendering blocks...');

let originalLength = content.length;

// Apply patterns
content = content.replace(pattern1, '');
content = content.replace(pattern2, '');
content = content.replace(pattern3, '');

let newLength = content.length;
let removed = originalLength - newLength;

console.log(`Removed ${removed} characters`);
console.log(`Original: ${originalLength}, New: ${newLength}`);

// Write back
fs.writeFileSync(filePath, content, 'utf8');
console.log('File updated successfully!');

