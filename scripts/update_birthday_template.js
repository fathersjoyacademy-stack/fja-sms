const fs = require('fs');
const https = require('https');

const PROJECT_ID = 'fja-sms';
const configPath = 'C:/Users/GuyGuy/.config/configstore/firebase-tools.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.tokens.access_token;

const postData = JSON.stringify({
  fields: {
    birthday_message: {
      stringValue: "Happy Birthday, #student_name#! Father's Joy Academy wishes you a blessed day of growth and excellence!"
    },
    updated_at: {
      stringValue: new Date().toISOString()
    }
  }
});

const req = https.request({
  hostname: 'firestore.googleapis.com',
  path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/settings/sms_templates`,
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Firestore sms_templates update status:', res.statusCode));
});
req.write(postData);
req.end();
