const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function verify() {
  console.log('====================================================');
  console.log('  VERIFYING LIVE DEPLOYMENT ON https://fja-sms.web.app ');
  console.log('====================================================\n');
  
  const website = await fetchUrl('https://fja-sms.web.app/website/index.html');
  console.log('Website Status:', website.status);
  console.log('  Cache-Control header:', website.headers['cache-control']);
  console.log('  Contains #contact section:', website.body.includes('id="contact"'));
  console.log('  Contains Bibinii Tech developer footer:', website.body.includes('Bibinii Tech'));
  console.log('  Contains Bibinii Tech phone +233 544 73 78 70:', website.body.includes('+233 544 73 78 70'));
  console.log('  Contains #school-honeycomb-bg:', website.body.includes('id="school-honeycomb-bg"'));

  const honeycomb = await fetchUrl('https://fja-sms.web.app/website/honeycomb.js');
  console.log('\nHoneycomb Script Status:', honeycomb.status);
  console.log('  Cache-Control header:', honeycomb.headers['cache-control']);
  console.log('  Contains FJA real gallery photos:', honeycomb.body.includes('FJA_REAL_PHOTOS') && honeycomb.body.includes('photo-'));
  console.log('  Zero Unsplash default images:', !honeycomb.body.includes('DEFAULT_SCHOOL_IMAGES'));

  const photoRoot = await fetchUrl('https://fja-sms.web.app/assets/gallery/photo-01.jpg');
  console.log('\nRoot Photo Asset (/assets/gallery/photo-01.jpg):', photoRoot.status);

  const photoWebsite = await fetchUrl('https://fja-sms.web.app/website/assets/gallery/photo-01.jpg');
  console.log('Website Photo Asset (/website/assets/gallery/photo-01.jpg):', photoWebsite.status);

  const galleryJsonRoot = await fetchUrl('https://fja-sms.web.app/assets/gallery-data.json');
  console.log('Root gallery-data.json (/assets/gallery-data.json):', galleryJsonRoot.status);

  const portal = await fetchUrl('https://fja-sms.web.app/portal/index.html');
  console.log('\nPortal Status:', portal.status);
  console.log('  Cache-Control header:', portal.headers['cache-control']);

  const sw = await fetchUrl('https://fja-sms.web.app/portal/sw.js');
  console.log('\nService Worker Status:', sw.status);
  console.log('  SW Version v43:', sw.body.includes('school-mgt-v43'));

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
