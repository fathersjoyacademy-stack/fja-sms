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

async function inspectPQ() {
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
    sheets.push({
      name: sheetMatch[1],
      target: 'xl/' + relMap[sheetMatch[3]].replace(/^\//, '')
    });
  }

  const sharedStrings = [];
  const ssFile = zip.file('xl/sharedStrings.xml');
  if (ssFile) {
    const ssXml = await ssFile.async('text');
    const siRegex = /<si>(.*?)<\/si>/gs;
    let siMatch;
    while ((siMatch = siRegex.exec(ssXml)) !== null) {
      sharedStrings.push([...siMatch[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map(m => m[1]).join(''));
    }
  }

  const pVals = [];
  const qVals = [];
  const rVals = [];
  const sVals = [];
  const tVals = [];

  for (const s of sheets) {
    const sFile = zip.file(s.target);
    if (!sFile) continue;
    const sXml = await sFile.async('text');
    const rowRegex = /<row[^>]+r="(\d+)"[^>]*>(.*?)<\/row>/gs;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(sXml)) !== null) {
      const rowNum = parseInt(rowMatch[1], 10);
      if (rowNum === 1) continue;
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
          cellValue = sharedStrings[parseInt(vVal, 10)] || '';
        } else if (cellType === 'inlineStr' || isVal !== undefined) {
          cellValue = isVal || '';
        } else if (vVal !== undefined) {
          cellValue = vVal;
        }

        cellValue = cellValue.trim();
        rowData[parsedRef.col] = cellValue;
      }

      if (rowData.A || rowData.C) {
        if (rowData.P) pVals.push(rowData.P);
        if (rowData.Q) qVals.push(rowData.Q);
        if (rowData.R) rVals.push(rowData.R);
        if (rowData.S) sVals.push(rowData.S);
        if (rowData.T) tVals.push(rowData.T);
      }
    }
  }

  console.log('Sample P (Attendance):', pVals.slice(0, 10));
  console.log('Sample Q (Academic Score):', qVals.slice(0, 10));
  console.log('Sample R (Fees Balance):', rVals.slice(0, 10));
  console.log('Sample S (Description):', sVals.slice(0, 10));
  console.log('Sample T (Fees Paid):', tVals.slice(0, 10));
  console.log('Counts: P:', pVals.length, 'Q:', qVals.length, 'R:', rVals.length, 'S:', sVals.length, 'T:', tVals.length);
}

inspectPQ().catch(console.error);
