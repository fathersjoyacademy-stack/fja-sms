// purge_fee_entries.js - Safe Clean Slate for Student Fee Entries
// Father's Joy Academy - SMS
const fs = require('fs');
const https = require('https');

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
        'Authorization': `Bearer ${token}`,
        'x-goog-user-project': PROJECT_ID
      }
    });

    if (res.status === 200 && res.data.documents) {
      docs.push(...res.data.documents);
    } else {
      console.warn(`List status ${res.status}:`, res.data || res.raw);
      break;
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
      'Authorization': `Bearer ${token}`,
      'x-goog-user-project': PROJECT_ID
    }
  });
  return res.status === 200 || res.status === 404;
}

async function purgeFeeEntries(includeNonStudentTransactions = false) {
  console.log('==================================================');
  console.log('STARTING CLEAN SLATE PURGE FOR FEE ENTRIES');
  console.log('Project:', PROJECT_ID);
  console.log('Mode:', includeNonStudentTransactions ? 'All Financial Transactions' : 'Student Fee Entries Only');
  console.log('==================================================');

  const docs = await listDocuments('financial_transactions');
  console.log(`Retrieved ${docs.length} total transactions in financial_transactions.`);

  let deletedCount = 0;
  let preservedCount = 0;

  for (const doc of docs) {
    const fields = doc.fields || {};
    const studentId = fields.student_id?.stringValue;
    const type = fields.type?.stringValue;
    const ref = fields.reference_no?.stringValue || '';
    const txId = fields.transaction_id?.stringValue || '';

    const isFeeEntry = !!studentId || 
      type === 'FEE_PAYMENT' || 
      type === 'PAYMENT' || 
      type === 'INVOICE' || 
      type === 'REVERSAL' || 
      type === 'BAD_DEBT' ||
      txId.startsWith('t-invoice') || 
      ref.includes('School Fees') || 
      ref.startsWith('GB-');

    if (includeNonStudentTransactions || isFeeEntry) {
      const ok = await deleteDocument(doc.name);
      if (ok) deletedCount++;
    } else {
      preservedCount++;
    }
  }

  console.log(`\nPurge summary:`);
  console.log(`  - Deleted fee transactions: ${deletedCount}`);
  console.log(`  - Preserved non-fee records (e.g. payroll/general): ${preservedCount}`);
  console.log('==================================================');
}

module.exports = { purgeFeeEntries };

if (require.main === module) {
  const purgeAll = process.argv.includes('--all');
  purgeFeeEntries(purgeAll).catch(console.error);
}
