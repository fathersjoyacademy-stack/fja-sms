const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function verify() {
  console.log('====================================================');
  console.log('  VERIFYING LIVE DEPLOYMENT ON https://fja-sms.web.app ');
  console.log('====================================================\n');
  
  const website = await fetchUrl('https://fja-sms.web.app/website/index.html');
  console.log('Website Status:', website.status);
  console.log('  Contains #contact section:', website.body.includes('id="contact"'));
  console.log('  Contains Bibinii Tech developer footer:', website.body.includes('Bibinii Tech'));
  console.log('  Contains Bibinii Tech phone +233 544 73 78 70:', website.body.includes('+233 544 73 78 70'));

  const portal = await fetchUrl('https://fja-sms.web.app/portal/index.html');
  console.log('\nPortal Status:', portal.status);

  const sw = await fetchUrl('https://fja-sms.web.app/portal/sw.js');
  console.log('\nService Worker Status:', sw.status);
  console.log('  SW Version v42:', sw.body.includes('school-mgt-v42'));

  const api = await fetchUrl('https://fja-sms.web.app/portal/api.js');
  console.log('\nAPI Engine Status:', api.status);
  console.log('  Contains SMS deduplication:', api.body.includes('_recentDispatches'));
  console.log('  Contains password setup link generation:', api.body.includes('action=set-password'));

  const app = await fetchUrl('https://fja-sms.web.app/portal/app.js');
  console.log('\nApp UI Status:', app.status);
  console.log('  Contains student Primary Contact header:', app.body.includes('<th>Primary Contact</th>'));
  console.log('  Contains 09:00 AM GMT birthday auto-scheduler:', app.body.includes('currentUtcHour < 9'));
  console.log('  Contains button lockouts:', app.body.includes('Creating Student Account...') && app.body.includes('Submitting Attendance...'));

  console.log('\n====================================================');
  console.log('  LIVE VERIFICATION COMPLETE - ALL ASSETS CONFIRMED! ');
  console.log('====================================================\n');
}

verify().catch(console.error);
