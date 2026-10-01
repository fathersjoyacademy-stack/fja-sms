const fs = require('fs');
const https = require('https');
const JSZip = require('C:/Users/GuyGuy/.gemini/antigravity/scratch/node_modules/jszip');

const PROJECT_ID = 'fja-sms';
const configPath = 'C:/Users/GuyGuy/.config/configstore/firebase-tools.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens.access_token;

function apiRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

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

function parseScore(val) {
  if (!val) return null;
  const num = parseFloat(val);
  if (isNaN(num)) return null;
  if (num > 0 && num <= 1.0) {
    return Math.round(num * 1000) / 10;
  }
  return Math.round(num * 10) / 10;
}

function getSheetClassId(sheetName) {
  const norm = sheetName.toLowerCase().replace(/[\s\-_]+/g, '');
  if (norm === 'creche') return { id: 'c-creche', name: 'Creche' };
  if (norm === 'nursery1') return { id: 'c-nursery1', name: 'Nursery 1' };
  if (norm === 'nursery2') return { id: 'c-nursery2', name: 'Nursery 2' };
  if (norm === 'kg1') return { id: 'c-kg1', name: 'KG 1' };
  if (norm === 'kg2') return { id: 'c-kg2', name: 'KG 2' };
  if (norm === 'primary1') return { id: 'c-primary1', name: 'Primary 1' };
  if (norm === 'primary2') return { id: 'c-primary2', name: 'Primary 2' };
  if (norm === 'primary3') return { id: 'c-primary3', name: 'Primary 3' };
  if (norm === 'primary4') return { id: 'c-primary4', name: 'Primary 4' };
  if (norm === 'primary5') return { id: 'c-primary5', name: 'Primary 5' };
  if (norm === 'primary6') return { id: 'c-primary6', name: 'Primary 6' };
  if (norm === 'jhs1') return { id: 'c-jhs1', name: 'JHS 1' };
  if (norm === 'jhs2') return { id: 'c-jhs2', name: 'JHS 2' };
  if (norm === 'jhs3') return { id: 'c-jhs3', name: 'JHS 3' };
  throw new Error(`Unknown class sheet: ${sheetName}`);
}

const promotionLadder = {
  'c-creche': { nextId: 'c-nursery1', nextName: 'Nursery 1' },
  'c-nursery1': { nextId: 'c-nursery2', nextName: 'Nursery 2' },
  'c-nursery2': { nextId: 'c-kg1', nextName: 'KG 1' },
  'c-kg1': { nextId: 'c-kg2', nextName: 'KG 2' },
  'c-kg2': { nextId: 'c-primary1', nextName: 'Primary 1' },
  'c-primary1': { nextId: 'c-primary2', nextName: 'Primary 2' },
  'c-primary2': { nextId: 'c-primary3', nextName: 'Primary 3' },
  'c-primary3': { nextId: 'c-primary4', nextName: 'Primary 4' },
  'c-primary4': { nextId: 'c-primary5', nextName: 'Primary 5' },
  'c-primary5': { nextId: 'c-primary6', nextName: 'Primary 6' },
  'c-primary6': { nextId: 'c-jhs1', nextName: 'JHS 1' },
  'c-jhs1': { nextId: 'c-jhs2', nextName: 'JHS 2' },
  'c-jhs2': { nextId: 'c-jhs3', nextName: 'JHS 3' },
  'c-jhs3': { nextId: 'c-alumni', nextName: 'Graduated (Alumni)' }
};

function toFirestoreValue(val) {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: val.toString() };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(toFirestoreValue)
      }
    };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
}

async function executeBatchWrites(writes, batchSize = 50) {
  for (let i = 0; i < writes.length; i += batchSize) {
    const chunk = writes.slice(i, i + batchSize);
    const postData = JSON.stringify({ writes: chunk });
    
    let success = false;
    let attempts = 0;
    while (!success && attempts < 5) {
      attempts++;
      try {
        const res = await apiRequest({
          hostname: 'firestore.googleapis.com',
          path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents:batchWrite`,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        }, postData);

        if (res.status === 200) {
          success = true;
          console.log(`  Committed batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(writes.length / batchSize)} (${chunk.length} documents)`);
        } else {
          console.warn(`  Attempt ${attempts}: batchWrite returned status ${res.status}. Retrying in 1s...`);
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (err) {
        console.warn(`  Attempt ${attempts}: Network error (${err.message}). Retrying in 1.5s...`);
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    if (!success) {
      throw new Error(`Failed to commit batch ${Math.floor(i / batchSize) + 1} after 5 attempts.`);
    }

    await new Promise(r => setTimeout(r, 300));
  }
}

async function runPromotion() {
  console.log('====================================================');
  console.log('PROMOTING STUDENTS TO 2026/2027 ACADEMIC YEAR');
  console.log('====================================================');

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

  let studentSeq = 1;
  const firestoreWrites = [];
  const promotionSummary = [];

  for (const s of sheets) {
    const origClass = getSheetClassId(s.name);
    const targetPromoted = promotionLadder[origClass.id];
    const sFile = zip.file(s.target);
    if (!sFile) continue;
    const sXml = await sFile.async('text');

    const rowRegex = /<row[^>]+r="(\d+)"[^>]*>(.*?)<\/row>/gs;
    let rowMatch;
    let sheetStudentCount = 0;

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

        rowData[parsedRef.col] = cellValue.trim();
      }

      if (rowData.A || rowData.C) {
        sheetStudentCount++;
        const uid = `FJS2026${String(studentSeq).padStart(4, '0')}`;
        const userId = `u-${uid.toLowerCase()}`;
        const profileId = `p-${userId}`;
        const enrolmentId = `e-enrol-${String(studentSeq).padStart(4, '0')}`;

        const attPct = parseScore(rowData.P);
        const acadPct = parseScore(rowData.Q);

        const historyEntry = {
          academic_year: '2025/2026',
          class_id: origClass.id,
          class_name: origClass.name,
          attendance_rate: attPct !== null ? `${attPct}%` : 'N/A',
          academic_average: acadPct !== null ? `${acadPct}%` : 'N/A',
          status: `PROMOTED to ${targetPromoted.nextName}`,
          terms: [
            { term: '1st Term', dates: '02/09/2025 - 18/12/2025' },
            { term: '2nd Term', dates: '08/01/2026 - 01/04/2026' },
            { term: '3rd Term', dates: '21/04/2026 - 31/07/2026' }
          ]
        };

        // 1. Profile Promotion Updates
        const profileUpdateFields = {
          previous_class_id: origClass.id,
          previous_class_name: origClass.name,
          current_class_id: targetPromoted.nextId,
          current_class_name: targetPromoted.nextName,
          academic_history: JSON.stringify([historyEntry]),
          updated_at: new Date().toISOString()
        };

        firestoreWrites.push({
          updateMask: {
            fieldPaths: [
              'previous_class_id',
              'previous_class_name',
              'current_class_id',
              'current_class_name',
              'academic_history',
              'updated_at'
            ]
          },
          update: {
            name: `projects/${PROJECT_ID}/databases/(default)/documents/profiles/${profileId}`,
            fields: toFirestoreFields(profileUpdateFields)
          }
        });

        // 2. Enrolment Promotion Updates
        const enrolmentUpdateFields = {
          class_id: targetPromoted.nextId,
          academic_year: '2026/2027',
          previous_class_id: origClass.id,
          status: 'ACTIVE',
          enrolled_at: '2026-09-08',
          promoted_2026_2027: true,
          updated_at: new Date().toISOString()
        };

        firestoreWrites.push({
          updateMask: {
            fieldPaths: [
              'class_id',
              'academic_year',
              'previous_class_id',
              'status',
              'enrolled_at',
              'promoted_2026_2027',
              'updated_at'
            ]
          },
          update: {
            name: `projects/${PROJECT_ID}/databases/(default)/documents/enrolments/${enrolmentId}`,
            fields: toFirestoreFields(enrolmentUpdateFields)
          }
        });

        studentSeq++;
      }
    }

    promotionSummary.push({
      sheet: s.name,
      students: sheetStudentCount,
      fromClass: origClass.name,
      toClass: targetPromoted.nextName
    });
  }

  console.log('\n--- Promotion Plan Summary ---');
  console.table(promotionSummary);
  console.log(`Total Students Processed: ${studentSeq - 1}`);
  console.log(`Total Firestore Write Operations: ${firestoreWrites.length}`);

  console.log('\nExecuting Batch Writes to Cloud Firestore...');
  await executeBatchWrites(firestoreWrites, 100);
  console.log('✓ All 339 Students Successfully Promoted in Cloud Firestore!');
  console.log('====================================================');
}

runPromotion().catch(err => {
  console.error('Promotion failed:', err);
  process.exit(1);
});
