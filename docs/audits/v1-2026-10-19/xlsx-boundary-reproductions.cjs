const fs = require('node:fs');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const ts = require('typescript');
const root = 'docs/audits/v1-2026-10-19/';
const results = [];
let expandedBytes = 0;
function moduleFrom(path, mocks) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('exports', 'require', js)(exports, id => Object.hasOwn(mocks, id) ? mocks[id] : require(id));
  return exports;
}
const csv = moduleFrom('server/utils/csv.ts', { './data-transformation': { normalizeStrictUtcDateKey() { throw new Error('Unexpected date path'); } } });
const parser = moduleFrom('server/services/custom-integration-file-parser.ts', {
  '../utils/csv': csv,
  './pdf-parser': { parsePDFMetrics() { throw new Error('Unexpected PDF path'); } },
  zlib: { inflateRawSync(...args) { const out = zlib.inflateRawSync(...args); expandedBytes += out.length; return out; } },
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1; }
  return (value ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const local = [], central = []; let offset = 0;
  for (const [name, raw] of entries) {
    const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw), filename = Buffer.from(name), compressed = zlib.deflateRawSync(data), crc = crc32(data);
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(8, 8); header.writeUInt32LE(crc, 14); header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(filename.length, 26);
    const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(8, 10); directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(compressed.length, 20); directory.writeUInt32LE(data.length, 24); directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42);
    local.push(header, filename, compressed); central.push(directory, filename); offset += header.length + filename.length + compressed.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, end]);
}
const worksheet = spend => `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>spend</t></is></c></row><row r="2"><c r="A2"><v>${spend}</v></c></row></sheetData></worksheet>`;
const workbook = '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Visible report" sheetId="1" r:id="rId1"/><sheet name="Hidden prior report" sheetId="2" state="hidden" r:id="rId2"/></sheets></workbook>';
const common = [
  ['[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
  ['_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
  ['xl/workbook.xml', workbook],
  ['xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>'],
];
async function run() {
  for (const hiddenFirst of [false, true]) {
    const sheets = [['xl/worksheets/sheet1.xml', worksheet(10)], ['xl/worksheets/sheet2.xml', worksheet(200)]];
    const metrics = await parser.parseCustomIntegrationFile(zip([...common, ...(hiddenFirst ? sheets.reverse() : sheets)]), 'fixture.xlsx');
    assert.equal(metrics.spend, hiddenFirst ? 200 : 10); assert.equal(metrics._confidence, 100); assert.equal(metrics._requiresReview, false);
    results.push({ case: hiddenFirst ? 'Hidden sheet first in ZIP is silently selected over first visible workbook sheet' : 'Control: visible sheet first in ZIP', metrics, workbookSheetOrder: ['Visible report', 'Hidden prior report'], hiddenFirstInZip: hiddenFirst });
  }
  expandedBytes = 0;
  const boundedPaddingBytes = 12 * 1024 * 1024;
  const padded = zip([...common, ['xl/worksheets/sheet1.xml', worksheet(10)], ['xl/worksheets/sheet2.xml', worksheet(200)], ['unused-padding.bin', Buffer.alloc(boundedPaddingBytes, 32)]]);
  const paddedMetrics = await parser.parseCustomIntegrationFile(padded, 'fixture.xlsx');
  assert.ok(padded.length < 10 * 1024 * 1024); assert.ok(expandedBytes > boundedPaddingBytes); assert.equal(paddedMetrics.spend, 10); assert.equal(paddedMetrics._requiresReview, false);
  results.push({ case: 'Bounded archive expands unused data beyond multipart per-file limit', compressedBytes: padded.length, expandedBytes, boundedPaddingBytes, metrics: paddedMetrics, limitation: 'Only 12MiB synthetic padding; no exhaustion, production request, timing SLA or crash assertion.' });
  const duplicateXml = '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>spend</t></is></c><c r="B1" t="inlineStr"><is><t>spend</t></is></c></row><row r="2"><c r="A2"><v>100</v></c><c r="B2"><v>7</v></c></row></sheetData></worksheet>';
  for (const format of ['csv', 'xlsx']) {
    const bytes = format === 'csv' ? Buffer.from('spend,spend\n100,7') : zip([['xl/worksheets/sheet1.xml', duplicateXml]]);
    const metrics = await parser.parseCustomIntegrationFile(bytes, `fixture.${format}`);
    assert.equal(metrics.spend, 14); assert.equal(metrics._confidence, 100); assert.equal(metrics._requiresReview, false);
    results.push({ case: `Duplicate ${format.toUpperCase()} headers discard first value and count last value twice without warning`, inputValues: [100, 7], metrics, auditCorrection: 'Initial fixture expected7 after object overwrite; actual header iteration adds surviving7 twice. Assertion corrected after tracing applyHeaderRows; runtime unchanged.' });
  }
  const missing = await parser.parseCustomIntegrationFile(zip([['xl/workbook.xml', '<workbook/>']]), 'fixture.xlsx');
  assert.equal(missing._requiresReview, true); assert.equal(missing._confidence, 0);
  results.push({ case: 'Control: no worksheet is marked review required', metrics: missing });
  const shared = await parser.parseCustomIntegrationFile(zip([['xl/sharedStrings.xml', '<sst><si><t>spend</t></si></sst>'], ['xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"><c r="A2"><v>0</v></c></row></sheetData></worksheet>']]), 'fixture.xlsx');
  assert.equal(shared.spend, 0); assert.equal(shared._requiresReview, false);
  results.push({ case: 'Control: shared string header and explicit zero preserved', metrics: shared });
  fs.writeFileSync(root + 'xlsx-boundary-reproductions.json', JSON.stringify({ head: '777aae6f6353e998d60b635d3e66b413093117c2', executedAt: new Date().toISOString(), boundary: 'Actual parser/CSV modules; zlib delegates to actual bounded inflate and counts output. Synthetic local ZIPs only. No HTTP, app startup, DB, provider or file extraction.', results }, null, 2) + '\n');
  console.log(`${results.length} bounded XLSX/CSV cases executed`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
