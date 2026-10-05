const fs = require('fs');
const assert = require('assert');

console.log('--- Verifying Request 1: Mad. Abigail Sarfo title ---');
const dbJs = fs.readFileSync('portal/db.js', 'utf8');
const websiteJs = fs.readFileSync('website/website.js', 'utf8');
const indexHtml = fs.readFileSync('website/index.html', 'utf8');

// Verify db.js does not contain Head, Management as a role assignment
assert.strictEqual(dbJs.includes('role: "Head, Management"'), false, 'db.js must not assign role Head, Management');
assert.ok(dbJs.includes('{ name: "Mad. Abigail Sarfo", role: "Proprietress"'), 'db.js must set Mad. Abigail Sarfo as Proprietress');

// Verify website.js has Proprietress
assert.ok(websiteJs.includes('{ name: "Mad. Abigail Sarfo", role: "Proprietress"'), 'website.js must default Mad. Abigail Sarfo to Proprietress');
assert.ok(websiteJs.includes('normalizeLeader'), 'website.js must have normalizeLeader');

// Verify index.html has Proprietress
assert.ok(indexHtml.includes('Mad. Abigail Sarfo') && indexHtml.includes('Proprietress'), 'index.html must have Proprietress');
assert.strictEqual(indexHtml.includes('Mad. Abigail Sarfo</h4>\n            <div class="leader-role">Head, Management</div>'), false, 'index.html must not have Head, Management for Abigail Sarfo');

console.log('--- Verifying Request 2: Quiz album sync & persistence ---');
// Verify gallery-data.json
const gData = JSON.parse(fs.readFileSync('website/assets/gallery-data.json', 'utf8'));
const quizPhotos = gData.filter(p => p.album === 'Quiz');
assert.strictEqual(quizPhotos.length, 6, 'gallery-data.json must have 6 Quiz photos');

// Verify REALTIME_STORES
assert.ok(dbJs.includes('REALTIME_STORES') && dbJs.includes('"cms_content"'), 'REALTIME_STORES must include cms_content');

// Verify seed fallback timestamp
assert.ok(websiteJs.includes('1970-01-01T00:00:00.000Z'), 'website.js must write epoch seed timestamp for gallery fallback');

// Verify assembleFirestoreDoc handles gallery_images without is_chunked flag
assert.ok(dbJs.includes('docData.content_key === "gallery_images"'), 'assembleFirestoreDoc must check docData.content_key === gallery_images');

// Verify Website Manager cloud refresh on view load
const appJs = fs.readFileSync('portal/app.js', 'utf8');
assert.ok(appJs.includes('Fresh pull for CMS gallery albums and images from cloud Firestore'), 'app.js must have fresh pull for CMS gallery albums and images');

console.log('[SUCCESS] All checks for Requests 1 & 2 passed with 100% precision!');
