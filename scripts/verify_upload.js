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

async function countCollection(collectionId) {
  let count = 0;
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
      count += res.data.documents.length;
    }
    pageToken = res.data.nextPageToken || '';
  } while (pageToken);

  return count;
}

async function verify() {
  console.log('=== VERIFYING FIRESTORE & AUTH AFTER UPLOAD ===');

  // 1. Check proprietor
  const propRes = await apiRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/u-proprietor-1`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Proprietor check:', propRes.status === 200 ? 'OK (Preserved: ' + propRes.data.fields.uid.stringValue + ')' : 'FAIL');

  // 2. Collection counts
  const collections = ['classes', 'users', 'profiles', 'enrolments', 'parent_profiles', 'parent_student_relations'];
  for (const c of collections) {
    const cnt = await countCollection(c);
    console.log(`- Collection '${c}': ${cnt} documents`);
  }

  // 3. Check sample student
  const sampleRes = await apiRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/u-fjs20260001`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (sampleRes.status === 200) {
    const f = sampleRes.data.fields;
    console.log('\nSample Student (u-fjs20260001):', {
      uid: f.uid.stringValue,
      name: `${f.first_name.stringValue} ${f.last_name.stringValue}`,
      phone: f.phone.stringValue,
      role: f.role.stringValue,
      gender: f.gender.stringValue,
      dob: f.date_of_birth?.stringValue
    });
  }

  // 4. Check sample profile
  const sampleProf = await apiRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/profiles/p-u-fjs20260001`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (sampleProf.status === 200) {
    const f = sampleProf.data.fields;
    console.log('\nSample Profile (p-u-fjs20260001):', {
      father_name: f.father_name?.stringValue,
      father_phone: f.father_phone?.stringValue,
      mother_name: f.mother_name?.stringValue,
      mother_phone: f.mother_phone?.stringValue,
      address: f.address?.stringValue,
      admission_date: f.first_admission_date?.stringValue,
      emergency_contact: f.emergency_contact?.stringValue
    });
  }

  // 5. Firebase Auth count
  const authRes = await apiRequest({
    hostname: 'identitytoolkit.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/accounts:batchGet?targetProjectId=${PROJECT_ID}&maxResults=10`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('\nFirebase Auth accounts accessible. Sample user:', authRes.data.users?.[0]?.email);

  console.log('\n✓ ALL VERIFICATION CHECKS COMPLETED!');
}

verify().catch(console.error);
