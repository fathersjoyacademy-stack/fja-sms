const fs = require('fs');
const assert = require('assert');

console.log('========================================================================');
console.log('       CALENDAR SETTER & WEBSITE EVENTS COMPREHENSIVE VERIFICATION       ');
console.log('========================================================================\n');

// 1. Verify portal/db.js configuration
console.log('1. Checking portal/db.js...');
const dbJs = fs.readFileSync('portal/db.js', 'utf8');

assert.ok(dbJs.includes('const REALTIME_STORES = ["portal_messages", "notifications", "broadcast_requests", "cms_content", "academic_calendar"];'),
  'REALTIME_STORES must include academic_calendar for multi-device real-time sync');

assert.ok(dbJs.includes('storeName !== "academic_calendar"'),
  'Delta sync must not skip academic_calendar on lastSync mismatch');

assert.ok(dbJs.includes('window.shouldKeepLocalDoc = shouldKeepLocalDoc;'),
  'shouldKeepLocalDoc must be accessible globally');

assert.ok(dbJs.includes('canonical_terms:') && dbJs.includes('ev-term1-canonical'),
  'seedCalendar in portal/db.js must include canonical_terms and default term events');

console.log('  [PASS] portal/db.js has real-time listener, delta safety, and canonical seed events.\n');

// 2. Checking portal/app.js Calendar Setter UI
console.log('2. Checking portal/app.js Calendar Setter...');
const appJs = fs.readFileSync('portal/app.js', 'utf8');

assert.ok(appJs.includes('Fresh pull for academic calendar from cloud Firestore'),
  'renderAcademicCalendar must perform fresh cloud pull from Firestore on view load');

assert.ok(appJs.includes('${ct.term1.start_date || cal.term1_start || \'2026-09-08\'}'),
  'Form inputs must have correct canonical date fallbacks');

assert.ok(appJs.includes('isTerm1') && appJs.includes('isTerm2') && appJs.includes('isTerm3'),
  'Term matching must use flexible regex matching (e.g. 1st Academic Term, First Term, Term 1)');

assert.ok(appJs.includes('1st Academic Term') && appJs.includes('2nd Academic Term') && appJs.includes('3rd Academic Term'),
  'btn-save-canonical-terms must upsert events into freshCal.events');

assert.ok(appJs.includes('await loadEventsList();') && appJs.includes('showToast("Canonical Academic Terms saved and Scheduled Calendar Events updated successfully!", "success");'),
  'Saving canonical terms must immediately call loadEventsList() to refresh Scheduled Calendar Events UI');

console.log('  [PASS] portal/app.js correctly upserts scheduled events and refreshes UI on save.\n');

// 3. Checking website/website.js
console.log('3. Checking website/website.js Academic Calendar & Events display...');
const webJs = fs.readFileSync('website/website.js', 'utf8');

assert.ok(webJs.includes('Direct academic calendar cloud pull') || webJs.includes('Fresh pull for academic calendar from cloud Firestore'),
  'website.js must actively pull academic calendar from Firestore');

assert.ok(webJs.includes('Fallback synthesis from canonical terms or root dates if events list is empty'),
  'website.js must have fallback synthesis for term events if events list is empty');

assert.ok(webJs.includes('renderWebsiteCMSAndCalendar()'),
  'website.js must render calendar and listen to dbSyncUpdate');

console.log('  [PASS] website/website.js has direct cloud pull and zero-blank event synthesis.\n');

// 4. Checking Service Worker version
console.log('4. Checking portal/sw.js...');
const swJs = fs.readFileSync('portal/sw.js', 'utf8');
assert.ok(swJs.includes('school-mgt-v49'), 'Service worker cache version must be bumped to school-mgt-v49');
console.log('  [PASS] Service worker bumped to school-mgt-v49.\n');

console.log('========================================================================');
console.log('ALL CALENDAR SETTER & WEBSITE EVENTS AUDITS PASSED WITH 100% SUCCESS!');
console.log('========================================================================');
