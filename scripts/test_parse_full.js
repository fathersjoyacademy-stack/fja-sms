const fs = require('fs');
const JSZip = require('../../node_modules/jszip');

function colLetterToNumber(col) {
  let num = 0;
  for (let i = 0; i < col.length; i++) {
    num = num * 26 + (col.charCodeAt(i) - 64);
  }
  return num;
}

function parseCellRef(ref) {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return { col: ref, colNum: 1, row: 1 };
  return {
    col: match[1],
    colNum: colLetterToNumber(match[1]),
    row: parseInt(match[2], 10)
  };
}

async function loadExcelWorkbook() {
  const filePath = "C:/Users/GuyGuy/Desktop/Father's Joy SMS.xlsx";
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const wbXml = await zip.file('xl/workbook.xml').async('text');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('text');
  
  const relMap = {};
  const relRegex = /<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g;
  let relMatch;
  while ((relMatch = relRegex.exec(relsXml)) !== null) {
    relMap[relMatch[1]] = relMatch[2];
  }

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

  // Shared strings
  const sharedStrings = [];
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

  const result = {};

  for (const s of sheets) {
    const sFile = zip.file(s.target);
    if (!sFile) continue;
    const sXml = await sFile.async('text');

    const rowRegex = /<row[^>]+r="(\d+)"[^>]*>(.*?)<\/row>/gs;
    let rowMatch;
    const sheetRows = [];

    while ((rowMatch = rowRegex.exec(sXml)) !== null) {
      const rowNum = parseInt(rowMatch[1], 10);
      const rowContent = rowMatch[2];
      const cellRegex = /<c\s+r="([A-Z0-9]+)"(?:\s+s="[^"]*")?(?:\s+t="([^"]*)")?[^>]*>(?:<v>(.*?)<\/v>)?(?:<is><t[^>]*>(.*?)<\/t><\/is>)?<\/c>/gs;
      let cellMatch;
      const rowData = {};

      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const cellRef = cellMatch[1];
        const cellType = cellMatch[2];
        const vVal = cellMatch[3];
        const isVal = cellMatch[4];
        const parsedRef = parseCellRef(cellRef);

        let cellValue = '';
        if (cellType === 's') {
          const sIdx = parseInt(vVal, 10);
          cellValue = sharedStrings[sIdx] || '';
        } else if (cellType === 'inlineStr' || isVal !== undefined) {
          cellValue = isVal || '';
        } else if (vVal !== undefined) {
          cellValue = vVal;
        }

        // Decode XML entities
        cellValue = cellValue
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");

        rowData[parsedRef.col] = cellValue.trim();
      }

      if (Object.keys(rowData).length > 0) {
        sheetRows.push({ rowNum, data: rowData });
      }
    }

    result[s.name] = sheetRows;
  }

  return { sheets, result };
}

async function run() {
  const { sheets, result } = await loadExcelWorkbook();
  for (const s of sheets) {
    const rows = result[s.name] || [];
    console.log(`\n================ Sheet: ${s.name} (${rows.length} rows) ================`);
    if (rows.length > 0) {
      // Print header (Row 1)
      console.log('Row 1 (Header):', rows[0].data);
      if (rows.length > 1) {
        console.log('Row 2 (First student):', rows[1].data);
      }
    }
  }
}

run().catch(console.error);
