const fs = require('fs');
const crypto = require('crypto');
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

function toTitleCase(str) {
  if (!str) return '';
  return str.toString().trim().toLowerCase().split(/\s+/).map(word => {
    return word.split('-').map(part => {
      if (!part) return '';
      return part.charAt(0).toUpperCase() + part.slice(1);
    }).join('-');
  }).join(' ');
}

function normalizeContact(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  str = str.replace(/[^0-9]/g, '');
  if (!str) return '';

  if (str.length === 9 && !str.startsWith('0')) {
    str = '0' + str;
  }
  if (str.length === 12 && str.startsWith('233')) {
    str = '0' + str.slice(3);
  }
  if (str.length === 13 && str.startsWith('0233')) {
    str = '0' + str.slice(4);
  }
  if (str.length === 14 && str.startsWith('00233')) {
    str = '0' + str.slice(5);
  }
  return str;
}

function isValidGhanaPhone(phone) {
  return typeof phone === 'string' && phone.length === 10 && phone.startsWith('0');
}

function formatExcelDate(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str || str === '-' || str.toLowerCase() === 'n/a') return null;

  if (/^\d+(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str);
    const utcDays = Math.floor(serial - 25569);
    const dateObj = new Date(utcDays * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getUTCFullYear();
      const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const d = String(dmyMatch[1]).padStart(2, '0');
    const m = String(dmyMatch[2]).padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  return str;
}

function parseScore(val) {
  if (!val) return null;
  const num = parseFloat(val);
  if (isNaN(num)) return null;
  // If Excel percentage entered as fraction e.g. 0.875 -> 87.5
  if (num > 0 && num <= 1.0) {
    return Math.round(num * 1000) / 10;
  }
  return Math.round(num * 10) / 10;
}

function getSheetClassId(sheetName) {
  const norm = sheetName.toLowerCase().replace(/[\s\-_]+/g, '');
  if (norm === 'creche') return 'c-creche';
  if (norm === 'nursery1') return 'c-nursery1';
  if (norm === 'nursery2') return 'c-nursery2';
  if (norm === 'kg1') return 'c-kg1';
  if (norm === 'kg2') return 'c-kg2';
  if (norm === 'primary1') return 'c-primary1';
  if (norm === 'primary2') return 'c-primary2';
  if (norm === 'primary3') return 'c-primary3';
  if (norm === 'primary4') return 'c-primary4';
  if (norm === 'primary5') return 'c-primary5';
  if (norm === 'primary6') return 'c-primary6';
  if (norm === 'jhs1') return 'c-jhs1';
  if (norm === 'jhs2') return 'c-jhs2';
  if (norm === 'jhs3') return 'c-jhs3';
  throw new Error(`Unknown class sheet: ${sheetName}`);
}

async function dryRun() {
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
  const allStudents = [];
  const allProfiles = [];
  const allEnrolments = [];
  const parentMap = new Map(); // key: phone, val: parentObj
  const relations = [];

  let phoneSourceColE = 0;
  let phoneSourceFather = 0;
  let phoneSourceMother = 0;
  let phoneSourceNone = 0;

  for (const s of sheets) {
    const classId = getSheetClassId(s.name);
    const sFile = zip.file(s.target);
    if (!sFile) continue;
    const sXml = await sFile.async('text');

    const rowRegex = /<row[^>]+r="(\d+)"[^>]*>(.*?)<\/row>/gs;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(sXml)) !== null) {
      const rowNum = parseInt(rowMatch[1], 10);
      if (rowNum === 1) continue; // header
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
        const rawStudentPhone = normalizeContact(rowData.E);
        const rawFatherPhone = normalizeContact(rowData.J);
        const rawMotherPhone = normalizeContact(rowData.M);

        let primarySms = '';
        let phoneSource = '';
        if (isValidGhanaPhone(rawStudentPhone)) {
          primarySms = rawStudentPhone;
          phoneSource = 'Col E (Student)';
          phoneSourceColE++;
        } else if (isValidGhanaPhone(rawFatherPhone)) {
          primarySms = rawFatherPhone;
          phoneSource = 'Col J (Father)';
          phoneSourceFather++;
        } else if (isValidGhanaPhone(rawMotherPhone)) {
          primarySms = rawMotherPhone;
          phoneSource = 'Col M (Mother)';
          phoneSourceMother++;
        } else {
          primarySms = rawStudentPhone || rawFatherPhone || rawMotherPhone || '';
          phoneSource = 'None valid';
          phoneSourceNone++;
          console.log(`Student with None Valid Phone: ${rowData.A} ${rowData.C} (${s.name} row ${rowNum}) - E: '${rowData.E}', J: '${rowData.J}', M: '${rowData.M}'`);
        }

        const uid = `FJS2026${String(studentSeq).padStart(4, '0')}`;
        const userId = `u-${uid.toLowerCase()}`;
        const profileId = `p-${userId}`;
        const enrolmentId = `e-enrol-${String(studentSeq).padStart(4, '0')}`;

        const firstName = toTitleCase(rowData.A);
        const otherName = toTitleCase(rowData.B);
        const lastName = toTitleCase(rowData.C);
        const rawGender = (rowData.D || '').toUpperCase();
        const gender = (rawGender.includes('F') || rawGender.includes('GIRL')) ? 'Female' : 'Male';

        const dob = formatExcelDate(rowData.H);
        const admissionDate = formatExcelDate(rowData.F);
        const homeAddress = (rowData.O || '').trim();

        const fatherName = toTitleCase(rowData.I);
        const fatherOccupation = toTitleCase(rowData.K);
        const fatherPhone = rawFatherPhone;

        const motherName = toTitleCase(rowData.L);
        const motherOccupation = toTitleCase(rowData.N);
        const motherPhone = rawMotherPhone;

        const attendancePct = parseScore(rowData.P);
        const academicPct = parseScore(rowData.Q);

        const email = rowData.G ? rowData.G.trim().toLowerCase() : null;

        const studentUser = {
          user_id: userId,
          uid: uid,
          role: 'Student',
          first_name: firstName,
          other_name: otherName,
          last_name: lastName,
          gender: gender,
          phone: primarySms,
          email: email,
          status: 'ACTIVE',
          password_hash: 'sha256_bb9f91cbda93c52e61df3f381ad7be89b14fbbe2e92cffb8ce6d2c49e1a14ea8', // sha256 of student123
          is_temporal_pwd: true,
          date_of_birth: dob,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          synced: true
        };

        const emergencyContactObj = {
          name: fatherName || motherName || 'Parent/Guardian',
          phone: primarySms
        };

        const studentProfile = {
          profile_id: profileId,
          user_id: userId,
          address: homeAddress,
          first_admission_date: admissionDate,
          joining_date: admissionDate,
          father_name: fatherName,
          father_occupation: fatherOccupation,
          father_phone: fatherPhone,
          mother_name: motherName,
          mother_occupation: motherOccupation,
          mother_phone: motherPhone,
          cummulative_attendance: attendancePct,
          cummulative_academic_score: academicPct,
          cummulative_attendance_raw: rowData.P || null,
          cummulative_academic_score_raw: rowData.Q || null,
          emergency_contact: JSON.stringify(emergencyContactObj),
          photo_url: '',
          updated_at: new Date().toISOString(),
          synced: true
        };

        const studentEnrolment = {
          enrolment_id: enrolmentId,
          student_id: userId,
          class_id: classId,
          academic_year: '2026/2027',
          status: 'ACTIVE',
          enrolled_at: admissionDate || '2026-01-10',
          updated_at: new Date().toISOString(),
          synced: true
        };

        allStudents.push(studentUser);
        allProfiles.push(studentProfile);
        allEnrolments.push(studentEnrolment);

        // Deduplicate Parents by Phone
        // 1. Father
        if (fatherPhone && isValidGhanaPhone(fatherPhone)) {
          let pId = '';
          if (parentMap.has(fatherPhone)) {
            pId = parentMap.get(fatherPhone).parent_id;
          } else {
            pId = `p-par-${fatherPhone}`;
            const fParts = fatherName ? fatherName.split(/\s+/) : ['Father', 'Guardian'];
            parentMap.set(fatherPhone, {
              parent_id: pId,
              first_name: fParts[0] || 'Father',
              last_name: fParts.slice(1).join(' ') || 'Guardian',
              phone: fatherPhone,
              email: '',
              occupation: fatherOccupation,
              address: homeAddress,
              role: 'Parent',
              updated_at: new Date().toISOString(),
              synced: true
            });
          }
          relations.push({
            relation_id: `rel-f-${userId}`,
            parent_id: pId,
            student_id: userId,
            relationship_type: 'Father',
            updated_at: new Date().toISOString(),
            synced: true
          });
        }

        // 2. Mother
        if (motherPhone && isValidGhanaPhone(motherPhone)) {
          let pId = '';
          if (parentMap.has(motherPhone)) {
            pId = parentMap.get(motherPhone).parent_id;
          } else {
            pId = `p-par-${motherPhone}`;
            const mParts = motherName ? motherName.split(/\s+/) : ['Mother', 'Guardian'];
            parentMap.set(motherPhone, {
              parent_id: pId,
              first_name: mParts[0] || 'Mother',
              last_name: mParts.slice(1).join(' ') || 'Guardian',
              phone: motherPhone,
              email: '',
              occupation: motherOccupation,
              address: homeAddress,
              role: 'Parent',
              updated_at: new Date().toISOString(),
              synced: true
            });
          }
          relations.push({
            relation_id: `rel-m-${userId}`,
            parent_id: pId,
            student_id: userId,
            relationship_type: 'Mother',
            updated_at: new Date().toISOString(),
            synced: true
          });
        }

        studentSeq++;
      }
    }
  }

  console.log('=== DRY RUN SUMMARY ===');
  console.log(`Total Students: ${allStudents.length}`);
  console.log(`Total Profiles: ${allProfiles.length}`);
  console.log(`Total Enrolments: ${allEnrolments.length}`);
  console.log(`Unique Parents: ${parentMap.size}`);
  console.log(`Parent-Student Relations: ${relations.length}`);
  console.log('Phone Sources:', {
    'Col E (Student)': phoneSourceColE,
    'Col J (Father Fallback)': phoneSourceFather,
    'Col M (Mother Fallback)': phoneSourceMother,
    'None Valid': phoneSourceNone
  });

  console.log('\nSample Student (Index 0):', JSON.stringify(allStudents[0], null, 2));
  console.log('\nSample Profile (Index 0):', JSON.stringify(allProfiles[0], null, 2));
  console.log('\nSample Enrolment (Index 0):', JSON.stringify(allEnrolments[0], null, 2));
  console.log('\nSample Parent (First):', JSON.stringify(Array.from(parentMap.values())[0], null, 2));
  console.log('\nSample Relation (First):', JSON.stringify(relations[0], null, 2));

  // Check last student
  const lastIdx = allStudents.length - 1;
  console.log('\nLast Student:', JSON.stringify(allStudents[lastIdx], null, 2));
  console.log('Last Enrolment:', JSON.stringify(allEnrolments[lastIdx], null, 2));
}

dryRun().catch(console.error);
