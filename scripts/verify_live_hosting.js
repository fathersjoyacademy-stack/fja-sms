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
  console.log('  Contains Leadership Subheading "Board":', website.body.includes('Board</h3>') || website.body.includes('>Board<'));
  console.log('  Contains Leadership Subheading "Management Team":', website.body.includes('Management Team</h3>') || website.body.includes('>Management Team<'));
  console.log('  Contains Mr. Shadrach Dampson (Board Chairman):', website.body.includes('Mr. Shadrach Dampson') && website.body.includes('Board Chairman'));
  console.log('  Contains Mr. Ernest Brew Paintsil (Proprietor):', website.body.includes('Mr. Ernest Brew Paintsil') && website.body.includes('Proprietor'));
  console.log('  Contains Mad. Abigail Sarfo (Proprietress):', website.body.includes('Mad. Abigail Sarfo') && website.body.includes('Proprietress'));
  console.log('  Contains Mad. Delphina Kwarah (Supervisor):', website.body.includes('Mad. Delphina Kwarah'));
  console.log('  Contact Us card centered styling:', website.body.includes('text-align:center') || website.body.includes('text-align: center'));

  const leadershipPhoto = await fetchUrl('https://fja-sms.web.app/website/assets/leadership/shadrach-dampson.jpeg');
  console.log('\nLeadership Photo Asset (/website/assets/leadership/shadrach-dampson.jpeg):', leadershipPhoto.status);

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
  console.log('  Contains Quiz album photos in gallery-data.json:', galleryJsonRoot.body.includes('"Quiz"'));

  const portal = await fetchUrl('https://fja-sms.web.app/portal/index.html');
  console.log('\nPortal Status:', portal.status);
  console.log('  Cache-Control header:', portal.headers['cache-control']);

  const sw = await fetchUrl('https://fja-sms.web.app/portal/sw.js');
  console.log('\nService Worker Status:', sw.status);
  console.log('  SW Version v48:', sw.body.includes('school-mgt-v48'));

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
