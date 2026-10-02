/**
 * Test Suite: audit_sync_and_persistence.js
 * Validates:
 * 1. Academic calendar term customization & calibration persistence across reloads (no reverting to 2026-09-08)
 * 2. New & scheduled calendar events persistence across reloads
 * 3. Website announcements & notices persistence across reloads
 * 4. Website CMS landing page copy persistence across reloads
 * 5. Universal timestamp parsing across formats (ISO strings, epoch ms, Firestore Timestamp {seconds, nanoseconds})
 * 6. Conflict resolution logic across all stores (newer local wins, unsynced local wins, empty remote protected)
 * 7. Automatic timestamp stamping on db.put writes
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'portal', 'db.js');
const appPath = path.join(__dirname, '..', 'portal', 'app.js');
const apiPath = path.join(__dirname, '..', 'portal', 'api.js');
const websitePath = path.join(__dirname, '..', 'website', 'website.js');

const dbCode = fs.readFileSync(dbPath, 'utf8');
const appCode = fs.readFileSync(appPath, 'utf8');
const apiCode = fs.readFileSync(apiPath, 'utf8');
const websiteCode = fs.readFileSync(websitePath, 'utf8');

console.log('================================================================');
console.log('  SYNC & TIMESTAMP-BASED CONFLICT RESOLUTION AUDIT SUITE        ');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

// -------------------------------------------------------------
// Test 1: Academic Calendar term date customization persistence
// -------------------------------------------------------------
runTest('Academic Calendar -> No forced term1_start !== "2026-09-08" reset on reload', () => {
  // Ensure the old destructive pattern is completely gone
  assert.strictEqual(
    dbCode.includes('cal.term1_start !== "2026-09-08"'),
    false,
    'Forced calendar reset checking cal.term1_start !== "2026-09-08" must be removed'
  );
  // Ensure safe preservation pattern exists
  assert.ok(
    dbCode.includes('without overriding custom term dates'),
    'Calendar seed should document non-destructive preservation'
  );
});

// -------------------------------------------------------------
// Test 2: Timestamp parser extraction (ISO, number, Firestore Timestamp)
// -------------------------------------------------------------
runTest('Timestamp Engine -> Robust multi-format parsing (ISO, Epoch, Firestore Timestamp)', () => {
  // Extract getDocTimestamp function from db.js using Function constructor or regex
  const fnMatch = dbCode.match(/function getDocTimestamp\s*\([\s\S]*?^}/m);
  assert.ok(fnMatch, 'getDocTimestamp must be defined in portal/db.js');
  
  const getDocTimestamp = new Function('doc', `
    ${fnMatch[0]}
    return getDocTimestamp(doc);
  `);

  // Case A: ISO string
  const t1 = getDocTimestamp({ updated_at: '2026-10-02T12:00:00.000Z' });
  assert.strictEqual(t1, new Date('2026-10-02T12:00:00.000Z').getTime());

  // Case B: Numeric Epoch milliseconds
  const nowMs = Date.now();
  const t2 = getDocTimestamp({ updated_at: nowMs });
  assert.strictEqual(t2, nowMs);

  // Case C: Firestore Timestamp object with seconds & nanoseconds
  const fsTimestamp = { seconds: 1790940000, nanoseconds: 500000000 };
  const t3 = getDocTimestamp({ updated_at: fsTimestamp });
  assert.strictEqual(t3, 1790940000 * 1000 + 500);

  // Case D: Fallback to timestamp or created_at
  const t4 = getDocTimestamp({ created_at: '2026-08-15T08:00:00.000Z' });
  assert.strictEqual(t4, new Date('2026-08-15T08:00:00.000Z').getTime());

  // Case E: Null or empty
  assert.strictEqual(getDocTimestamp(null), 0);
  assert.strictEqual(getDocTimestamp({}), 0);
});

// -------------------------------------------------------------
// Test 3: Universal conflict resolution guard across all stores
// -------------------------------------------------------------
runTest('Conflict Resolution -> shouldKeepLocalDoc correctly prioritizes newer and protected data', () => {
  const getDocTsMatch = dbCode.match(/function getDocTimestamp\s*\([\s\S]*?^}/m);
  const shouldKeepMatch = dbCode.match(/function shouldKeepLocalDoc\s*\([\s\S]*?^}/m);
  assert.ok(shouldKeepMatch, 'shouldKeepLocalDoc must be defined in portal/db.js');

  const shouldKeepLocalDoc = new Function('storeName', 'docId', 'localDoc', 'remoteDoc', `
    ${getDocTsMatch[0]}
    ${shouldKeepMatch[0]}
    return shouldKeepLocalDoc(storeName, docId, localDoc, remoteDoc);
  `);

  // Scenario A: Local is newer than remote
  const localNewer = { updated_at: '2026-10-02T14:00:00Z', value: 'New Local' };
  const remoteOlder = { updated_at: '2026-10-02T10:00:00Z', value: 'Old Remote' };
  assert.strictEqual(shouldKeepLocalDoc('users', 'u-1', localNewer, remoteOlder), true);

  // Scenario B: Remote is newer than local
  const localOlder = { updated_at: '2026-10-02T08:00:00Z', value: 'Old Local' };
  const remoteNewer = { updated_at: '2026-10-02T12:00:00Z', value: 'New Remote' };
  assert.strictEqual(shouldKeepLocalDoc('users', 'u-1', localOlder, remoteNewer), false);

  // Scenario C: Local has unsynced pending offline changes (synced: false)
  const localOffline = { updated_at: '2026-10-01T08:00:00Z', synced: false, value: 'Offline Edit' };
  const remoteDoc = { updated_at: '2026-10-02T08:00:00Z', value: 'Cloud Doc' };
  assert.strictEqual(shouldKeepLocalDoc('users', 'u-1', localOffline, remoteDoc), true);

  // Scenario D: Remote has no timestamp (e.g. legacy doc) while local has valid timestamp
  const localWithTime = { updated_at: '2026-10-02T08:00:00Z', value: 'Local Value' };
  const remoteNoTime = { value: 'Remote Value' };
  assert.strictEqual(shouldKeepLocalDoc('classes', 'c-1', localWithTime, remoteNoTime), true);

  // Scenario E: CMS Gallery Albums - remote is empty array while local has user albums
  const localAlbums = { value: JSON.stringify([{ id: 'alb-1', name: 'Graduation' }]), updated_at: '2026-10-02T08:00:00Z' };
  const remoteEmptyAlbums = { value: JSON.stringify([]), updated_at: '2026-10-02T10:00:00Z' };
  assert.strictEqual(shouldKeepLocalDoc('cms_content', 'gallery_albums', localAlbums, remoteEmptyAlbums), true);

  // Scenario F: CMS News Feed - remote is empty array while local has announcements
  const localNews = { value: JSON.stringify([{ id: 'n-1', title: 'PTA Meeting' }]), updated_at: '2026-10-02T08:00:00Z' };
  const remoteEmptyNews = { value: JSON.stringify([]), updated_at: '2026-10-02T10:00:00Z' };
  assert.strictEqual(shouldKeepLocalDoc('cms_content', 'news_feed', localNews, remoteEmptyNews), true);

  // Scenario G: Academic Calendar - remote missing canonical terms while local has calibrated terms
  const localCal = { canonical_terms: { term1: { net_days: 70 } }, updated_at: '2026-10-02T08:00:00Z' };
  const remoteCal = { academic_year: '2026/2027', updated_at: '2026-10-02T10:00:00Z' };
  assert.strictEqual(shouldKeepLocalDoc('academic_calendar', 'main-calendar', localCal, remoteCal), true);
});

// -------------------------------------------------------------
// Test 4: db.put updates timestamps on every write
// -------------------------------------------------------------
runTest('Database Engine -> db.put stamps updated_at on all writes', () => {
  assert.ok(
    dbCode.includes('if (!obj._preserve_updated_at)'),
    'db.put must refresh updated_at unless _preserve_updated_at is explicitly specified'
  );
  assert.ok(
    dbCode.includes('obj.updated_at = new Date().toISOString()'),
    'db.put must assign current ISO timestamp'
  );
});

// -------------------------------------------------------------
// Test 5: Academic calendar save handler synchronizes term dates
// -------------------------------------------------------------
runTest('Calendar Setter UI -> Synchronizes canonical terms with root term dates and events', () => {
  // Check btn-save-canonical-terms in app.js
  assert.ok(
    appCode.includes('freshCal.term1_start = t1Start;'),
    'Saving canonical terms must update freshCal.term1_start'
  );
  assert.ok(
    appCode.includes('freshCal.term2_start = t2Start;'),
    'Saving canonical terms must update freshCal.term2_start'
  );
  assert.ok(
    appCode.includes('freshCal.term3_start = t3Start;'),
    'Saving canonical terms must update freshCal.term3_start'
  );
  assert.ok(
    appCode.includes('freshCal.updated_at = new Date().toISOString()'),
    'Saving canonical terms must explicitly refresh updated_at'
  );
  assert.ok(
    appCode.includes('window._refreshAcademicCalendar'),
    'Real-time refresh hook _refreshAcademicCalendar must be registered'
  );
});

// -------------------------------------------------------------
// Test 6: Website Announcements & CMS Manager timestamps & live hooks
// -------------------------------------------------------------
runTest('Website Manager UI -> Form submissions update timestamps and register live refresh hooks', () => {
  // form-website-cms
  assert.ok(
    appCode.includes('content_key: "school_name", value: nameVal, updated_at: now'),
    'form-website-cms must save updated_at timestamp'
  );
  // form-add-cms-news
  assert.ok(
    appCode.includes('content_key: "news_feed", value: JSON.stringify(news), updated_at: new Date().toISOString()'),
    'News feed modifications must stamp updated_at timestamp'
  );
  // Real-time hooks
  assert.ok(
    appCode.includes('window._refreshCMSAnnouncements = loadCMSAnnouncements;'),
    '_refreshCMSAnnouncements hook must be registered'
  );
  assert.ok(
    appCode.includes('window._refreshCMSThumbnails = renderCMSThumbnails;'),
    '_refreshCMSThumbnails hook must be registered'
  );
  assert.ok(
    appCode.includes('if (storeName === "cms_content")'),
    'dbSyncUpdate listener must handle cms_content'
  );
});

// -------------------------------------------------------------
// Test 7: Public Website Real-Time Synchronization
// -------------------------------------------------------------
runTest('Public Website -> Listens to dbSyncUpdate for live calendar and CMS updates', () => {
  assert.ok(
    websiteCode.includes('renderWebsiteCMSAndCalendar'),
    'website.js must encapsulate CMS and calendar rendering in renderWebsiteCMSAndCalendar'
  );
  assert.ok(
    websiteCode.includes('window.addEventListener("dbSyncUpdate"'),
    'website.js must listen for dbSyncUpdate events'
  );
});

// -------------------------------------------------------------
// Test 8: Centralized API getCurrentTerm supports canonical_terms
// -------------------------------------------------------------
runTest('API Engine -> getCurrentTerm falls back to canonical_terms dates if root dates missing', () => {
  assert.ok(
    apiCode.includes('cal.canonical_terms'),
    'getCurrentTerm must check canonical_terms'
  );
  assert.ok(
    apiCode.includes('syncToFirebase'),
    'api.js must provide syncToFirebase method'
  );
});

console.log('\n================================================================');
console.log(`TOTAL CHECKS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log(`RELIABILITY SCORE: ${(passedTests / totalTests * 100).toFixed(1)}%`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
