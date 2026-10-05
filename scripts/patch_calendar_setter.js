const fs = require('fs');
const assert = require('assert');

console.log('--- Applying Calendar Setter & Academic Calendar Fixes ---');

// ============================================================================
// 1. PATCH portal/db.js
// ============================================================================
let dbJs = fs.readFileSync('portal/db.js', 'utf8');

// 1.1 Add academic_calendar to REALTIME_STORES
assert.ok(dbJs.includes('const REALTIME_STORES = ["portal_messages", "notifications", "broadcast_requests", "cms_content"];'), 'db.js must have REALTIME_STORES declaration');
dbJs = dbJs.replace(
  'const REALTIME_STORES = ["portal_messages", "notifications", "broadcast_requests", "cms_content"];',
  'const REALTIME_STORES = ["portal_messages", "notifications", "broadcast_requests", "cms_content", "academic_calendar"];'
);

// 1.2 Update shouldKeepLocalDoc for academic_calendar so newer remote data with events is not rejected
const oldKeepCalendar = `  } else if (storeName === "academic_calendar" && docId === "main-calendar") {
      if (localDoc.canonical_terms && !remoteDoc.canonical_terms) return true;
      if (Array.isArray(localDoc.events) && localDoc.events.length > 0 && (!Array.isArray(remoteDoc.events) || remoteDoc.events.length === 0)) return true;
    }`;

const newKeepCalendar = `  } else if (storeName === "academic_calendar" && docId === "main-calendar") {
      if (localDoc.canonical_terms && !remoteDoc.canonical_terms && (!Array.isArray(remoteDoc.events) || remoteDoc.events.length === 0)) return true;
      if (Array.isArray(localDoc.events) && localDoc.events.length > 0 && (!Array.isArray(remoteDoc.events) || remoteDoc.events.length === 0)) return true;
    }`;

assert.ok(dbJs.includes(oldKeepCalendar), 'db.js must have oldKeepCalendar');
dbJs = dbJs.replace(oldKeepCalendar, newKeepCalendar);

// Also replace the second occurrence at timestamps are equal
const oldKeepCalendarEq = `  } else if (storeName === "academic_calendar" && docId === "main-calendar") {
    if (localDoc.canonical_terms && !remoteDoc.canonical_terms) return true;
    if (Array.isArray(localDoc.events) && localDoc.events.length > 0 && (!Array.isArray(remoteDoc.events) || remoteDoc.events.length === 0)) return true;
  }`;

const newKeepCalendarEq = `  } else if (storeName === "academic_calendar" && docId === "main-calendar") {
    if (localDoc.canonical_terms && !remoteDoc.canonical_terms && (!Array.isArray(remoteDoc.events) || remoteDoc.events.length === 0)) return true;
    if (Array.isArray(localDoc.events) && localDoc.events.length > 0 && (!Array.isArray(remoteDoc.events) || remoteDoc.events.length === 0)) return true;
  }`;

assert.ok(dbJs.includes(oldKeepCalendarEq), 'db.js must have oldKeepCalendarEq');
dbJs = dbJs.replace(oldKeepCalendarEq, newKeepCalendarEq);

// 1.3 Update sanitizeIncomingDoc to synthesize canonical_terms if missing on incoming academic_calendar doc
const oldSanitizeCalendar = `  } else if (storeName === "academic_calendar" && docId === "main-calendar" && Array.isArray(docData.events)) {
    docData.events = docData.events.filter(e =>
      e.id !== "ev-term1" &&
      e.id !== "ev-term2" &&
      e.id !== "ev-term3" &&
      e.id !== "ev-pta" &&
      e.id !== "ev-midterm" &&
      e.id !== "ev-exam" &&
      !(e.name && e.name.includes("2025/2026"))
    );
  }`;

const newSanitizeCalendar = `  } else if (storeName === "academic_calendar" && docId === "main-calendar") {
    if (Array.isArray(docData.events)) {
      docData.events = docData.events.filter(e =>
        e.id !== "ev-term1" &&
        e.id !== "ev-term2" &&
        e.id !== "ev-term3" &&
        e.id !== "ev-pta" &&
        e.id !== "ev-midterm" &&
        e.id !== "ev-exam" &&
        !(e.name && e.name.includes("2025/2026"))
      );
    }
    if (!docData.canonical_terms) {
      docData.canonical_terms = {
        academic_year: docData.academic_year || "2026/2027",
        term1: {
          start_date: docData.term1_start || "2026-09-08",
          end_date: docData.term1_end || "2026-12-17",
          midterm_start: docData.midterm_start || "2026-10-19",
          midterm_end: docData.midterm_end || "2026-10-23",
          public_holidays: 2,
          net_days: 70
        },
        term2: {
          start_date: docData.term2_start || "2027-01-05",
          end_date: docData.term2_end || "2027-03-25",
          midterm_start: "2027-02-15",
          midterm_end: "2027-02-19",
          public_holidays: 3,
          net_days: 55
        },
        term3: {
          start_date: docData.term3_start || "2027-04-20",
          end_date: docData.term3_end || "2027-07-22",
          midterm_start: "2027-06-07",
          midterm_end: "2027-06-11",
          public_holidays: 2,
          net_days: 65
        }
      };
    }
  }`;

assert.ok(dbJs.includes(oldSanitizeCalendar), 'db.js must have oldSanitizeCalendar');
dbJs = dbJs.replace(oldSanitizeCalendar, newSanitizeCalendar);

// 1.4 Do not filter academic_calendar by lastSync so single doc is never skipped
assert.ok(dbJs.includes('if (lastSync) {\n        initialQuery = initialQuery.where("updated_at", ">", lastSync);\n      }'), 'db.js must have delta query check');
dbJs = dbJs.replace(
  'if (lastSync) {\n        initialQuery = initialQuery.where("updated_at", ">", lastSync);\n      }',
  'if (lastSync && storeName !== "academic_calendar") {\n        initialQuery = initialQuery.where("updated_at", ">", lastSync);\n      }'
);

// 1.5 Update seedCalendar in seedMockData to include canonical_terms and default events
const oldSeedCalendar = `      const seedCalendar = {
        calendar_id: "main-calendar",
        academic_year: "2026/2027",
        active_term: "Term 1",
        term1_start: "2026-09-08",
        term1_end: "2026-12-17",
        term2_start: "2027-01-05",
        term2_end: "2027-03-25",
        term3_start: "2027-04-20",
        term3_end: "2027-07-22",
        previous_academic_year: "2025/2026",
        prev_term1_start: "2025-09-02",
        prev_term1_end: "2025-12-18",
        prev_term2_start: "2026-01-08",
        prev_term2_end: "2026-04-01",
        prev_term3_start: "2026-04-21",
        prev_term3_end: "2026-07-31",
        midterm_start: "2026-10-19",
        midterm_end: "2026-10-23",
        exam_start: "2026-12-01",
        exam_end: "2026-12-10",
        pta_date: "2026-10-17"
      };`;

const newSeedCalendar = `      const seedCalendar = {
        calendar_id: "main-calendar",
        academic_year: "2026/2027",
        active_term: "Term 1",
        term1_start: "2026-09-08",
        term1_end: "2026-12-17",
        term2_start: "2027-01-05",
        term2_end: "2027-03-25",
        term3_start: "2027-04-20",
        term3_end: "2027-07-22",
        previous_academic_year: "2025/2026",
        prev_term1_start: "2025-09-02",
        prev_term1_end: "2025-12-18",
        prev_term2_start: "2026-01-08",
        prev_term2_end: "2026-04-01",
        prev_term3_start: "2026-04-21",
        prev_term3_end: "2026-07-31",
        midterm_start: "2026-10-19",
        midterm_end: "2026-10-23",
        exam_start: "2026-12-01",
        exam_end: "2026-12-10",
        pta_date: "2026-10-17",
        canonical_terms: {
          academic_year: "2026/2027",
          term1: { start_date: "2026-09-08", end_date: "2026-12-17", midterm_start: "2026-10-19", midterm_end: "2026-10-23", public_holidays: 2, net_days: 70 },
          term2: { start_date: "2027-01-05", end_date: "2027-03-25", midterm_start: "2027-02-15", midterm_end: "2027-02-19", public_holidays: 3, net_days: 55 },
          term3: { start_date: "2027-04-20", end_date: "2027-07-22", midterm_start: "2027-06-07", midterm_end: "2027-06-11", public_holidays: 2, net_days: 65 }
        },
        events: [
          { id: "ev-term1-canonical", name: "2026/2027 1st Academic Term", start_date: "2026-09-08", end_date: "2026-12-17", time: "", notes: "" },
          { id: "ev-term2-canonical", name: "2026/2027 2nd Academic Term", start_date: "2027-01-05", end_date: "2027-03-25", time: "", notes: "" },
          { id: "ev-term3-canonical", name: "2026/2027 3rd Academic Term", start_date: "2027-04-20", end_date: "2027-07-22", time: "", notes: "" }
        ]
      };`;

assert.ok(dbJs.includes(oldSeedCalendar), 'db.js must have oldSeedCalendar');
dbJs = dbJs.replace(oldSeedCalendar, newSeedCalendar);

// 1.6 In seedMockData else branch, use putLocal so seed inspection never stamps updated_at
const oldElseSeedCal = `          if (updated) {
            await db.put("academic_calendar", cal);
          }`;
const newElseSeedCal = `          if (updated) {
            await db.putLocal("academic_calendar", cal);
          }`;
assert.ok(dbJs.includes(oldElseSeedCal), 'db.js must have oldElseSeedCal');
dbJs = dbJs.replace(oldElseSeedCal, newElseSeedCal);

// 1.7 Export shouldKeepLocalDoc to window
if (!dbJs.includes('window.shouldKeepLocalDoc = shouldKeepLocalDoc;')) {
  dbJs = dbJs.replace(
    'window.db = db;\nwindow.initDB = initDB;',
    'window.db = db;\nwindow.initDB = initDB;\nwindow.shouldKeepLocalDoc = shouldKeepLocalDoc;'
  );
}

fs.writeFileSync('portal/db.js', dbJs, 'utf8');
console.log('  [PASS] portal/db.js updated successfully.');

// ============================================================================
// 2. PATCH website/website.js
// ============================================================================
let webJs = fs.readFileSync('website/website.js', 'utf8');

// 2.1 Add active direct Firestore fetch in renderWebsiteCMSAndCalendar and fallback events synthesis
const oldWebRenderCal = `    // Render Academic Calendar & Events on the website (Vertical & Center Aligned)
    const calendarKey = await window.db.get("academic_calendar", "main-calendar");
    const eventsContainer = document.getElementById("website-calendar-events-container");
    
    if (eventsContainer) {
      let events = (calendarKey && Array.isArray(calendarKey.events)) ? [...calendarKey.events] : [];`;

const newWebRenderCal = `    // Fresh pull for academic calendar from cloud Firestore to ensure multi-device synchronization
    if (window.firebase && firebase.apps.length > 0) {
      try {
        const calSnap = await firebase.firestore().collection("academic_calendar").doc("main-calendar").get();
        if (calSnap.exists) {
          const remoteCal = calSnap.data();
          const localCal = await window.db.get("academic_calendar", "main-calendar");
          const keepLocal = typeof window.shouldKeepLocalDoc === "function" 
            ? window.shouldKeepLocalDoc("academic_calendar", "main-calendar", localCal, remoteCal) 
            : false;
          if (!keepLocal) {
            await window.db.putLocal("academic_calendar", remoteCal);
          }
        }
      } catch (calErr) {
        console.warn("Direct academic calendar cloud pull notice:", calErr);
      }
    }

    // Render Academic Calendar & Events on the website (Vertical & Center Aligned)
    const calendarKey = await window.db.get("academic_calendar", "main-calendar");
    const eventsContainer = document.getElementById("website-calendar-events-container");
    
    if (eventsContainer) {
      let events = (calendarKey && Array.isArray(calendarKey.events)) ? [...calendarKey.events] : [];

      // Fallback synthesis from canonical terms or root dates if events list is empty
      if (events.length === 0 && calendarKey) {
        const acadYear = calendarKey.academic_year || (calendarKey.canonical_terms && calendarKey.canonical_terms.academic_year) || "2026/2027";
        const ct = calendarKey.canonical_terms || {};
        const t1Start = calendarKey.term1_start || (ct.term1 && ct.term1.start_date);
        const t1End = calendarKey.term1_end || (ct.term1 && ct.term1.end_date);
        const t2Start = calendarKey.term2_start || (ct.term2 && ct.term2.start_date);
        const t2End = calendarKey.term2_end || (ct.term2 && ct.term2.end_date);
        const t3Start = calendarKey.term3_start || (ct.term3 && ct.term3.start_date);
        const t3End = calendarKey.term3_end || (ct.term3 && ct.term3.end_date);

        if (t1Start) events.push({ name: \`\${acadYear} 1st Academic Term\`, start_date: t1Start, end_date: t1End || t1Start });
        if (t2Start) events.push({ name: \`\${acadYear} 2nd Academic Term\`, start_date: t2Start, end_date: t2End || t2Start });
        if (t3Start) events.push({ name: \`\${acadYear} 3rd Academic Term\`, start_date: t3Start, end_date: t3End || t3Start });
      }`;

assert.ok(webJs.includes(oldWebRenderCal), 'website.js must have oldWebRenderCal');
webJs = webJs.replace(oldWebRenderCal, newWebRenderCal);

fs.writeFileSync('website/website.js', webJs, 'utf8');
console.log('  [PASS] website/website.js updated successfully.');

// ============================================================================
// 3. PATCH portal/app.js (Normalizing line breaks to LF first if needed)
// ============================================================================
let appJs = fs.readFileSync('portal/app.js', 'utf8');
const hadCRLF = appJs.includes('\r\n');
if (hadCRLF) {
  appJs = appJs.replace(/\r\n/g, '\n');
}

// 3.1 Fresh pull on renderAcademicCalendar
const oldAppRenderCal = `async function renderAcademicCalendar(container) {
  try {
    let cal = await window.db.get("academic_calendar", "main-calendar") || {};`;

const newAppRenderCal = `async function renderAcademicCalendar(container) {
  try {
    // Fresh pull for academic calendar from cloud Firestore to ensure multi-device sync
    if (window.firebase && firebase.apps.length > 0 && navigator.onLine) {
      try {
        const snap = await firebase.firestore().collection("academic_calendar").doc("main-calendar").get();
        if (snap.exists) {
          const remoteCal = snap.data();
          const localCal = await window.db.get("academic_calendar", "main-calendar");
          const keepLocal = typeof window.shouldKeepLocalDoc === "function"
            ? window.shouldKeepLocalDoc("academic_calendar", "main-calendar", localCal, remoteCal)
            : false;
          if (!keepLocal) {
            await window.db.putLocal("academic_calendar", remoteCal);
          }
        }
      } catch (calFetchErr) {
        console.warn("Direct calendar cloud fetch notice:", calFetchErr);
      }
    }

    let cal = await window.db.get("academic_calendar", "main-calendar") || {};`;

assert.ok(appJs.includes(oldAppRenderCal), 'app.js must have oldAppRenderCal');
appJs = appJs.replace(oldAppRenderCal, newAppRenderCal);

// 3.2 Update form inputs date fallbacks
const oldT1Start = `value="\${ct.term1.start_date || '2026-01-05'}"`;
const newT1Start = `value="\${ct.term1.start_date || cal.term1_start || '2026-09-08'}"`;
assert.ok(appJs.includes(oldT1Start), 'app.js must have oldT1Start');
appJs = appJs.replace(oldT1Start, newT1Start);

const oldT1End = `value="\${ct.term1.end_date || '2026-04-15'}"`;
const newT1End = `value="\${ct.term1.end_date || cal.term1_end || '2026-12-17'}"`;
assert.ok(appJs.includes(oldT1End), 'app.js must have oldT1End');
appJs = appJs.replace(oldT1End, newT1End);

const oldT2Start = `value="\${ct.term2.start_date || '2026-05-04'}"`;
const newT2Start = `value="\${ct.term2.start_date || cal.term2_start || '2027-01-05'}"`;
assert.ok(appJs.includes(oldT2Start), 'app.js must have oldT2Start');
appJs = appJs.replace(oldT2Start, newT2Start);

const oldT2End = `value="\${ct.term2.end_date || '2026-07-31'}"`;
const newT2End = `value="\${ct.term2.end_date || cal.term2_end || '2027-03-25'}"`;
assert.ok(appJs.includes(oldT2End), 'app.js must have oldT2End');
appJs = appJs.replace(oldT2End, newT2End);

const oldT3Start = `value="\${ct.term3.start_date || '2026-08-03'}"`;
const newT3Start = `value="\${ct.term3.start_date || cal.term3_start || '2027-04-20'}"`;
assert.ok(appJs.includes(oldT3Start), 'app.js must have oldT3Start');
appJs = appJs.replace(oldT3Start, newT3Start);

const oldT3End = `value="\${ct.term3.end_date || '2026-12-11'}"`;
const newT3End = `value="\${ct.term3.end_date || cal.term3_end || '2027-07-22'}"`;
assert.ok(appJs.includes(oldT3End), 'app.js must have oldT3End');
appJs = appJs.replace(oldT3End, newT3End);

// 3.3 Robust upsert in btn-save-canonical-terms
const oldSyncCanonical = `          // Synchronize matching events in events list if present
          if (Array.isArray(freshCal.events)) {
            const e1 = freshCal.events.find(e => /term\\s*1/i.test(e.name));
            if (e1) { e1.start_date = t1Start; e1.end_date = t1End; }
            const e2 = freshCal.events.find(e => /term\\s*2/i.test(e.name));
            if (e2) { e2.start_date = t2Start; e2.end_date = t2End; }
            const e3 = freshCal.events.find(e => /term\\s*3/i.test(e.name));
            if (e3) { e3.start_date = t3Start; e3.end_date = t3End; }
          }

          freshCal.calendar_id = "main-calendar";
          freshCal.updated_at = new Date().toISOString();
          await window.db.put("academic_calendar", freshCal);
          await initAcademicCalendarCache();

          if (window.api && typeof window.api.syncToFirebase === "function") {
            window.api.syncToFirebase("academic_calendar", freshCal).catch(() => {});
          }

          refreshCanonicalTermBadges();
          showToast("Canonical Academic Terms saved and attendance days calibrated successfully!", "success");`;

const newSyncCanonical = `          if (!Array.isArray(freshCal.events)) {
            freshCal.events = [];
          }

          // Robust matcher for canonical terms
          const isTerm1 = ev => /((\\b1st\\b|\\bfirst\\b|\\bterm\\s*1\\b|\\b1\\s*term\\b).*academic\\s*term|academic\\s*term.*(\\b1st\\b|\\bfirst\\b|\\bterm\\s*1\\b)|\\bterm\\s*1\\b|\\b1st\\s*term\\b|\\bfirst\\s*term\\b)/i.test(ev.name);
          const isTerm2 = ev => /((\\b2nd\\b|\\bsecond\\b|\\bterm\\s*2\\b|\\b2\\s*term\\b).*academic\\s*term|academic\\s*term.*(\\b2nd\\b|\\bsecond\\b|\\bterm\\s*2\\b)|\\bterm\\s*2\\b|\\b2nd\\s*term\\b|\\bsecond\\s*term\\b)/i.test(ev.name);
          const isTerm3 = ev => /((\\b3rd\\b|\\bthird\\b|\\bterm\\s*3\\b|\\b3\\s*term\\b).*academic\\s*term|academic\\s*term.*(\\b3rd\\b|\\bthird\\b|\\bterm\\s*3\\b)|\\bterm\\s*3\\b|\\b3rd\\s*term\\b|\\bthird\\s*term\\b)/i.test(ev.name);

          // Synchronize or create Term 1 event
          const e1 = freshCal.events.find(isTerm1);
          if (e1) {
            e1.name = \`\${acadYear} 1st Academic Term\`;
            e1.start_date = t1Start;
            e1.end_date = t1End;
          } else {
            freshCal.events.push({
              id: "ev-" + Date.now() + "-t1",
              name: \`\${acadYear} 1st Academic Term\`,
              start_date: t1Start,
              end_date: t1End,
              time: "",
              notes: ""
            });
          }

          // Synchronize or create Term 2 event
          const e2 = freshCal.events.find(isTerm2);
          if (e2) {
            e2.name = \`\${acadYear} 2nd Academic Term\`;
            e2.start_date = t2Start;
            e2.end_date = t2End;
          } else {
            freshCal.events.push({
              id: "ev-" + (Date.now() + 1) + "-t2",
              name: \`\${acadYear} 2nd Academic Term\`,
              start_date: t2Start,
              end_date: t2End,
              time: "",
              notes: ""
            });
          }

          // Synchronize or create Term 3 event
          const e3 = freshCal.events.find(isTerm3);
          if (e3) {
            e3.name = \`\${acadYear} 3rd Academic Term\`;
            e3.start_date = t3Start;
            e3.end_date = t3End;
          } else {
            freshCal.events.push({
              id: "ev-" + (Date.now() + 2) + "-t3",
              name: \`\${acadYear} 3rd Academic Term\`,
              start_date: t3Start,
              end_date: t3End,
              time: "",
              notes: ""
            });
          }

          freshCal.calendar_id = "main-calendar";
          freshCal.updated_at = new Date().toISOString();
          await window.db.put("academic_calendar", freshCal);
          await initAcademicCalendarCache();

          if (window.api && typeof window.api.syncToFirebase === "function") {
            window.api.syncToFirebase("academic_calendar", freshCal).catch(() => {});
          }
          if (window.firebase && firebase.apps.length > 0 && navigator.onLine) {
            try {
              await firebase.firestore().collection("academic_calendar").doc("main-calendar").set(freshCal);
            } catch (fsErr) {
              console.warn("Direct Firestore set for calendar notice:", fsErr);
            }
          }

          refreshCanonicalTermBadges();
          await loadEventsList();
          window.dispatchEvent(new CustomEvent("dbSyncUpdate", { detail: { storeName: "academic_calendar", docData: freshCal } }));
          showToast("Canonical Academic Terms saved and Scheduled Calendar Events updated successfully!", "success");`;

assert.ok(appJs.includes(oldSyncCanonical), 'app.js must have oldSyncCanonical');
appJs = appJs.replace(oldSyncCanonical, newSyncCanonical);

// 3.4 In form.onsubmit, update matching term dates and canonical terms and push to Firestore
const oldFormSyncCanonical = `          // Sync canonical term dates if term events exist
          const t1 = freshCal.events.find(e => /term\\s*1/i.test(e.name));
          if (t1) { freshCal.term1_start = t1.start_date; freshCal.term1_end = t1.end_date || t1.start_date; }
          const t2 = freshCal.events.find(e => /term\\s*2/i.test(e.name));
          if (t2) { freshCal.term2_start = t2.start_date; freshCal.term2_end = t2.end_date || t2.start_date; }
          const t3 = freshCal.events.find(e => /term\\s*3/i.test(e.name));
          if (t3) { freshCal.term3_start = t3.start_date; freshCal.term3_end = t3.end_date || t3.start_date; }

          freshCal.calendar_id = "main-calendar";
          freshCal.updated_at = new Date().toISOString();
          await window.db.put("academic_calendar", freshCal);
          await initAcademicCalendarCache();
          resetEventForm();
          await loadEventsList();`;

const newFormSyncCanonical = `          // Sync canonical term dates if term events exist
          const isTerm1Matcher = ev => /((\\b1st\\b|\\bfirst\\b|\\bterm\\s*1\\b|\\b1\\s*term\\b).*academic\\s*term|academic\\s*term.*(\\b1st\\b|\\bfirst\\b|\\bterm\\s*1\\b)|\\bterm\\s*1\\b|\\b1st\\s*term\\b|\\bfirst\\s*term\\b)/i.test(ev.name);
          const isTerm2Matcher = ev => /((\\b2nd\\b|\\bsecond\\b|\\bterm\\s*2\\b|\\b2\\s*term\\b).*academic\\s*term|academic\\s*term.*(\\b2nd\\b|\\bsecond\\b|\\bterm\\s*2\\b)|\\bterm\\s*2\\b|\\b2nd\\s*term\\b|\\bsecond\\s*term\\b)/i.test(ev.name);
          const isTerm3Matcher = ev => /((\\b3rd\\b|\\bthird\\b|\\bterm\\s*3\\b|\\b3\\s*term\\b).*academic\\s*term|academic\\s*term.*(\\b3rd\\b|\\bthird\\b|\\bterm\\s*3\\b)|\\bterm\\s*3\\b|\\b3rd\\s*term\\b|\\bthird\\s*term\\b)/i.test(ev.name);

          const t1 = freshCal.events.find(isTerm1Matcher);
          if (t1) {
            freshCal.term1_start = t1.start_date; freshCal.term1_end = t1.end_date || t1.start_date;
            if (freshCal.canonical_terms && freshCal.canonical_terms.term1) {
              freshCal.canonical_terms.term1.start_date = t1.start_date;
              freshCal.canonical_terms.term1.end_date = t1.end_date || t1.start_date;
            }
          }
          const t2 = freshCal.events.find(isTerm2Matcher);
          if (t2) {
            freshCal.term2_start = t2.start_date; freshCal.term2_end = t2.end_date || t2.start_date;
            if (freshCal.canonical_terms && freshCal.canonical_terms.term2) {
              freshCal.canonical_terms.term2.start_date = t2.start_date;
              freshCal.canonical_terms.term2.end_date = t2.end_date || t2.start_date;
            }
          }
          const t3 = freshCal.events.find(isTerm3Matcher);
          if (t3) {
            freshCal.term3_start = t3.start_date; freshCal.term3_end = t3.end_date || t3.start_date;
            if (freshCal.canonical_terms && freshCal.canonical_terms.term3) {
              freshCal.canonical_terms.term3.start_date = t3.start_date;
              freshCal.canonical_terms.term3.end_date = t3.end_date || t3.start_date;
            }
          }

          freshCal.calendar_id = "main-calendar";
          freshCal.updated_at = new Date().toISOString();
          await window.db.put("academic_calendar", freshCal);
          await initAcademicCalendarCache();
          if (window.firebase && firebase.apps.length > 0 && navigator.onLine) {
            try {
              await firebase.firestore().collection("academic_calendar").doc("main-calendar").set(freshCal);
            } catch (fsErr) {}
          }
          resetEventForm();
          await loadEventsList();
          window.dispatchEvent(new CustomEvent("dbSyncUpdate", { detail: { storeName: "academic_calendar", docData: freshCal } }));`;

assert.ok(appJs.includes(oldFormSyncCanonical), 'app.js must have oldFormSyncCanonical');
appJs = appJs.replace(oldFormSyncCanonical, newFormSyncCanonical);

// 3.5 In delete event button, direct sync to firestore and dispatch dbSyncUpdate
const oldDeleteSync = `              currentCal.calendar_id = "main-calendar";
              currentCal.updated_at = new Date().toISOString();
              await window.db.put("academic_calendar", currentCal);
              await initAcademicCalendarCache();
              showToast("Calendar event deleted successfully", "info");
              resetEventForm();
              await loadEventsList();`;

const newDeleteSync = `              currentCal.calendar_id = "main-calendar";
              currentCal.updated_at = new Date().toISOString();
              await window.db.put("academic_calendar", currentCal);
              await initAcademicCalendarCache();
              if (window.firebase && firebase.apps.length > 0 && navigator.onLine) {
                try {
                  await firebase.firestore().collection("academic_calendar").doc("main-calendar").set(currentCal);
                } catch (fsErr) {}
              }
              showToast("Calendar event deleted successfully", "info");
              resetEventForm();
              await loadEventsList();
              window.dispatchEvent(new CustomEvent("dbSyncUpdate", { detail: { storeName: "academic_calendar", docData: currentCal } }));`;

assert.ok(appJs.includes(oldDeleteSync), 'app.js must have oldDeleteSync');
appJs = appJs.replace(oldDeleteSync, newDeleteSync);

if (hadCRLF) {
  appJs = appJs.replace(/\n/g, '\r\n');
}
fs.writeFileSync('portal/app.js', appJs, 'utf8');
console.log('  [PASS] portal/app.js updated successfully.');

// ============================================================================
// 4. BUMP SERVICE WORKER VERSION in portal/sw.js
// ============================================================================
let swJs = fs.readFileSync('portal/sw.js', 'utf8');
swJs = swJs.replace('school-mgt-v48', 'school-mgt-v49');
fs.writeFileSync('portal/sw.js', swJs, 'utf8');
console.log('  [PASS] portal/sw.js bumped to school-mgt-v49.');

console.log('[ALL PATCHES APPLIED SUCCESSFULLY]');
