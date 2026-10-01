const fs = require('fs');
const https = require('https');

// Read Firebase token from configstore
const configPath = 'C:/Users/GuyGuy/.config/configstore/firebase-tools.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens.access_token;
const PROJECT_ID = 'fja-sms';

function apiRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
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

async function listDocuments(collectionId) {
  let docs = [];
  let pageToken = '';
  do {
    let path = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionId}?pageSize=100`;
    if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
    
    const res = await apiRequest({
      hostname: 'firestore.googleapis.com',
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.status === 200 && res.data.documents) {
      docs.push(...res.data.documents);
    }
    pageToken = res.data.nextPageToken || '';
  } while (pageToken);

  return docs;
}

async function deleteDocument(docName) {
  const encodedPath = docName.split('/').map((seg, i) => i < 5 ? seg : encodeURIComponent(seg)).join('/');
  const res = await apiRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/${encodedPath}`,
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return res.status === 200 || res.status === 404;
}

async function updateClassDocument(docName, docData) {
  const encodedPath = docName.split('/').map((seg, i) => i < 5 ? seg : encodeURIComponent(seg)).join('/');
  const fields = docData.fields || {};
  fields.class_teacher_id = { stringValue: '' };
  fields.updated_at = { stringValue: new Date().toISOString() };

  const res = await apiRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/${encodedPath}?updateMask.fieldPaths=class_teacher_id&updateMask.fieldPaths=updated_at`,
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }, { fields });
  return res.status === 200;
}

async function deleteAuthUsers() {
  console.log('\n--- Cleaning Firebase Auth Users ---');
  let nextPageToken = undefined;
  let allUidsToDelete = [];

  do {
    let path = `/v1/projects/${PROJECT_ID}/accounts:batchGet?targetProjectId=${PROJECT_ID}&maxResults=100`;
    if (nextPageToken) path += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;

    const res = await apiRequest({
      hostname: 'identitytoolkit.googleapis.com',
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.data && res.data.users) {
      for (const u of res.data.users) {
        const email = (u.email || '').toLowerCase();
        // Never delete proprietor
        if (email.includes('proprietor') || email.includes('pr2026')) {
          console.log(`Preserving auth user: ${u.localId} (${email})`);
          continue;
        }
        allUidsToDelete.push(u.localId);
      }
    }
    nextPageToken = res.data?.nextPageToken;
  } while (nextPageToken);

  console.log(`Found ${allUidsToDelete.length} Auth accounts to delete.`);

  // Delete in batches of 100 via batchDelete
  for (let i = 0; i < allUidsToDelete.length; i += 100) {
    const chunk = allUidsToDelete.slice(i, i + 100);
    const res = await apiRequest({
      hostname: 'identitytoolkit.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/accounts:batchDelete`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }, { localIds: chunk, force: true });
    console.log(`Batch deleted ${chunk.length} Auth users (Status: ${res.status})`);
  }
}

async function runCleanSlate() {
  console.log('==================================================');
  console.log('STARTING CLEAN SLATE PURGE');
  console.log('Project:', PROJECT_ID);
  console.log('==================================================');

  // 1. Purge Users (Keep Proprietor)
  console.log('\n1. Processing collection: users');
  const userDocs = await listDocuments('users');
  let usersDeleted = 0;
  for (const doc of userDocs) {
    const docId = doc.name.split('/').pop();
    const role = doc.fields?.role?.stringValue;
    const uid = doc.fields?.uid?.stringValue;
    if (docId === 'u-proprietor-1' || role === 'Proprietor' || uid === 'PR20260001') {
      console.log(`  [PRESERVED] Proprietor user: ${docId} (${doc.fields?.first_name?.stringValue} ${doc.fields?.last_name?.stringValue})`);
      continue;
    }
    await deleteDocument(doc.name);
    usersDeleted++;
  }
  console.log(`  -> Deleted ${usersDeleted} user accounts.`);

  // 2. Purge Profiles (Keep Proprietor)
  console.log('\n2. Processing collection: profiles');
  const profileDocs = await listDocuments('profiles');
  let profilesDeleted = 0;
  for (const doc of profileDocs) {
    const docId = doc.name.split('/').pop();
    const userId = doc.fields?.user_id?.stringValue;
    if (docId === 'p-proprietor-1' || userId === 'u-proprietor-1') {
      console.log(`  [PRESERVED] Proprietor profile: ${docId}`);
      continue;
    }
    await deleteDocument(doc.name);
    profilesDeleted++;
  }
  console.log(`  -> Deleted ${profilesDeleted} profiles.`);

  // 3. Purge operational collections completely
  const fullPurgeCollections = [
    'enrolments',
    'student_scores',
    'attendance',
    'assignments',
    'lesson_notes',
    'pickup_guardians',
    'parent_student_relations',
    'parent_profiles',
    'financial_transactions',
    'class_posts',
    'data_change_requests',
    'notifications',
    'notification_user_reads',
    'custom_recipient_groups',
    'broadcast_archives',
    'audit_logs'
  ];

  for (const col of fullPurgeCollections) {
    console.log(`\nProcessing collection: ${col}`);
    const docs = await listDocuments(col);
    for (const doc of docs) {
      await deleteDocument(doc.name);
    }
    console.log(`  -> Purged ${docs.length} documents from ${col}.`);
  }

  // 4. Staff Tasks (Keep proprietor tasks)
  console.log('\nProcessing collection: staff_tasks');
  const taskDocs = await listDocuments('staff_tasks');
  let tasksDeleted = 0;
  for (const doc of taskDocs) {
    const assignee = doc.fields?.assignee_id?.stringValue;
    const assigner = doc.fields?.assigner_id?.stringValue;
    if (assignee === 'u-proprietor-1' && assigner === 'u-proprietor-1') {
      console.log(`  [PRESERVED] Proprietor self-task: ${doc.name.split('/').pop()}`);
      continue;
    }
    await deleteDocument(doc.name);
    tasksDeleted++;
  }
  console.log(`  -> Deleted ${tasksDeleted} staff tasks.`);

  // 5. Questionnaires (Keep proprietor questionnaires)
  console.log('\nProcessing collection: questionnaires');
  const qDocs = await listDocuments('questionnaires');
  let qDeleted = 0;
  for (const doc of qDocs) {
    const creator = doc.fields?.creator_id?.stringValue;
    if (creator === 'u-proprietor-1') {
      console.log(`  [PRESERVED] Proprietor questionnaire: ${doc.name.split('/').pop()} (${doc.fields?.title?.stringValue})`);
      continue;
    }
    await deleteDocument(doc.name);
    qDeleted++;
  }
  console.log(`  -> Deleted ${qDeleted} questionnaires.`);

  // 6. Reset Classes (preserve class definitions, clear teacher assignments)
  console.log('\nProcessing collection: classes (resetting teacher assignments)');
  const classDocs = await listDocuments('classes');
  let classesReset = 0;
  for (const doc of classDocs) {
    await updateClassDocument(doc.name, doc);
    classesReset++;
  }
  console.log(`  -> Reset teacher assignments across ${classesReset} classes.`);

  // 7. Clean Firebase Auth users
  await deleteAuthUsers();

  console.log('\n==================================================');
  console.log('CLEAN SLATE PURGE COMPLETED SUCCESSFULLY!');
  console.log('==================================================');
}

runCleanSlate().catch(err => {
  console.error('Fatal error during clean slate:', err);
  process.exit(1);
});
