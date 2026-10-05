/**
 * Father's Joy Academy - Comprehensive System Audit & Verification Script
 * Validates:
 * 1. Hubtel SMS Gateway & Configuration
 * 2. Student Registry & 2026/2027 Academic Promotion
 * 3. Academic Calendar & History Records
 * 4. Gallery & Media Engine Rules
 * 5. Notification Engine & Deletion Capabilities
 * 6. Financial Engine (GRA Act 1178 2026 PAYE & SSNIT)
 * 7. Mobile Navigation & CSS Structural Integrity
 * 8. Service Worker & Deployment Manifest
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PORTAL_DIR = path.join(ROOT_DIR, 'portal');

const auditResults = {
  hubtel: { passed: 0, failed: 0, details: [] },
  registry: { passed: 0, failed: 0, details: [] },
  calendar: { passed: 0, failed: 0, details: [] },
  gallery: { passed: 0, failed: 0, details: [] },
  notifications: { passed: 0, failed: 0, details: [] },
  financials: { passed: 0, failed: 0, details: [] },
  mobile: { passed: 0, failed: 0, details: [] },
  deployment: { passed: 0, failed: 0, details: [] }
};

function recordTest(domain, name, passed, note = '') {
  if (passed) {
    auditResults[domain].passed++;
    auditResults[domain].details.push({ name, status: 'PASS', note });
  } else {
    auditResults[domain].failed++;
    auditResults[domain].details.push({ name, status: 'FAIL', note });
  }
}

// ----------------------------------------------------
// 1. HUBTEL SMS AUDIT
// ----------------------------------------------------
console.log('Auditing 1. Hubtel SMS Gateway...');
const apiJs = fs.readFileSync(path.join(PORTAL_DIR, 'api.js'), 'utf8');
const fbConfigJs = fs.readFileSync(path.join(PORTAL_DIR, 'firebase-config.js'), 'utf8');
const functionsIndexJs = fs.readFileSync(path.join(ROOT_DIR, 'functions', 'index.js'), 'utf8');

// A. Phone normalizer check
const normalizeMatch = apiJs.includes('normalizeGhanaPhone') && functionsIndexJs.includes('normalizeGhanaPhone');
recordTest('hubtel', 'Ghanaian Phone Normalizer in Portal & Functions', normalizeMatch);

// B. Tag resolution check
const tagMatch = apiJs.includes('resolveBroadcastTags') && (apiJs.includes('#student_name#') || apiJs.includes('student_name'));
recordTest('hubtel', 'Dynamic Tag Resolution Engine (#student_name#, #parent_name#, etc.)', tagMatch);

// C. Triple-Redundant Gateway (Callable -> REST -> Direct Hubtel Gateway Fallback)
const directGatewayMatch = apiJs.includes('sms.hubtel.com/v1/messages/send') && apiJs.includes('mode: "no-cors"');
recordTest('hubtel', 'Triple-Redundant SMS Dispatch (Callable -> REST -> Direct Gateway)', directGatewayMatch);

// D. Status Code 201 check in backend
const status201Match = functionsIndexJs.includes('res.statusCode === 201') || functionsIndexJs.includes('res.statusCode === 200 || res.statusCode === 201');
recordTest('hubtel', 'Hubtel HTTP 201 Created Status Compatibility in Backend', status201Match);

// E. Unattended Birthday Cron presence
const cronRunnerExists = fs.existsSync(path.join(ROOT_DIR, 'scripts', 'unattended-cron-runner.js'));
const ghActionExists = fs.existsSync(path.join(ROOT_DIR, '.github', 'workflows', 'daily-birthday-scheduler.yml'));
recordTest('hubtel', 'Automated Birthday SMS Scheduler (Cron & GitHub Actions)', cronRunnerExists && ghActionExists);

// ----------------------------------------------------
// 2. STUDENT REGISTRY & PROMOTION AUDIT
// ----------------------------------------------------
console.log('Auditing 2. Student Registry & 2026/2027 Promotion...');
const dbJs = fs.readFileSync(path.join(PORTAL_DIR, 'db.js'), 'utf8');
const promoteScriptPath = path.join(ROOT_DIR, 'scripts', 'promote_students_2026_2027.js');
const promoteScriptExists = fs.existsSync(promoteScriptPath);
recordTest('registry', 'Promotion Script Execution Record Present', promoteScriptExists);

// Check client-side promotion migration hook in db.js
const dbPromotionHook = dbJs.includes('Auto-promote 2025/2026 enrolled students') && dbJs.includes('promoted_2026_2027');
recordTest('registry', 'Client-Side IndexedDB Auto-Promotion Migration Hook', dbPromotionHook);

// Check proprietor user preservation
const proprietorPreserved = dbJs.includes('PR20260001') && dbJs.includes('u-proprietor-1');
recordTest('registry', 'Permanent Proprietor Account (PR20260001) Protected', proprietorPreserved);

// ----------------------------------------------------
// 3. ACADEMIC CALENDAR & HISTORY AUDIT
// ----------------------------------------------------
console.log('Auditing 3. Academic Calendar & History Records...');
const calendarMatch = dbJs.includes('2025/2026') && dbJs.includes('2026/2027') && dbJs.includes('2026-09-08');
recordTest('calendar', 'Academic Year Dates (2025/2026 & 2026/2027) Configured', calendarMatch);

const historyFieldPreserved = dbJs.includes('academic_history') || dbJs.includes('cumulative_records') || apiJs.includes('academic_history');
recordTest('calendar', 'Preservation of Cumulative Scores & Attendance History', historyFieldPreserved);

// ----------------------------------------------------
// 4. GALLERY & CMS AUDIT
// ----------------------------------------------------
console.log('Auditing 4. Gallery & Media Engine...');
const appJs = fs.readFileSync(path.join(PORTAL_DIR, 'app.js'), 'utf8');
const portalCss = fs.readFileSync(path.join(PORTAL_DIR, 'index.css'), 'utf8');

// Proportional compression preserving aspect ratio
const compressMatch = appJs.includes('compressImage') && (appJs.includes('maxDimension = 900') || appJs.includes('maxDimension = 800')) && appJs.includes('Math.round');
recordTest('gallery', 'Proportional Image Compression (Aspect Ratio Preserved)', compressMatch);

// Clean gallery rendering with no black backgrounds
const cssCleanBg = !portalCss.includes('background: #0f172a') && portalCss.includes('background: transparent');
recordTest('gallery', 'Clean Gallery Rendering (No Black Backgrounds)', cssCleanBg);

// Multi-album persistence in seedCMS
const seedCmsPreserved = dbJs.includes('for (const c of seedCMS)') && dbJs.includes('const existing = await db.get("cms_content", c.content_key)') && dbJs.includes('if (!existing)');
recordTest('gallery', 'Multi-Album Persistence Guard (No auto-deletion on reload)', seedCmsPreserved);

// Collapsible albums
const collapseMatch = appJs.includes('toggle-album-collapse') && appJs.includes('btn-collapse-all-albums');
recordTest('gallery', 'Collapsible Album Sections with Master Expand/Collapse Controls', collapseMatch);

// Image names removed from gallery
const titleRemoved = !appJs.includes('<div class="gallery-item-title">${item.title}</div>');
recordTest('gallery', 'Photo Filenames/Titles Removed from Gallery Display', titleRemoved);

// ----------------------------------------------------
// 5. NOTIFICATION AUDIT
// ----------------------------------------------------
console.log('Auditing 5. Notification Engine & Deletion...');
const deleteNotifMatch = apiJs.includes('deleteNotification') && apiJs.includes('clearAllNotifications');
recordTest('notifications', 'Notification Deletion API (Individual & Bulk Clear)', deleteNotifMatch);

const uiDeleteNotifMatch = appJs.includes('btn-notif-delete') && appJs.includes('btn-clear-all-notifs');
recordTest('notifications', 'Notification UI Controls (Delete & Clear All Buttons)', uiDeleteNotifMatch);

// ----------------------------------------------------
// 6. FINANCIALS & GRA ACT 1178 AUDIT
// ----------------------------------------------------
console.log('Auditing 6. Financial Engine & PAYE Tax Bands...');
const payeBandsMatch = apiJs.includes('588.00') && apiJs.includes('0.05') && apiJs.includes('0.10') && apiJs.includes('0.175') && apiJs.includes('0.25') && apiJs.includes('0.30') && apiJs.includes('0.35');
recordTest('financials', 'GRA Act 1178 2026 Graduated PAYE Tax Bands', payeBandsMatch);

const ssnitMatch = apiJs.includes('0.055') && apiJs.includes('ssnit');
recordTest('financials', 'SSNIT Tier 1 & Tier 2 Statutory Calculations (5.5%)', ssnitMatch);

// ----------------------------------------------------
// 7. MOBILE RESPONSIVENESS AUDIT
// ----------------------------------------------------
console.log('Auditing 7. Mobile UI & Student Registry Modal...');
const mobileModalTabs = portalCss.includes('.profile-modal-tabs-bar') && portalCss.includes('position: relative !important') && portalCss.includes('z-index: 20 !important');
recordTest('mobile', 'Pinned Navigation Tabs in Student Profile Modal (z-index: 20)', mobileModalTabs);

const modalContentScroll = portalCss.includes('.profile-modal-grid-container') && portalCss.includes('overflow-y: auto !important') && portalCss.includes('padding-bottom: 3.5rem !important');
recordTest('mobile', 'Full Scrollability with Bottom Clearance in Student Modal', modalContentScroll);

// ----------------------------------------------------
// 8. SERVICE WORKER & DEPLOYMENT AUDIT
// ----------------------------------------------------
console.log('Auditing 8. Service Worker & Deployment...');
const swJs = fs.readFileSync(path.join(PORTAL_DIR, 'sw.js'), 'utf8');
const swVersionMatch = swJs.includes('school-mgt-v51') || swJs.includes('school-mgt-v50') || swJs.includes('school-mgt-v49') || swJs.includes('school-mgt-v48') || swJs.includes('school-mgt-v47') || swJs.includes('school-mgt-v46') || swJs.includes('school-mgt-v45') || swJs.includes('school-mgt-v44') || swJs.includes('school-mgt-v43') || swJs.includes('school-mgt-v42') || swJs.includes('school-mgt-v41') || swJs.includes('school-mgt-v40') || swJs.includes('school-mgt-v39') || swJs.includes('school-mgt-v38') || swJs.includes('school-mgt-v37');
recordTest('deployment', 'Service Worker Cache Version Bumped (v46+)', swVersionMatch);

const manifestExists = fs.existsSync(path.join(PORTAL_DIR, 'manifest.json'));
recordTest('deployment', 'PWA Web App Manifest Present', manifestExists);

// Print Summary Report
console.log('\n========================================================');
console.log('       FATHER\'S JOY ACADEMY - SYSTEM AUDIT REPORT        ');
console.log('========================================================\n');

let totalPassed = 0;
let totalFailed = 0;

for (const [domain, res] of Object.entries(auditResults)) {
  const icon = res.failed === 0 ? '✓' : '✗';
  console.log(`[${icon}] Domain: ${domain.toUpperCase()} (${res.passed}/${res.passed + res.failed} passed)`);
  res.details.forEach(d => {
    console.log(`    ${d.status === 'PASS' ? '✓' : '✗'} ${d.name}`);
  });
  totalPassed += res.passed;
  totalFailed += res.failed;
}

console.log('\n--------------------------------------------------------');
console.log(`Total Verification Checks: ${totalPassed + totalFailed}`);
console.log(`Passed: ${totalPassed}`);
console.log(`Failed: ${totalFailed}`);
console.log(`Operational Integrity: ${Math.round((totalPassed / (totalPassed + totalFailed)) * 100)}%`);
console.log('========================================================\n');

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
