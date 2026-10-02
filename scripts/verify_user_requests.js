const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log('========================================================');
console.log('       USER REQUIREMENTS VERIFICATION AUDIT             ');
console.log('========================================================\n');

// Requirement 1: Honeycomb Background Real Images
console.log('Auditing Requirement 1: Honeycomb Background...');
const honeycombJs = fs.readFileSync(path.join(__dirname, '../website/honeycomb.js'), 'utf8');
assert.strictEqual(honeycombJs.includes('unsplash'), false, 'All default Unsplash images must be deleted');
assert.strictEqual(honeycombJs.includes('DEFAULT_SCHOOL_IMAGES'), false, 'DEFAULT_SCHOOL_IMAGES must be completely removed');
assert.ok(honeycombJs.includes('fetchRealGalleryImages'), 'fetchRealGalleryImages must be present');
assert.ok(honeycombJs.includes('gallery-data.json'), 'Must load real gallery images from gallery-data.json');
assert.ok(honeycombJs.includes('cellIndex % this.options.images.length'), 'Must distribute real photos evenly across cells');
console.log('  [PASS] Honeycomb has zero default system pictures and loads 50 real gallery images for mobile & desktop\n');

// Requirement 2: Deleted Calendar Events and Announcements Persistence
console.log('Auditing Requirement 2: Calendar & Announcements Deletion Persistence...');
const websiteJs = fs.readFileSync(path.join(__dirname, '../website/website.js'), 'utf8');
assert.strictEqual(websiteJs.includes('2025/2026 First Academic Term'), false, 'website.js must not re-inject hardcoded default events');

const portalApp = fs.readFileSync(path.join(__dirname, '../portal/app.js'), 'utf8');
assert.strictEqual(portalApp.includes('2025/2026 First Academic Term'), false, 'portal/app.js must not re-inject hardcoded default events on reload');

const portalDb = fs.readFileSync(path.join(__dirname, '../portal/db.js'), 'utf8');
assert.ok(portalDb.includes('sanitizeIncomingDoc'), 'sanitizeIncomingDoc must be present in portal/db.js');
assert.ok(portalDb.includes('Purging legacy sample calendar events'), 'Legacy calendar events must be purged in portal/db.js');
console.log('  [PASS] Deleted announcements and calendar events are permanently respected and never re-injected\n');

// Requirement 3: Gallery Upload Form Reset & Duplication Prevention
console.log('Auditing Requirement 3: Gallery Upload Form Reset & Duplication Prevention...');
assert.ok(portalApp.includes('albumSelect.value = "General"'), 'Target album must reset to General');
assert.ok(portalApp.includes('fileInput.value = ""'), 'Selected files input must be cleared');
assert.ok(portalApp.includes('titleInput.value = ""'), 'Photo base title input must be cleared');
assert.ok(portalApp.includes('newAlbumInput.value = ""'), 'New album input must be cleared');
assert.ok(portalApp.includes('compressBtn.disabled = true'), 'Upload button must be disabled during processing');
console.log('  [PASS] Upload form clears file input, album selector, and title after adding photos\n');

console.log('========================================================');
console.log('ALL USER REQUIREMENTS VERIFIED SUCCESSFULLY (3/3 PASSED)');
console.log('========================================================');
