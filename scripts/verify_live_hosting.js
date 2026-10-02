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
  console.log('Verifying live deployment on https://fja-sms.web.app ...');
  
  const home = await fetchUrl('https://fja-sms.web.app/website/');
  console.log('Website Status:', home.status);

  const hc = await fetchUrl('https://fja-sms.web.app/website/honeycomb.js');
  console.log('Honeycomb Status:', hc.status);
  console.log('  Contains REAL_GALLERY_IMAGES:', hc.body.includes('REAL_GALLERY_IMAGES'));
  console.log('  Contains unsplash:', hc.body.includes('unsplash'));

  const portal = await fetchUrl('https://fja-sms.web.app/portal/');
  console.log('Portal Status:', portal.status);

  const sw = await fetchUrl('https://fja-sms.web.app/portal/sw.js');
  console.log('SW Status:', sw.status);
  console.log('  SW Version:', sw.body.includes('school-mgt-v41') ? 'school-mgt-v41 (LATEST)' : 'OLDER');
}

verify().catch(console.error);
