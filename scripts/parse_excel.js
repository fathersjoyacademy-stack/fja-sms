const fs = require('fs');
const path = require('path');
const JSZip = require('../../node_modules/jszip');

async function inspectExcel() {
  const filePath = "C:/Users/GuyGuy/Desktop/Father's Joy SMS.xlsx";
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const wbXml = await zip.file('xl/workbook.xml').async('text');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('text');
  
  // Rel map
  const relMap = {};
  const relRegex = /<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g;
  let relMatch;
  while ((relMatch = relRegex.exec(relsXml)) !== null) {
    relMap[relMatch[1]] = relMatch[2];
  }

  // Parse sheets
  const sheets = [];
  const sheetRegex = /<sheet[^>]+name="([^"]+)"[^>]+sheetId="([^"]+)"[^>]+r:id="([^"]+)"/g;
  let sheetMatch;
  while ((sheetMatch = sheetRegex.exec(wbXml)) !== null) {
    const targetFile = relMap[sheetMatch[3]] ? 'xl/' + relMap[sheetMatch[3]].replace(/^\//, '') : '';
    sheets.push({
      name: sheetMatch[1],
      sheetId: sheetMatch[2],
      rId: sheetMatch[3],
      target: targetFile
    });
  }

  console.log(`Found ${sheets.length} sheets:`);
  console.table(sheets);

  // Check shared strings if available
  let sharedStrings = [];
  const ssFile = zip.file('xl/sharedStrings.xml');
  if (ssFile) {
    const ssXml = await ssFile.async('text');
    const siRegex = /<si>(.*?)<\/si>/gs;
    let siMatch;
    while ((siMatch = siRegex.exec(ssXml)) !== null) {
      const textMatches = [...siMatch[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map(m => m[1]).join('');
      sharedStrings.push(textMatches);
    }
  }
  console.log(`Total shared strings: ${sharedStrings.length}`);

  // Inspect each sheet row count
  for (const s of sheets) {
    const sFile = zip.file(s.target);
    if (!sFile) continue;
    const sXml = await sFile.async('text');
    const rowCount = (sXml.match(/<row /g) || []).length;
    console.log(` - Sheet "${s.name}": ${rowCount} rows`);
  }
}

inspectExcel().catch(console.error);
