const fs = require('fs');
const https = require('https');

const PROJECT_ID = 'fja-sms';
const configPath = 'C:/Users/GuyGuy/.config/configstore/firebase-tools.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens.access_token;

function apiRequest(options) {
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
    req.end();
  });
}

async function listAll(collectionId) {
  let docs = [];
  let pageToken = '';
  do {
    let path = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionId}?pageSize=300`;
    if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
    const res = await apiRequest({
      hostname: 'firestore.googleapis.com',
      path,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 200 && res.data.documents) {
      docs.push(...res.data.documents);
    }
    pageToken = res.data.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function testMetrics() {
  const profileDocs = await listAll('profiles');
  const enrolmentDocs = await listAll('enrolments');
  const classDocs = await listAll('classes');

  console.log(`Fetched: ${profileDocs.length} profiles, ${enrolmentDocs.length} enrolments, ${classDocs.length} classes`);

  const profiles = profileDocs.map(d => {
    const f = d.fields;
    return {
      user_id: f.user_id?.stringValue,
      cummulative_academic_score: f.cummulative_academic_score?.doubleValue || (f.cummulative_academic_score?.integerValue ? parseInt(f.cummulative_academic_score.integerValue) : null),
      cummulative_attendance: f.cummulative_attendance?.doubleValue || (f.cummulative_attendance?.integerValue ? parseInt(f.cummulative_attendance.integerValue) : null)
    };
  });

  const enrolments = enrolmentDocs.map(d => ({
    student_id: d.fields.student_id?.stringValue,
    class_id: d.fields.class_id?.stringValue
  }));

  const classes = classDocs.map(d => ({
    class_id: d.fields.class_id?.stringValue,
    class_name: d.fields.class_name?.stringValue
  }));

  // School-wide averages
  const validAcad = profiles.filter(p => p.cummulative_academic_score !== null);
  const validAtt = profiles.filter(p => p.cummulative_attendance !== null);

  const schoolAvgAcad = (validAcad.reduce((a, b) => a + b.cummulative_academic_score, 0) / validAcad.length).toFixed(1);
  const schoolAvgAtt = (validAtt.reduce((a, b) => a + b.cummulative_attendance, 0) / validAtt.length).toFixed(1);

  console.log(`\nSchool-Wide Academic Average: ${schoolAvgAcad}% (${validAcad.length} students)`);
  console.log(`School-Wide Attendance Average: ${schoolAvgAtt}% (${validAtt.length} students)`);

  console.log('\n--- Class-by-Class Breakdown ---');
  for (const c of classes) {
    const cEnrols = enrolments.filter(e => e.class_id === c.class_id);
    const studIds = cEnrols.map(e => e.student_id);
    const cProfs = profiles.filter(p => studIds.includes(p.user_id));
    const cAcad = cProfs.filter(p => p.cummulative_academic_score !== null);
    const cAtt = cProfs.filter(p => p.cummulative_attendance !== null);

    const avgAcad = cAcad.length > 0 ? (cAcad.reduce((a, b) => a + b.cummulative_academic_score, 0) / cAcad.length).toFixed(1) + '%' : 'N/A';
    const avgAtt = cAtt.length > 0 ? (cAtt.reduce((a, b) => a + b.cummulative_attendance, 0) / cAtt.length).toFixed(1) + '%' : 'N/A';

    console.log(`- ${c.class_name.padEnd(12)}: Enrolled: ${cEnrols.length.toString().padStart(2)} | Acad Avg: ${avgAcad.padStart(6)} | Att Avg: ${avgAtt.padStart(6)}`);
  }
}

testMetrics().catch(console.error);
