// scripts/fix_ryan_uid.js
const https = require('https');

async function fixRyanUID() {
  console.log('Starting UID repair for Ryan Asante Kwarteng Donfeh...');

  // 1. Authenticate anonymously with Firebase
  const authRes = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyBFC7vJvuGjHm5kDgTaNP-Z9892o2pkAmg', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true })
  });
  const authData = await authRes.json();
  const token = authData.idToken;
  if (!token) throw new Error('Could not obtain Firebase Auth token');

  console.log('Authenticated with Firebase successfully.');

  // 2. Fetch current record of Ryan (u-at5o5hokc)
  const getRes = await fetch('https://firestore.googleapis.com/v1/projects/fja-sms/databases/(default)/documents/users/u-at5o5hokc', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const currentDoc = await getRes.json();
  console.log('Current Ryan record in Firestore:', currentDoc.fields.first_name.stringValue, currentDoc.fields.last_name.stringValue, currentDoc.fields.uid.stringValue);

  if (currentDoc.fields.uid.stringValue !== 'FJS20260383') {
    console.log('Ryan already has UID:', currentDoc.fields.uid.stringValue);
  }

  // 3. Update Ryan's UID to FJS20260384
  const nowIso = new Date().toISOString();
  const updateFields = {
    ...currentDoc.fields,
    uid: { stringValue: 'FJS20260384' },
    updated_at: { stringValue: nowIso }
  };

  const patchRes = await fetch('https://firestore.googleapis.com/v1/projects/fja-sms/databases/(default)/documents/users/u-at5o5hokc?updateMask.fieldPaths=uid&updateMask.fieldPaths=updated_at', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      fields: {
        uid: { stringValue: 'FJS20260384' },
        updated_at: { stringValue: nowIso }
      }
    })
  });
  const patchedDoc = await patchRes.json();
  console.log('Successfully updated Ryan in Firestore to UID:', patchedDoc.fields.uid.stringValue, 'at', patchedDoc.fields.updated_at.stringValue);

  // 4. Update settings/uid_sequences
  const seqRes = await fetch('https://firestore.googleapis.com/v1/projects/fja-sms/databases/(default)/documents/settings/uid_sequences', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      fields: {
        FJS2026: { integerValue: '384' },
        updated_at: { stringValue: nowIso }
      }
    })
  });
  const seqDoc = await seqRes.json();
  console.log('Successfully initialized settings/uid_sequences:', JSON.stringify(seqDoc.fields));

  // 5. Bump settings/sync_catalog for "users" so all devices re-sync
  const syncNow = Date.now();
  const catRes = await fetch('https://firestore.googleapis.com/v1/projects/fja-sms/databases/(default)/documents/settings/sync_catalog?updateMask.fieldPaths=users&updateMask.fieldPaths=updated_at', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      fields: {
        users: { integerValue: String(syncNow) },
        updated_at: { stringValue: nowIso }
      }
    })
  });
  const catDoc = await catRes.json();
  console.log('Successfully bumped settings/sync_catalog for users:', catDoc.name);

  // 6. Verify Keren Quarshie still has FJS20260383
  const kerenRes = await fetch('https://firestore.googleapis.com/v1/projects/fja-sms/databases/(default)/documents/users/u-hw0tev7yw', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const kerenDoc = await kerenRes.json();
  console.log('Verified Keren Quarshie UID:', kerenDoc.fields.uid.stringValue, 'Name:', kerenDoc.fields.first_name.stringValue, kerenDoc.fields.last_name.stringValue);

  console.log('UID repair script completed with 100% success!');
}

fixRyanUID().catch(err => {
  console.error('Error during UID repair:', err);
  process.exit(1);
});
