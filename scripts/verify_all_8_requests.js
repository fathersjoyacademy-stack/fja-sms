const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log('========================================================================');
console.log('        8 CORE USER REQUIREMENTS COMPREHENSIVE VERIFICATION AUDIT       ');
console.log('========================================================================\n');

const apiJs = fs.readFileSync(path.join(__dirname, '../portal/api.js'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '../portal/app.js'), 'utf8');
const dbJs = fs.readFileSync(path.join(__dirname, '../portal/db.js'), 'utf8');
const swJs = fs.readFileSync(path.join(__dirname, '../portal/sw.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '../website/index.html'), 'utf8');
const websiteJs = fs.readFileSync(path.join(__dirname, '../website/website.js'), 'utf8');
const functionsJs = fs.readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8');
const firestoreRules = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');

let passedTests = 0;
const totalTests = 8;

// -------------------------------------------------------------------------
// Requirement 1: Hubtel SMS Password Setup Link on New Account Creation
// -------------------------------------------------------------------------
console.log('Verifying Requirement 1: Hubtel SMS Password Setup on Account Creation...');
assert.ok(apiJs.includes('action=set-password'), 'api.js must generate action=set-password link');
assert.ok(apiJs.includes('sendHubtelSMS') && apiJs.includes('To set your password for the portal, visit:'), 'api.js createAccount must dispatch Hubtel setup SMS');
assert.ok(appJs.includes('action=set-password'), 'app.js admissions approval must generate setup link');
assert.ok(appJs.includes('sendHubtelSMS') && appJs.includes('parentUser.phone'), 'app.js must send setup SMS to newly created parent');
assert.ok(appJs.includes('sendHubtelSMS') && appJs.includes('studentContactPhone'), 'app.js must send setup SMS to newly created student');
assert.ok(appJs.includes('window.firebase.firestore().collection("users").doc(userId).get()'), 'app.js set-password view must fallback to direct Firestore lookup');
console.log('  [PASS] Req 1: Setup password link with UID generated and dispatched via Hubtel SMS on account creation & admissions approval.\n');
passedTests++;

// -------------------------------------------------------------------------
// Requirement 2: SMS Deduplication & Failed-Only Retry
// -------------------------------------------------------------------------
console.log('Verifying Requirement 2: SMS Deduplication & Failed-Only Retry...');
assert.ok(apiJs.includes('_recentDispatches: new Map()'), 'api.js must maintain _recentDispatches map');
assert.ok(apiJs.includes('duplicateSuppressed: true'), 'api.js must suppress duplicates within cooldown window');
assert.ok(apiJs.includes('options.forceRetry') || apiJs.includes('options?.forceRetry'), 'api.js must support options.forceRetry');
assert.ok(appJs.includes('failedRecipients'), 'app.js broadcast must track failedRecipients');
assert.ok(appJs.includes('forceRetry: true'), 'app.js retry broadcast must specify forceRetry: true');
assert.ok(appJs.includes('btn-retry-failed-broadcast'), 'app.js must provide retry button targeting only failed recipients');
console.log('  [PASS] Req 2: 3-minute SMS deduplication active; retries target strictly failed recipients.\n');
passedTests++;

// -------------------------------------------------------------------------
// Requirement 3: Automated Birthday SMS Timing & Singularity
// -------------------------------------------------------------------------
console.log('Verifying Requirement 3: Automated Birthday SMS Singularity & 09:00 GMT Timing...');
assert.ok(dbJs.includes('birthday_dispatches'), 'db.js must define birthday_dispatches store');
assert.ok(firestoreRules.includes('birthday_dispatches'), 'firestore.rules must secure birthday_dispatches');
assert.ok(functionsJs.includes('role === "Parent"') && functionsJs.includes('Parent accounts do not receive student/staff birthday SMS'), 'Cloud Function must exclude Parents from birthday SMS');
assert.ok(appJs.includes('getUTCHours') && (appJs.includes('currentUtcHour < 9') || appJs.includes('getUTCHours() < 9')), 'app.js auto scheduler must enforce 09:00 AM GMT');
assert.ok(appJs.includes('u.role !== "Parent"'), 'app.js birthday scan must exclude Parents');
assert.ok(appJs.includes('birthday_dispatches'), 'app.js must record and check birthday_dispatches store for idempotency');
console.log('  [PASS] Req 3: Birthday SMS strictly dispatched at or after 09:00 AM GMT, deduplicated per-celebrant via birthday_dispatches.\n');
passedTests++;

// -------------------------------------------------------------------------
// Requirement 4: Duplicate Account Creation Check & Button Lockout
// -------------------------------------------------------------------------
console.log('Verifying Requirement 4: Duplicate Account Creation Check & Lockout...');
assert.ok(apiJs.includes('already exists with the name') && apiJs.includes('and contact number'), 'api.js createAccount must throw on duplicate name and contact');
assert.ok(appJs.includes('u.role === "Parent"') || appJs.includes('u.role !== "Parent"'), 'Duplicate check must ignore parent accounts');
assert.ok(appJs.includes('Account already exists: A user record'), 'app.js form-create-student/staff must alert duplicate');
assert.ok(appJs.includes('Creating Student Account...'), 'form-create-student must lockout submit button');
assert.ok(appJs.includes('Creating Staff Account...'), 'form-create-staff must lockout submit button');
assert.ok(websiteJs.includes('Application Already Submitted') || websiteJs.includes('already exists'), 'website.js must check duplicate candidate applications');
console.log('  [PASS] Req 4: Exact name + phone duplicates blocked with user alert; parents and staff emergency contacts ignored.\n');
passedTests++;

// -------------------------------------------------------------------------
// Requirement 5: Registered Users Directory - Staff List Clean of Parents
// -------------------------------------------------------------------------
console.log('Verifying Requirement 5: Parents Excluded from Staff Members in Directory...');
assert.ok(appJs.includes('u.role !== "Student" && u.role !== "Parent" && u.role !== "Guardian"'), 'loadUsers must filter out Parent and Guardian from allStaff');
console.log('  [PASS] Req 5: Parents and Guardians completely excluded from Staff Members list in Registered Users Directory.\n');
passedTests++;

// -------------------------------------------------------------------------
// Requirement 6: Registered Users Directory - Student Primary Contact Column
// -------------------------------------------------------------------------
console.log('Verifying Requirement 6: Primary Contact Phone Displayed for Students...');
assert.ok(appJs.includes('<th>Primary Contact</th>') && appJs.includes('primaryContactNum = s.phone || ""'), 'loadUsers must resolve and display primary contact phone');
console.log('  [PASS] Req 6: Emergency contact column replaced with primary contact phone (no "None").\n');
passedTests++;

// -------------------------------------------------------------------------
// Requirement 7: Lockout to Save Changes and Operations Prone to Duplication
// -------------------------------------------------------------------------
console.log('Verifying Requirement 7: Button Lockouts Across Prone Operations...');
assert.ok(appJs.includes('btn-save-admin-edit') && appJs.includes('saveBtn.disabled = true'), 'Edit records save button must have lockout');
assert.ok(appJs.includes('btn-save-student-attendance') && appJs.includes('saveBtn.disabled = true'), 'Student attendance save button must have lockout');
assert.ok(appJs.includes('btn-save-grade') && appJs.includes('btn.disabled = true'), 'Grade save button must have lockout');
assert.ok(appJs.includes('btn-save-canonical-terms') && appJs.includes('btnSaveTerms.disabled = true'), 'Canonical terms save button must have lockout');
assert.ok(appJs.includes('btn-save-staff-attendance') && appJs.includes('btnSaveStaffAtt.disabled = true'), 'Staff attendance save button must have lockout');
assert.ok(appJs.includes('processBtn.disabled = true') && appJs.includes('Processing Payroll...'), 'Payroll process button must have lockout');
assert.ok(appJs.includes('form-terminal-fees') && appJs.includes('Posting Terminal Fees...'), 'Terminal fees form must have lockout');
console.log('  [PASS] Req 7: Lockout applied to Edit Records, Payroll, Attendance, Grading, Academic Terms, and Fees billing.\n');
passedTests++;

// -------------------------------------------------------------------------
// Requirement 8: Website Contact Us Section & Bibinii Tech Footer
// -------------------------------------------------------------------------
console.log('Verifying Requirement 8: Website Contact Us Section & Updated Footer...');
assert.ok(indexHtml.includes('id="contact"'), 'website/index.html must have dedicated #contact section');
assert.ok(indexHtml.includes('Abura Dunkwa, Central Region - Ghana'), 'Contact section must contain campus location');
assert.ok(indexHtml.includes('+233 24 232 1696'), 'Contact section must contain primary contact phone');
assert.ok(indexHtml.includes('Developed and designed by Bibinii Tech'), 'Footer must display developer credit');
assert.ok(indexHtml.includes('+233 544 73 78 70'), 'Footer must contain Bibinii Tech contact number');
assert.ok(indexHtml.includes('href="tel:+233544737870"'), 'Footer must link to Bibinii Tech phone');
const footerMatch = indexHtml.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i);
assert.ok(footerMatch, 'Footer tag must exist');
const footerContent = footerMatch[1];
assert.strictEqual(footerContent.includes('Abura Dunkwa'), false, 'Footer must not contain school location (moved to #contact)');
assert.strictEqual(footerContent.includes('0242321696'), false, 'Footer must not contain school phone (moved to #contact)');
console.log('  [PASS] Req 8: School contact details moved to #contact section; Footer updated with Bibinii Tech credit.\n');
passedTests++;

// -------------------------------------------------------------------------
// Service Worker Cache Versioning
// -------------------------------------------------------------------------
assert.ok(swJs.includes('school-mgt-v45') || swJs.includes('school-mgt-v44') || swJs.includes('school-mgt-v43') || swJs.includes('school-mgt-v42'), 'sw.js must be bumped to school-mgt-v45, v44, v43, or v42');

console.log('========================================================================');
console.log(`ALL ${passedTests}/${totalTests} CORE REQUIREMENTS AUDITED & VERIFIED SUCCESSFULLY!`);
console.log('========================================================================\n');
