// db.js - IndexedDB Engine & Seeding System

const DB_NAME = "SchoolManagementDB";
const DB_VERSION = 13;
let dbInstance = null;

// Clean-slate synchronization barrier (Forces client browsers to wipe stale demo IndexedDB & sessions)
// WARNING: bumping this empties every client's local DB. Seeds are local-only (see SEED_TIMESTAMP), so this
// no longer overwrites cloud data, but it still forces a full re-download on every device.
const CLEAN_SLATE_EPOCH = "2026-10-03-clean-slate-v5";

// Read-only mode: the public website sets `window.FJA_READ_ONLY = true` before loading this file.
// Visitors are signed in anonymously (which Firestore rules treat as authenticated), so in this mode the
// client never seeds, migrates, heals or otherwise writes to Firestore, except for the public admissions
// intake collections below.
const DB_READ_ONLY = typeof window !== "undefined" && window.FJA_READ_ONLY === true;
const READ_ONLY_CLOUD_WRITABLE_STORES = ["users", "profiles", "notifications"];

function canWriteToCloud(storeName) {
  return !DB_READ_ONLY || READ_ONLY_CLOUD_WRITABLE_STORES.includes(storeName);
}

// Seed/default records are stored locally only and carry an epoch timestamp, so any real cloud record
// always wins conflict resolution. Seeds must NEVER be pushed to Firestore.
const SEED_TIMESTAMP = "1970-01-01T00:00:00.000Z";

// Legacy demo content identifiers. Match on exact IDs/titles only: substring matching (e.g. "news-1")
// previously matched every real announcement id ("news-" + Date.now() => "news-17...").
const LEGACY_NEWS_IDS = ["news-1", "news-2", "news-3"];
const LEGACY_NEWS_TITLES = ["New E-Library Portal Launched", "Upcoming PTA General Meeting", "Inter-Houses Athletics Competition"];
const LEGACY_EVENT_IDS = ["ev-term1", "ev-term2", "ev-term3", "ev-pta", "ev-midterm", "ev-exam"];
const LEGACY_ALBUM_IDS = ["alb-academics", "alb-sports", "alb-culture"];

function parseJsonArray(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}
function isLegacyNewsItem(item) {
  return !!item && (LEGACY_NEWS_IDS.includes(item.id) || LEGACY_NEWS_TITLES.includes(item.title));
}
function isLegacyCalendarEvent(ev) {
  return !!ev && LEGACY_EVENT_IDS.includes(ev.id);
}
function isLegacyAlbum(album) {
  return !!album && LEGACY_ALBUM_IDS.includes(album.id);
}
function isLegacyGalleryPhoto(photo) {
  return !!photo && (
    (typeof photo.id === "string" && photo.id.startsWith("img_demo_")) ||
    (typeof photo.url === "string" && photo.url.startsWith("data:image/svg+xml"))
  );
}

async function checkCleanSlateEpoch() {
  if (typeof localStorage !== "undefined" && localStorage.getItem("fja_clean_slate_epoch") !== CLEAN_SLATE_EPOCH) {
    console.log("Clean slate epoch mismatch detected. Purging local storage and stale IndexedDB...");
    localStorage.setItem("fja_clean_slate_epoch", CLEAN_SLATE_EPOCH);
    localStorage.removeItem("fja_session_token");
    localStorage.removeItem("fja_session_user");
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith("fja_last_sync_") || k.startsWith("fja_last_view_")) {
        localStorage.removeItem(k);
      }
    });
    if (typeof indexedDB !== "undefined") {
      if (dbInstance) {
        try { dbInstance.close(); } catch (e) {}
        dbInstance = null;
      }
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => {
          console.log("Stale local IndexedDB deleted successfully.");
          resolve();
        };
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    }
  }
}

// Initializer function
// Student Fee Entries Clean Slate Epoch (Option A: Purge fee invoices, payments & balances)
const FEE_CLEAN_SLATE_KEY = "fja_fee_clean_slate_epoch_2026_10_23";
const FEE_CLEAN_SLATE_TIMESTAMP = "2026-10-23T20:50:00.000Z";

function isStudentFeeTransaction(tx) {
  if (!tx) return false;
  if (tx.type === "PAYROLL" || tx.type === "OTHER_INCOME" || tx.type === "OTHER_EXPENSE" || tx.type === "RECEIVABLE" || tx.type === "PAYABLE") {
    if (!tx.student_id) return false;
  }
  if (tx.student_id) return true;
  if (tx.type === "FEE_PAYMENT" || tx.type === "PAYMENT" || tx.type === "INVOICE" || tx.type === "BILLING" || tx.type === "TUITION" || tx.type === "REVERSAL" || tx.type === "BAD_DEBT") {
    return true;
  }
  const txId = String(tx.transaction_id || "");
  const ref = String(tx.reference_no || "");
  if (txId.startsWith("t-bill") || txId.startsWith("t-invoice") || txId.startsWith("t-payment") || ref.includes("School Fees") || ref.includes("Tuition Fee") || ref.startsWith("GB-") || ref.startsWith("REV-") || ref.startsWith("BD-")) {
    return true;
  }
  return false;
}

const WIPE_MANUAL_BILLING_EPOCH = "fja_wipe_manual_billing_clean_slate_2026_10_25_v2";

// Wipe all student fee entries for clean manual entry as requested by user (Manual Trigger Only)
async function wipeAllStudentFeeEntries(force = false) {
  if (!force) {
    // Disabled automatically to prevent cross-device data desync
    return 0;
  }
  if (typeof localStorage === "undefined") return 0;

  try {
    const allTxs = await db.getAll("financial_transactions") || [];
    let count = 0;
    if (allTxs && allTxs.length > 0) {
      for (const tx of allTxs) {
        if (isStudentFeeTransaction(tx)) {
          await db.deleteLocal("financial_transactions", tx.transaction_id);
          count++;
          if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length > 0 && navigator.onLine) {
            try {
              firebase.firestore().collection("financial_transactions").doc(tx.transaction_id).delete().catch(() => {});
            } catch (e) {}
          }
        }
      }
    }
    localStorage.setItem(WIPE_MANUAL_BILLING_EPOCH, "completed");
    console.log(`[Manual Wipe] Wiped ${count} student fee entries upon administrative trigger.`);
    if (count > 0 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("dbSyncUpdate", { detail: { storeName: "financial_transactions" } }));
      if (typeof window._refreshFeeLedger === "function") {
        window._refreshFeeLedger();
      }
    }
    return count;
  } catch (err) {
    console.warn("wipeAllStudentFeeEntries notice:", err);
    return 0;
  }
}

async function initDB() {
  if (dbInstance) {
    return dbInstance;
  }

  await checkCleanSlateEpoch();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (e) => {
      console.error("IndexedDB open error:", e.target.error);
      reject(e.target.error);
    };

    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      // 1. Users Store
      if (!db.objectStoreNames.contains("users")) {
        const usersStore = db.createObjectStore("users", { keyPath: "user_id" });
        usersStore.createIndex("uid", "uid", { unique: true });
        usersStore.createIndex("phone", "phone", { unique: false });
        usersStore.createIndex("role", "role", { unique: false });
      }

      // 2. Profiles Store
      if (!db.objectStoreNames.contains("profiles")) {
        const profilesStore = db.createObjectStore("profiles", { keyPath: "profile_id" });
        profilesStore.createIndex("user_id", "user_id", { unique: true });
      }

      // 3. Classes Store
      if (!db.objectStoreNames.contains("classes")) {
        db.createObjectStore("classes", { keyPath: "class_id" });
      }

      // 4. Enrolments Store
      if (!db.objectStoreNames.contains("enrolments")) {
        const enrolStore = db.createObjectStore("enrolments", { keyPath: "enrolment_id" });
        enrolStore.createIndex("student_id", "student_id", { unique: false });
        enrolStore.createIndex("class_id", "class_id", { unique: false });
      }

      // 5. Class Discussion Wall Store
      if (!db.objectStoreNames.contains("class_posts")) {
        const postsStore = db.createObjectStore("class_posts", { keyPath: "post_id" });
        postsStore.createIndex("class_id", "class_id", { unique: false });
      }

      // 6. Financial Transactions Store
      if (!db.objectStoreNames.contains("financial_transactions")) {
        const transStore = db.createObjectStore("financial_transactions", { keyPath: "transaction_id" });
        transStore.createIndex("student_id", "student_id", { unique: false });
        transStore.createIndex("type", "type", { unique: false });
      }

      // 7. Cryptographic Append-only Audit Logs Store
      if (!db.objectStoreNames.contains("audit_logs")) {
        db.createObjectStore("audit_logs", { keyPath: "audit_id" });
      }

      // 8. Attendance Store
      if (!db.objectStoreNames.contains("attendance")) {
        const attendStore = db.createObjectStore("attendance", { keyPath: "attendance_id" });
        attendStore.createIndex("user_id", "user_id", { unique: false });
        attendStore.createIndex("date", "date", { unique: false });
      }

      // 9. Assignments Store
      if (!db.objectStoreNames.contains("assignments")) {
        const assignStore = db.createObjectStore("assignments", { keyPath: "assignment_id" });
        assignStore.createIndex("teacher_id", "teacher_id", { unique: false });
      }

      // 10. Student Scores Store
      if (!db.objectStoreNames.contains("student_scores")) {
        const scoresStore = db.createObjectStore("student_scores", { keyPath: "score_id" });
        scoresStore.createIndex("student_id", "student_id", { unique: false });
        scoresStore.createIndex("assignment_id", "assignment_id", { unique: false });
      }

      // 11. Lesson Notes Store
      if (!db.objectStoreNames.contains("lesson_notes")) {
        const notesStore = db.createObjectStore("lesson_notes", { keyPath: "note_id" });
        notesStore.createIndex("teacher_id", "teacher_id", { unique: false });
      }

      // 12. Pickup Guardians Store
      if (!db.objectStoreNames.contains("pickup_guardians")) {
        const guardStore = db.createObjectStore("pickup_guardians", { keyPath: "guardian_id" });
        guardStore.createIndex("student_id", "student_id", { unique: false });
      }

      // 13. CMS Content Store
      if (!db.objectStoreNames.contains("cms_content")) {
        db.createObjectStore("cms_content", { keyPath: "content_key" });
      }

      // 14. Staff Tasks Store
      if (!db.objectStoreNames.contains("staff_tasks")) {
        db.createObjectStore("staff_tasks", { keyPath: "task_id" });
      }

      // 15. Notifications Store
      if (!db.objectStoreNames.contains("notifications")) {
        db.createObjectStore("notifications", { keyPath: "notification_id" });
      }

      // 16. Sectional Reports Store
      if (!db.objectStoreNames.contains("sectional_reports")) {
        db.createObjectStore("sectional_reports", { keyPath: "report_id" });
      }

      // 17. Questionnaires Store
      if (!db.objectStoreNames.contains("questionnaires")) {
        db.createObjectStore("questionnaires", { keyPath: "questionnaire_id" });
      }

      // 18. Questionnaire Responses Store
      if (!db.objectStoreNames.contains("questionnaire_responses")) {
        db.createObjectStore("questionnaire_responses", { keyPath: "response_id" });
      }

      // 19. Bank Reconciliations Store
      if (!db.objectStoreNames.contains("bank_reconciliations")) {
        db.createObjectStore("bank_reconciliations", { keyPath: "recon_id" });
      }

      // 20. Prospectuses Store
      if (!db.objectStoreNames.contains("prospectuses")) {
        db.createObjectStore("prospectuses", { keyPath: "prospectus_id" });
      }

      // 21. Broadcast Requests Store
      if (!db.objectStoreNames.contains("broadcast_requests")) {
        db.createObjectStore("broadcast_requests", { keyPath: "request_id" });
      }

      // 22. Data Change Requests Store
      if (!db.objectStoreNames.contains("data_change_requests")) {
        db.createObjectStore("data_change_requests", { keyPath: "request_id" });
      }

      // 23. Academic Calendar Store
      if (!db.objectStoreNames.contains("academic_calendar")) {
        db.createObjectStore("academic_calendar", { keyPath: "calendar_id" });
      }

      // 24. E-Library Books Store
      if (!db.objectStoreNames.contains("elibrary_books")) {
        db.createObjectStore("elibrary_books", { keyPath: "id" });
      }

      // 25. Parent Profiles Store
      if (!db.objectStoreNames.contains("parent_profiles")) {
        db.createObjectStore("parent_profiles", { keyPath: "parent_id" });
      }

      // 26. Parent Student Relations Store
      if (!db.objectStoreNames.contains("parent_student_relations")) {
        db.createObjectStore("parent_student_relations", { keyPath: "relation_id" });
      }

      // 27. Notification User Reads Store
      if (!db.objectStoreNames.contains("notification_user_reads")) {
        db.createObjectStore("notification_user_reads", { keyPath: "read_id" });
      }

      // 28. Portal Messages Store
      if (!db.objectStoreNames.contains("portal_messages")) {
        db.createObjectStore("portal_messages", { keyPath: "message_id" });
      }

      // 29. Broadcast Archives Store
      if (!db.objectStoreNames.contains("broadcast_archives")) {
        db.createObjectStore("broadcast_archives", { keyPath: "archive_id" });
      }

      // 30. Custom Recipient Groups Store
      if (!db.objectStoreNames.contains("custom_recipient_groups")) {
        db.createObjectStore("custom_recipient_groups", { keyPath: "group_id" });
      }

      // 31. Subjects Store
      if (!db.objectStoreNames.contains("subjects")) {
        const subStore = db.createObjectStore("subjects", { keyPath: "subject_id" });
        subStore.createIndex("subject_name", "subject_name", { unique: false });
      }

      // 32. Birthday Dispatches Store (Centralized daily idempotency)
      if (!db.objectStoreNames.contains("birthday_dispatches")) {
        const bdayStore = db.createObjectStore("birthday_dispatches", { keyPath: "dispatch_id" });
        bdayStore.createIndex("date", "date", { unique: false });
        bdayStore.createIndex("user_id", "user_id", { unique: false });
        bdayStore.createIndex("status", "status", { unique: false });
      }
    };
  });
}

// Firebase Auth Guard: ensure anonymous auth is resolved before Firestore writes
let authPromise = null;
async function ensureFirebaseAuth() {
  if (typeof firebase === "undefined" || !firebase.auth) return null;
  if (!firebase.apps || firebase.apps.length === 0) {
    if (window.firebaseConfig && window.firebaseConfig.projectId && window.firebaseConfig.projectId !== "YOUR_PROJECT_ID") {
      try {
        firebase.initializeApp(window.firebaseConfig);
      } catch (e) {}
    } else {
      return null;
    }
  }
  const auth = firebase.auth();
  if (auth.currentUser) return auth.currentUser;
  if (authPromise) return authPromise;

  authPromise = new Promise((resolve) => {
    let resolved = false;
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && !resolved) {
        resolved = true;
        unsubscribe();
        resolve(user);
      }
    });
    auth.signInAnonymously().catch((err) => {
      console.warn("Anonymous auth notice:", err ? err.message || err : "failed");
      if (!resolved) {
        resolved = true;
        resolve(auth.currentUser);
      }
    });
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(auth.currentUser);
      }
    }, 2500);
  });
  return authPromise;
}

// Firestore Document Limit Guard (~1MB limit per document):
// Splits large gallery images collections into <800KB chunk documents in cms_gallery_chunks
const GALLERY_CHUNK_SIZE = 8; // 8 photos per chunk (~650KB), well below 1,048,576 bytes

async function syncGalleryImagesToFirestore(obj) {
  if (DB_READ_ONLY) return;
  if (typeof firebase === "undefined" || !firebase.firestore) return;
  await ensureFirebaseAuth();
  const firestore = firebase.firestore();

  let gallery = [];
  try {
    gallery = typeof obj.value === "string" ? JSON.parse(obj.value) : (Array.isArray(obj.value) ? obj.value : []);
  } catch (e) {
    gallery = [];
  }

  const updatedAt = obj.updated_at || new Date().toISOString();
  const totalPhotos = gallery.length;
  const chunkCount = Math.ceil(totalPhotos / GALLERY_CHUNK_SIZE);

  if (totalPhotos === 0) {
    // Delete any existing chunks
    try {
      const existingChunks = await firestore.collection("cms_gallery_chunks").get();
      const batch = firestore.batch();
      existingChunks.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (e) {
      console.warn("Clearing gallery chunks notice:", e);
    }
    // Set empty manifest
    await firestore.collection("cms_content").doc("gallery_images").set({
      content_key: "gallery_images",
      is_chunked: true,
      chunk_count: 0,
      total_photos: 0,
      value: "[]",
      updated_at: updatedAt,
      synced: true
    });
    return;
  }

  // Upload chunks in batches
  for (let i = 0; i < chunkCount; i++) {
    const chunkPhotos = gallery.slice(i * GALLERY_CHUNK_SIZE, (i + 1) * GALLERY_CHUNK_SIZE);
    const chunkDocId = `chunk_${i}`;
    await firestore.collection("cms_gallery_chunks").doc(chunkDocId).set({
      chunk_index: i,
      total_chunks: chunkCount,
      photos: chunkPhotos,
      updated_at: updatedAt
    });
  }

  // Delete any excess chunks from previous larger uploads
  try {
    const existingChunks = await firestore.collection("cms_gallery_chunks").get();
    const batch = firestore.batch();
    let hasDeletions = false;
    existingChunks.forEach(doc => {
      const data = doc.data();
      if (typeof data.chunk_index === "number" && data.chunk_index >= chunkCount) {
        batch.delete(doc.ref);
        hasDeletions = true;
      }
    });
    if (hasDeletions) await batch.commit();
  } catch (e) {}

  // Update manifest in cms_content
  await firestore.collection("cms_content").doc("gallery_images").set({
    content_key: "gallery_images",
    is_chunked: true,
    chunk_count: chunkCount,
    total_photos: totalPhotos,
    updated_at: updatedAt,
    synced: true
  });
  console.log(`Successfully synced ${totalPhotos} gallery photos across ${chunkCount} chunks to Firestore.`);
}

// Assemble chunked Firestore documents transparently on client read
async function assembleFirestoreDoc(storeName, docData) {
  if (storeName === "cms_content" && docData && (docData.content_key === "gallery_images" || docData.is_chunked)) {
    if ((docData.is_chunked || docData.content_key === "gallery_images") && typeof firebase !== "undefined" && firebase.firestore) {
      try {
        const firestore = firebase.firestore();
        const chunksSnapshot = await firestore.collection("cms_gallery_chunks").get();
        if (!chunksSnapshot.empty) {
          const chunks = [];
          chunksSnapshot.forEach(doc => chunks.push(doc.data()));
          chunks.sort((a, b) => (a.chunk_index || 0) - (b.chunk_index || 0));
          const allPhotos = [];
          chunks.forEach(c => {
            if (Array.isArray(c.photos)) {
              allPhotos.push(...c.photos);
            } else if (typeof c.photos_json === "string") {
              try {
                const parsed = JSON.parse(c.photos_json);
                if (Array.isArray(parsed)) allPhotos.push(...parsed);
              } catch (e) {}
            }
          });
          return {
            content_key: "gallery_images",
            is_chunked: true,
            chunk_count: chunks.length,
            total_photos: allPhotos.length,
            value: JSON.stringify(allPhotos),
            updated_at: docData.updated_at || new Date().toISOString(),
            synced: true
          };
        }
      } catch (e) {
        console.warn("assembleFirestoreDoc failed, keeping local fallback:", e);
      }
    }
  }
  return docData;
}

function isDocContentIdentical(a, b) {
  if (!a || !b) return false;
  const ignoreKeys = new Set(["updated_at", "created_at", "synced", "is_seed", "_preserve_updated_at"]);
  const keysA = Object.keys(a).filter(k => !ignoreKeys.has(k));
  const keysB = Object.keys(b).filter(k => !ignoreKeys.has(k));
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    const valA = a[k];
    const valB = b[k];
    if (typeof valA === "object" || typeof valB === "object") {
      if (JSON.stringify(valA) !== JSON.stringify(valB)) return false;
    } else if (valA !== valB) {
      return false;
    }
  }
  return true;
}

// Database Helper Actions
const db = {
  // Get doc identifier key name
  getDocId(storeName, obj) {
    if (storeName === "users") return obj.user_id;
    if (storeName === "profiles") return obj.profile_id;
    if (storeName === "classes") return obj.class_id;
    if (storeName === "enrolments") return obj.enrolment_id;
    if (storeName === "class_posts") return obj.post_id;
    if (storeName === "financial_transactions") return obj.transaction_id;
    if (storeName === "audit_logs") return obj.audit_id;
    if (storeName === "attendance") return obj.attendance_id;
    if (storeName === "assignments") return obj.assignment_id;
    if (storeName === "student_scores") return obj.score_id;
    if (storeName === "lesson_notes") return obj.note_id;
    if (storeName === "pickup_guardians") return obj.guardian_id;
    if (storeName === "staff_tasks") return obj.task_id;
    if (storeName === "notifications") return obj.notification_id;
    if (storeName === "sectional_reports") return obj.report_id;
    if (storeName === "questionnaires") return obj.questionnaire_id;
    if (storeName === "questionnaire_responses") return obj.response_id;
    if (storeName === "cms_content") return obj.content_key;
    if (storeName === "bank_reconciliations") return obj.recon_id;
    if (storeName === "prospectuses") return obj.prospectus_id;
    if (storeName === "broadcast_requests") return obj.request_id;
    if (storeName === "data_change_requests") return obj.request_id;
    if (storeName === "academic_calendar") return obj.calendar_id;
    if (storeName === "elibrary_books") return obj.id;
    if (storeName === "parent_profiles") return obj.parent_id;
    if (storeName === "parent_student_relations") return obj.relation_id;
    if (storeName === "notification_user_reads") return obj.read_id;
    if (storeName === "portal_messages") return obj.message_id;
    if (storeName === "broadcast_archives") return obj.archive_id;
    if (storeName === "custom_recipient_groups") return obj.group_id;
    if (storeName === "subjects") return obj.subject_id;
    if (storeName === "birthday_dispatches") return obj.dispatch_id;
    return null;
  },

  // Atomic transaction runner
  runTransaction(storeNames, mode, callback) {
    return initDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeNames, mode);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(transaction.error || e.target.error);
        transaction.onabort = (e) => reject(new Error("Transaction aborted"));

        try {
          callback(transaction);
        } catch (err) {
          transaction.abort();
          reject(err);
        }
      });
    });
  },

  // Get single record
  get(storeName, key) {
    return initDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => { const res = request.result; resolve(res && res.is_deleted === true ? undefined : res); };
        request.onerror = () => reject(request.error);
      });
    });
  },

  // Get records by index query bounds
  getByIndex(storeName, indexName, value) {
    return initDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const range = IDBKeyRange.only(value);
        const request = index.getAll(range);
        request.onsuccess = () => { const res = request.result || []; resolve(res.filter(r => r.is_deleted !== true)); };
        request.onerror = () => reject(request.error);
      });
    });
  },

  // Get all records
  getAllRaw(storeName) { return initDB().then((db) => { return new Promise((resolve, reject) => { const transaction = db.transaction(storeName, "readonly"); const store = transaction.objectStore(storeName); const request = store.getAll(); request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error); }); }); }, getAll(storeName) { return initDB().then((db) => { return new Promise((resolve, reject) => { const transaction = db.transaction(storeName, "readonly"); const store = transaction.objectStore(storeName); const request = store.getAll(); request.onsuccess = () => { let results = request.result || []; results = results.filter(r => r.is_deleted !== true); if (storeName === "classes") {
            const CANONICAL_CLASS_ORDER = [
              "creche",
              "nursery 1",
              "nursery 2",
              "kg 1",
              "kg 2",
              "primary 1",
              "primary 2",
              "primary 3",
              "primary 4",
              "primary 5",
              "primary 6",
              "jhs 1",
              "jhs 2",
              "jhs 3"
            ];
            results.sort((a, b) => {
              const nameA = (a.class_name || a.name || "").toLowerCase().trim();
              const nameB = (b.class_name || b.name || "").toLowerCase().trim();
              let idxA = CANONICAL_CLASS_ORDER.findIndex(c => nameA.includes(c));
              let idxB = CANONICAL_CLASS_ORDER.findIndex(c => nameB.includes(c));
              if (idxA === -1) idxA = 999;
              if (idxB === -1) idxB = 999;
              if (idxA !== idxB) return idxA - idxB;
              return nameA.localeCompare(nameB);
            });
          }
          resolve(results);
        };
        request.onerror = () => reject(request.error);
      });
    });
  },

  // Save/Update record locally in IndexedDB only
  putLocal(storeName, obj) {
    return initDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.put(obj);
        request.onsuccess = () => { const res = request.result; resolve(res && res.is_deleted === true ? undefined : res); };
        request.onerror = () => reject(request.error);
      });
    });
  },

  // Insert a default/seed record locally ONLY if no record with that key exists (atomic IndexedDB add).
  // Seeds get an epoch timestamp + is_seed flag so any real cloud record wins, and are never pushed to Firestore.
  seedLocal(storeName, obj) {
    const record = { ...obj, updated_at: SEED_TIMESTAMP, synced: true, is_seed: true };
    if (!record.created_at) record.created_at = SEED_TIMESTAMP;
    return initDB().then((database) => {
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        const request = transaction.objectStore(storeName).add(record);
        request.onsuccess = () => resolve(true);
        request.onerror = (e) => {
          if (request.error && request.error.name === "ConstraintError") {
            // Record already exists (real data) - keep it untouched
            e.preventDefault();
            resolve(false);
          } else {
            reject(request.error);
          }
        };
      });
    });
  },

  // Save/Update record globally (IndexedDB + Cloud Firestore)
  async put(storeName, obj) {
    const isOnline = navigator.onLine;
    const cloudWritable = canWriteToCloud(storeName);
    obj.synced = cloudWritable ? isOnline : true;
    // A real user save promotes a seed record into real data
    delete obj.is_seed;
    if (!obj._preserve_updated_at) {
      obj.updated_at = new Date().toISOString();
    } else {
      delete obj._preserve_updated_at;
    }
    if (!obj.created_at) {
      obj.created_at = obj.updated_at;
    }

    const docId = this.getDocId(storeName, obj);
    let shouldWriteCloud = cloudWritable && isOnline && window.isFirebaseConfigured && window.isFirebaseConfigured();
    if (shouldWriteCloud && docId) {
      const existing = await this.get(storeName, docId);
      if (existing && isDocContentIdentical(existing, obj)) {
        shouldWriteCloud = false; // Deduplicate: unchanged data avoids burning Firestore write quota
      }
    }
    
    const res = await this.putLocal(storeName, obj);
    if (shouldWriteCloud && docId) {
      try {
        if (typeof ensureFirebaseAuth === "function") {
          await ensureFirebaseAuth();
        }
        if (storeName === "cms_content" && docId === "gallery_images" && typeof syncGalleryImagesToFirestore === "function") {
          await syncGalleryImagesToFirestore(obj);
        } else {
          await firebase.firestore().collection(storeName).doc(docId).set(obj, { merge: true });
        }
      } catch (err) {
        console.warn("Firestore save failed (offline queue active):", err);
        obj.synced = false;
        await this.putLocal(storeName, obj);
      }
    }
    return res;
  },

  // Batch Save/Update records globally (IndexedDB + Cloud Firestore writeBatch)
  async putBatch(storeName, items) {
    if (!Array.isArray(items) || items.length === 0) return true;
    const isOnline = navigator.onLine;
    const cloudWritable = canWriteToCloud(storeName);
    const nowIso = new Date().toISOString();

    for (const obj of items) {
      obj.synced = cloudWritable ? isOnline : true;
      delete obj.is_seed;
      if (!obj._preserve_updated_at) {
        obj.updated_at = nowIso;
      } else {
        delete obj._preserve_updated_at;
      }
      if (!obj.created_at) {
        obj.created_at = obj.updated_at;
      }
    }

    // 1. Batch write into IndexedDB in a single transaction
    const dbInst = await initDB();
    await new Promise((resolve, reject) => {
      const transaction = dbInst.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      items.forEach(item => store.put(item));
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });

    // 2. Commit to Firestore in batches (max 450 per commit to stay well within limits)
    if (cloudWritable && isOnline && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
      try {
        if (typeof ensureFirebaseAuth === "function") {
          await ensureFirebaseAuth();
        }
        const firestore = firebase.firestore();
        const BATCH_LIMIT = 450;
        for (let i = 0; i < items.length; i += BATCH_LIMIT) {
          const chunk = items.slice(i, i + BATCH_LIMIT);
          const batch = firestore.batch();
          for (const item of chunk) {
            const docId = this.getDocId(storeName, item);
            if (docId) {
              const docRef = firestore.collection(storeName).doc(docId);
              batch.set(docRef, item, { merge: true });
            }
          }
          await batch.commit();
        }
      } catch (err) {
        console.warn(`Firestore putBatch failed for ${storeName} (queued locally):`, err);
        for (const item of items) {
          item.synced = false;
        }
        const tx = dbInst.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        items.forEach(item => store.put(item));
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("dbSyncUpdate", { detail: { storeName, batchCount: items.length } }));
    }
    return true;
  },

  // Add record (fails if key exists)
  add(storeName, obj) {
    return initDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.add(obj);
        request.onsuccess = () => {
          if (canWriteToCloud(storeName) && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
            try {
              const docId = this.getDocId(storeName, obj);
              if (docId) {
                firebase.firestore().collection(storeName).doc(docId).set(obj);
              }
            } catch (err) {
              console.warn("Firestore add failed:", err);
            }
          }
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
      });
    });
  },

  // Delete record locally only
  deleteLocal(storeName, key) {
    return initDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    });
  },

  // Delete record globally
  delete(storeName, key) { return initDB().then((db) => { return new Promise((resolve, reject) => { const tx = db.transaction(storeName, "readonly"); const store = tx.objectStore(storeName); const req = store.get(key); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }).then((doc) => { if (!doc) return false; doc.is_deleted = true; doc.synced = false; doc.updated_at = new Date().toISOString(); return this.putLocal(storeName, doc).then(() => { if (canWriteToCloud(storeName) && window.isFirebaseConfigured && window.isFirebaseConfigured()) { try { firebase.firestore().collection(storeName).doc(key).delete().then(() => this.deleteLocal(storeName, key)).catch(()=>{}); } catch (err) {} } return true; }); }); },

  // Query records matching an index
  queryByIndex(storeName, indexName, value) {
    return initDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(value);
        request.onsuccess = () => { const res = request.result || []; resolve(res.filter(r => r.is_deleted !== true)); };
        request.onerror = () => reject(request.error);
      });
    });
  },

  // Search by index using range
  queryByIndexRange(storeName, indexName, keyRange) {
    return initDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(keyRange);
        request.onsuccess = () => { const res = request.result || []; resolve(res.filter(r => r.is_deleted !== true)); };
        request.onerror = () => reject(request.error);
      });
    });
  },

  // Safely close the active IndexedDB connection
  close() {
    if (dbInstance) {
      try {
        dbInstance.close();
      } catch (e) {}
      dbInstance = null;
    }
  },

  // Purge legacy sample/demo CMS content from the LOCAL IndexedDB only.
  // Never writes to Firestore and never re-stamps updated_at, so a stale local copy can't overwrite newer cloud data.
  // Incoming cloud documents are cleaned separately by sanitizeIncomingDoc().
  async purgeLegacySampleCMSData() {
    try {
      // 1. Purge legacy sample albums (exact id match only)
      const albumsRec = await this.get("cms_content", "gallery_albums");
      const REAL_ALBUMS = [
        { id: "alb-ghana", name: "Ghana Day Celebration" },
        { id: "alb-grad", name: "Graduation Ceremony" },
        { id: "alb-church", name: "Church Service" },
        { id: "alb-career", name: "Career Day" },
        { id: "alb-lab", name: "Lab Session" },
        { id: "alb-quiz", name: "Quiz" }
      ];
      if (albumsRec) {
        const albums = parseJsonArray(albumsRec.value);
        if (albums && albums.some(isLegacyAlbum)) {
          console.log("Purging legacy sample albums from local IndexedDB...");
          const cleanAlbums = albums.filter(a => !isLegacyAlbum(a));
          albumsRec.value = JSON.stringify(cleanAlbums.length > 0 ? cleanAlbums : REAL_ALBUMS);
          await this.putLocal("cms_content", albumsRec);
        }
      }

      // 2. Purge legacy sample announcements (exact id/title match only)
      const newsRec = await this.get("cms_content", "news_feed");
      if (newsRec) {
        const news = parseJsonArray(newsRec.value);
        if (news && news.some(isLegacyNewsItem)) {
          console.log("Purging legacy sample announcements from local IndexedDB...");
          newsRec.value = JSON.stringify(news.filter(item => !isLegacyNewsItem(item)));
          await this.putLocal("cms_content", newsRec);
        }
      }

      // 2.5 Purge legacy sample calendar events (exact legacy ids only)
      const calRec = await this.get("academic_calendar", "main-calendar");
      if (calRec && Array.isArray(calRec.events) && calRec.events.some(isLegacyCalendarEvent)) {
        console.log("Purging legacy sample calendar events from local IndexedDB...");
        calRec.events = calRec.events.filter(e => !isLegacyCalendarEvent(e));
        await this.putLocal("academic_calendar", calRec);
      }

      // 3. Purge legacy sample gallery images & provide a LOCAL display fallback when no real gallery exists.
      // The fallback is stored as a seed (epoch timestamp) and is NEVER pushed to Firestore.
      const galleryRec = await this.get("cms_content", "gallery_images");
      let needsPhotoFallback = false;
      if (!galleryRec) {
        needsPhotoFallback = true;
      } else {
        const photos = parseJsonArray(galleryRec.value);
        const isUntouchedSeed = getDocTimestamp(galleryRec) === 0;
        if (photos && photos.some(isLegacyGalleryPhoto)) {
          console.log("Purging legacy mock gallery images from local IndexedDB...");
          const realPhotos = photos.filter(p => !isLegacyGalleryPhoto(p));
          if (realPhotos.length > 0) {
            galleryRec.value = JSON.stringify(realPhotos);
            await this.putLocal("cms_content", galleryRec);
          } else {
            needsPhotoFallback = true;
          }
        } else if (isUntouchedSeed && (!photos || photos.length === 0)) {
          // Only replace an empty placeholder seed; respect a real (deliberately emptied) cloud gallery
          needsPhotoFallback = true;
        }
      }

      if (needsPhotoFallback) {
        try {
          const candidatePaths = [
            "./assets/gallery-data.json",
            "../portal/assets/gallery-data.json",
            "../website/assets/gallery-data.json",
            "/portal/assets/gallery-data.json",
            "/website/assets/gallery-data.json"
          ];
          let fetchedPhotos = null;
          for (const p of candidatePaths) {
            try {
              const resp = await fetch(p);
              if (resp && resp.ok) {
                const data = await resp.json();
                if (Array.isArray(data) && data.length > 0) {
                  fetchedPhotos = data;
                  break;
                }
              }
            } catch (fetchErr) {}
          }
          if (fetchedPhotos && fetchedPhotos.length > 0) {
            await this.putLocal("cms_content", {
              content_key: "gallery_images",
              value: JSON.stringify(fetchedPhotos),
              updated_at: SEED_TIMESTAMP,
              created_at: SEED_TIMESTAMP,
              synced: true,
              is_seed: true
            });
            console.log(`Local gallery fallback loaded with ${fetchedPhotos.length} photos from manifest (not synced to cloud).`);
          }
        } catch (err) {
          console.warn("Failed to load real gallery photos fallback:", err);
        }
      }

      // Purge legacy mock leadership team and upgrade to real Board & Management
      try {
        const leadRec = await this.get("cms_content", "leadership_team");
        if (leadRec && leadRec.value) {
          const valStr = typeof leadRec.value === "string" ? leadRec.value : JSON.stringify(leadRec.value);
          if (valStr.includes("Ebenezer K. Mensah") || valStr.includes("Comfort A. Appiah")) {
            console.log("Upgrading legacy mock leadership team to real Board & Management...");
            await this.putLocal("cms_content", {
              content_key: "leadership_board",
              value: JSON.stringify([
                { name: "Mr. Shadrach Dampson", role: "Board Chairman", image: "./assets/leadership/shadrach-dampson.jpeg" },
                { name: "Mr. Ernest Brew Paintsil", role: "Proprietor", image: "./assets/leadership/ernest-brew-paintsil.jpeg" },
                { name: "Mad. Abigail Sarfo", role: "Proprietress", image: "./assets/leadership/abigail-sarfo.jpeg" },
                { name: "Mr. John Mensah", role: "SPP Chairman", image: "./assets/leadership/john-mensah.jpeg" },
                { name: "Ps. Emmanuel Nuakoh", role: "Member", image: "./assets/leadership/emmanuel-nuakoh.jpeg" },
                { name: "Mad. Yvonne Anonadaga Kwarah", role: "Member", image: "./assets/leadership/yvonne-anonadaga-kwarah.jpeg" },
                { name: "Nana Appiah Otoo Kubi", role: "Member", image: "./assets/leadership/nana-appiah-otoo-kubi.jpeg" },
                { name: "Mr. Samuel Kwesi Afful", role: "Member", image: "./assets/leadership/samuel-kwesi-afful.jpeg" }
              ]),
              updated_at: new Date().toISOString()
            });
            await this.putLocal("cms_content", {
              content_key: "leadership_management",
              value: JSON.stringify([
                { name: "Mad. Abigail Sarfo", role: "Proprietress", image: "./assets/leadership/abigail-sarfo.jpeg" },
                { name: "Mad. Enid Freda Anku", role: "Head Teacher", image: "./assets/leadership/enid-freda-anku.jpeg" },
                { name: "Nana Appiah Otoo Kubi", role: "Asst. Head Teacher", image: "./assets/leadership/nana-appiah-otoo-kubi.jpeg" },
                { name: "Mr. Robert Fiifi Amoah", role: "Accountant", image: "./assets/leadership/robert-fiifi-amoah.jpeg" },
                { name: "Mad. Theresa Boako", role: "Administrator", image: "./assets/leadership/theresa-boako.jpeg" },
                { name: "Mad. Mabel Quintin-Cofie", role: "Sectional Head - JHS", image: "./assets/leadership/mabel-quintin-cofie.jpeg" },
                { name: "Mr. Kingsley Appiah", role: "Sectional Head - Primary", image: "./assets/leadership/kingsley-appiah.jpeg" },
                { name: "Mad. Delphina Kwarah", role: "Supervisor & Sectional Head - Pre School", image: "./assets/leadership/delphina-kwarah.jpeg" }
              ]),
              updated_at: new Date().toISOString()
            });
          }
        }
        // Auto-upgrade Mad. Abigail Sarfo's title to Proprietress across stored leadership
        const boardRec = await this.get("cms_content", "leadership_board");
        if (boardRec && boardRec.value && boardRec.value.includes("Head, Management")) {
          boardRec.value = boardRec.value.replace(/"role":\s*"Head,\s*Management"/g, '"role":"Proprietress"');
          await this.putLocal("cms_content", boardRec);
        }
        const mgmtRec = await this.get("cms_content", "leadership_management");
        if (mgmtRec && mgmtRec.value && mgmtRec.value.includes("Head, Management")) {
          mgmtRec.value = mgmtRec.value.replace(/"role":\s*"Head,\s*Management"/g, '"role":"Proprietress"');
          await this.putLocal("cms_content", mgmtRec);
        }
      } catch (lErr) {}

      // 4. Purge orphaned Creche test enrolment and any enrolments referencing non-existent students
      try {
        const orphan = await this.get("enrolments", "e-enrol-1790887884074");
        if (orphan) {
          console.log("Purging orphaned Creche test enrolment e-enrol-1790887884074 from local IndexedDB...");
          await this.deleteLocal("enrolments", "e-enrol-1790887884074");
        }
        const allUsers = await this.getAll("users");
        const studentUserIds = new Set((allUsers || []).filter(u => u.role === "Student").map(u => u.user_id));
        const allEnrols = await this.getAll("enrolments");
        for (const enr of allEnrols) {
          if (enr.enrolment_id === "e-enrol-1790887884074" || enr.student_id === "u-d3qlgoe3h") {
            await this.deleteLocal("enrolments", enr.enrolment_id);
          } else if (allUsers.length > 50 && enr.class_id === "c-creche" && !studentUserIds.has(enr.student_id)) {
            await this.deleteLocal("enrolments", enr.enrolment_id);
          }
        }

        // 5. Ensure 2026/2027 Creche students are properly mapped to c-creche in local cache
        const crecheStudentUserIds = ["u-j008jnsmd", "u-l8arzvhms", "u-a735towfj"];
        for (const enr of allEnrols) {
          if (crecheStudentUserIds.includes(enr.student_id) && enr.class_id !== "c-creche") {
            enr.class_id = "c-creche";
            enr.academic_year = "2026/2027";
            enr.status = "ACTIVE";
            enr.promoted_2026_2027 = true;
            enr.previous_class_id = "";
            await this.putLocal("enrolments", enr);
          }
        }
        try {
          const profs = await this.getAll("profiles");
          for (const uId of crecheStudentUserIds) {
            const p = profs.find(prof => prof.user_id === uId);
            if (p && p.current_class_id !== "c-creche") {
              p.current_class_id = "c-creche";
              p.current_class_name = "Creche";
              p.previous_class_id = "";
              p.previous_class_name = "";
              p.academic_history = "[]";
              await this.putLocal("profiles", p);
            }
          }
        } catch (cpErr) {}
      } catch (enrPurgeErr) {
        console.warn("Orphaned enrolment local purge notice:", enrPurgeErr);
      }
    } catch (e) {
      console.warn("purgeLegacySampleCMSData error:", e);
    }
  }
};

// Seed Mock Data
async function seedMockData() {
  if (typeof db.purgeLegacySampleCMSData === "function") {
    await db.purgeLegacySampleCMSData();
  }
  // Check and seed upgraded tables first (handles DB version 2 migrations)
  try {
    // Auto-migrate any legacy PENDING_PASSWORD users to ACTIVE and ensure gender exists
    try {
      const allUsers = await db.getAll("users");
      for (const u of allUsers) {
        let changed = false;
        if (u.status === "PENDING_PASSWORD") {
          u.status = "ACTIVE";
          changed = true;
        }
        if (!u.gender) {
          const fn = (u.first_name || "").toLowerCase();
          if (["comfort", "alice", "gifty", "priscilla", "abigail", "mary", "grace", "patricia", "doris", "esther", "office", "administrator"].includes(fn) || (u.role === "Admin")) {
            u.gender = "Female";
          } else {
            u.gender = "Male";
          }
          changed = true;
        }
        if (changed) {
          await db.put("users", u);
        }
      }
    } catch (userMigErr) {
      console.warn("User status and gender auto-migration notice:", userMigErr);
    }

    // Migrate parent profiles & relations if empty
    try {
      const parentRelations = await db.getAll("parent_student_relations");
      if (parentRelations.length === 0) {
        console.log("Migrating parent profiles and relations from old student profiles...");
        const profiles = await db.getAll("profiles");
        const users = await db.getAll("users");
        
        let pCount = 1;
        for (const prof of profiles) {
          const userObj = users.find(u => u.user_id === prof.user_id);
          if (userObj && userObj.role === "Student") {
            try {
              let emergency = null;
              if (prof.emergency_contact) {
                if (typeof prof.emergency_contact === "string") {
                  emergency = JSON.parse(prof.emergency_contact);
                } else {
                  emergency = prof.emergency_contact;
                }
              }
              
              let parentName = "";
              let parentPhone = "";
              let parentRelation = "Guardian";
              let parentEmail = userObj.email || "";

              if (emergency) {
                if (emergency.primary) {
                  parentName = `${emergency.primary.first_name || ""} ${emergency.primary.last_name || ""}`.trim();
                  parentPhone = emergency.primary.phone || "";
                  parentRelation = emergency.primary.relation || "Guardian";
                  parentEmail = emergency.primary.email || "";
                } else {
                  parentName = emergency.name || "";
                  parentPhone = emergency.phone || "";
                  parentRelation = emergency.relation || "Guardian";
                }
              }

              if (!parentName && userObj.phone) {
                parentName = "Guardian of " + userObj.first_name;
                parentPhone = userObj.phone;
              }

              if (parentName && parentPhone) {
                const existingParents = await db.getAll("parent_profiles");
                let targetParent = existingParents.find(p => p.phone === parentPhone);
                let pId = "";
                
                if (targetParent) {
                  pId = targetParent.parent_id;
                } else {
                  pId = "p-parent-" + pCount++;
                  const parentRecord = {
                    parent_id: pId,
                    first_name: parentName.split(" ")[0] || parentName,
                    last_name: parentName.split(" ").slice(1).join(" ") || "Guardian",
                    phone: parentPhone,
                    email: parentEmail,
                    address: prof.address || "Parent Address"
                  };
                  await db.put("parent_profiles", parentRecord);
                }
                
                const relRecord = {
                  relation_id: "r-rel-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
                  parent_id: pId,
                  student_id: userObj.user_id,
                  relation_type: parentRelation
                };
                await db.put("parent_student_relations", relRecord);
              }
            } catch (e) {
              console.warn("Skipped parent migration row:", e);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Parent profiles migration failed:", err);
    }

    // Seed elibrary_books if empty
    const elibraryBooks = await db.getAll("elibrary_books");
    if (elibraryBooks.length === 0) {
      console.log("Seeding initial elibrary books...");
      const seedBooks = [
        { id: "sci-5", title: "Primary Science Book 5", author: "Dr. K. A. Boateng", pages: 120, summary: "Explores cell structures, root systems, and plant anatomy.", group: "Science" },
        { id: "math-5", title: "Basic Mathematics Vol 5", author: "Prof. F. Mensah", pages: 180, summary: "Fractions, algebraic expressions, and division algorithms.", group: "Mathematics" },
        { id: "soc-5", title: "Social Studies for Grade 5", author: "Mrs. A. Ofori", pages: 95, summary: "West African history, national resources, and citizenship.", group: "Social Studies" }
      ];
      for (const b of seedBooks) {
        await db.seedLocal("elibrary_books", b);
      }
    }

    const tasks = await db.getAll("staff_tasks");
    if (tasks.length === 0) {
      console.log("Seeding initial staff tasks...");
      const seedStaffTasks = [
        {
          task_id: "task-1",
          description: "Verify manual cash ledger audit entries",
          assignee_id: "u-proprietor-1",
          assignee_name: "Proprietor (Self)",
          assigner_id: "u-proprietor-1",
          status: "PENDING",
          created_at: new Date("2026-08-20").toISOString()
        },
        {
          task_id: "task-2",
          description: "Approve staff salary increment bands",
          assignee_id: "u-proprietor-1",
          assignee_name: "Proprietor (Self)",
          assigner_id: "u-proprietor-1",
          status: "PENDING",
          created_at: new Date("2026-08-22").toISOString()
        },
        {
          task_id: "task-3",
          description: "Review terminal report cards",
          assignee_id: "u-headteacher-1",
          assignee_name: "Comfort Ama Appiah",
          assigner_id: "u-proprietor-1",
          status: "PENDING",
          created_at: new Date("2026-08-24").toISOString()
        },
        {
          task_id: "task-4",
          description: "Verify manual check deposits",
          assignee_id: "u-finance-1",
          assignee_name: "John Kofi Larbi",
          assigner_id: "u-proprietor-1",
          status: "PENDING",
          created_at: new Date("2026-08-24").toISOString()
        },
        {
          task_id: "task-5",
          description: "Generate payroll slips for teachers",
          assignee_id: "u-finance-1",
          assignee_name: "John Kofi Larbi",
          assigner_id: "u-proprietor-1",
          status: "PENDING",
          created_at: new Date("2026-08-24").toISOString()
        },
        {
          task_id: "task-6",
          description: "Upload new admissions logs to HT panel",
          assignee_id: "u-finance-1",
          assignee_name: "John Kofi Larbi",
          assigner_id: "u-proprietor-1",
          status: "PENDING",
          created_at: new Date("2026-08-24").toISOString()
        }
      ];
      for (const t of seedStaffTasks) {
        await db.seedLocal("staff_tasks", t);
      }
    }

    // Purge old demo notifications
    try {
      const n1 = await db.get("notifications", "notif-1");
      if (n1) await db.delete("notifications", "notif-1");
      const n2 = await db.get("notifications", "notif-2");
      if (n2) await db.delete("notifications", "notif-2");
    } catch (e) {}

    const calendars = await db.getAll("academic_calendar");
    if (calendars.length === 0) {
      console.log("Seeding initial academic calendar for 2026/2027...");
      const seedCalendar = {
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
      };
      await db.seedLocal("academic_calendar", seedCalendar);
    } else {
      // Ensure calendar is non-null and has academic_year without overriding custom term dates
      try {
        const cal = await db.get("academic_calendar", "main-calendar");
        if (cal) {
          let updated = false;
          if (!cal.academic_year) {
            cal.academic_year = "2026/2027";
            updated = true;
          }
          if (!cal.term1_start) {
            cal.term1_start = "2026-09-08";
            cal.term1_end = "2026-12-17";
            updated = true;
          }
          if (updated) {
            await db.putLocal("academic_calendar", cal);
          }
        }
      } catch (calUpErr) {}
    }

    const questionnaires = await db.getAll("questionnaires");
    if (questionnaires.length === 0) {
      console.log("Seeding initial questionnaires...");
      const seedQuestionnaires = [
        {
          questionnaire_id: "q-1",
          title: "Staff Work Environment Survey",
          description: "Please share your thoughts on the new classroom layouts and air conditioning units. Are they satisfactory?",
          target_group: "All Staff",
          creator_id: "u-proprietor-1",
          creator_name: "Ebenezer Kofi Mensah",
          created_at: new Date("2026-08-23").toISOString()
        },
        {
          questionnaire_id: "q-2",
          title: "Pre-Primary Curriculum Evaluation",
          description: "We are revising the Montessori play materials for the next term. What additional learning aids do you recommend?",
          target_group: "Pre-Primary Teachers",
          creator_id: "u-headteacher-1",
          creator_name: "Comfort Ama Appiah",
          created_at: new Date("2026-08-24").toISOString()
        }
      ];
      for (const q of seedQuestionnaires) {
        await db.seedLocal("questionnaires", q);
      }
    }

    // Seed initial custom recipient groups if empty
    const customGroups = await db.getAll("custom_recipient_groups");
    if (customGroups.length === 0) {
      console.log("Seeding initial custom recipient groups...");
      const seedGroups = [
        {
          group_id: "cgroup-choreo-1",
          group_name: "Choreography Team",
          description: "School cultural dance and choreography performance troupe",
          member_ids: ["u-student-1", "u-student-2"],
          member_count: 2,
          created_by: "u-admin-1",
          created_at: new Date("2026-08-15").toISOString()
        },
        {
          group_id: "cgroup-debate-1",
          group_name: "Debate & Quiz Society",
          description: "Interschool debate championship representatives",
          member_ids: ["u-student-1"],
          member_count: 1,
          created_by: "u-headteacher-1",
          created_at: new Date("2026-08-18").toISOString()
        }
      ];
      for (const g of seedGroups) {
        await db.seedLocal("custom_recipient_groups", g);
      }
    }

    // Seed initial broadcast archive if empty
    const bcastArchives = await db.getAll("broadcast_archives");
    if (bcastArchives.length === 0) {
      console.log("Seeding initial broadcast archive master templates...");
      const seedArchives = [
        {
          archive_id: "bcast-arch-1",
          timestamp: new Date("2026-08-20T10:30:00Z").toISOString(),
          date_formatted: "20/08/2026 10:30 AM",
          sender_id: "u-proprietor-1",
          sender_name: "Ebenezer Kofi Mensah",
          sender_role: "Proprietor",
          general_group: "All Students & Parents",
          general_group_key: "ALL_PARENTS_STUDENTS",
          conditional_group: "Owing School Fees / Arrears",
          conditional_group_key: "COND_ARREARS",
          master_template: "Dear #parent_name#, kindly be reminded that outstanding fees for #student_name# stand at #outstanding_fees#. Please arrange payment at the accounts office. Thank you.",
          recipient_count: 28,
          status: "DELIVERED",
          created_at: new Date("2026-08-20T10:30:00Z").toISOString()
        },
        {
          archive_id: "bcast-arch-2",
          timestamp: new Date("2026-08-22T08:15:00Z").toISOString(),
          date_formatted: "22/08/2026 08:15 AM",
          sender_id: "u-headteacher-1",
          sender_name: "Comfort Ama Appiah",
          sender_role: "HeadTeacher",
          general_group: "Upper Primary Section",
          general_group_key: "SECTION_UPPER_PRIMARY",
          conditional_group: "All (Entire Scope)",
          conditional_group_key: "COND_ALL",
          master_template: "Good morning #parent_name#, please ensure #student_name# brings their Science textbook for practicals today. Regards, Father's Joy Academy.",
          recipient_count: 45,
          status: "DELIVERED",
          created_at: new Date("2026-08-22T08:15:00Z").toISOString()
        }
      ];
      for (const a of seedArchives) {
        await db.seedLocal("broadcast_archives", a);
      }
    }

    // Auto-promote 2025/2026 enrolled students to 2026/2027 class progression ladder
    try {
      const promotionLadder = {
        "c-creche": { nextId: "c-nursery1", nextName: "Nursery 1" },
        "c-nursery1": { nextId: "c-nursery2", nextName: "Nursery 2" },
        "c-nursery2": { nextId: "c-kg1", nextName: "KG 1" },
        "c-kg1": { nextId: "c-kg2", nextName: "KG 2" },
        "c-kg2": { nextId: "c-primary1", nextName: "Primary 1" },
        "c-primary1": { nextId: "c-primary2", nextName: "Primary 2" },
        "c-primary2": { nextId: "c-primary3", nextName: "Primary 3" },
        "c-primary3": { nextId: "c-primary4", nextName: "Primary 4" },
        "c-primary4": { nextId: "c-primary5", nextName: "Primary 5" },
        "c-primary5": { nextId: "c-primary6", nextName: "Primary 6" },
        "c-primary6": { nextId: "c-jhs1", nextName: "JHS 1" },
        "c-jhs1": { nextId: "c-jhs2", nextName: "JHS 2" },
        "c-jhs2": { nextId: "c-jhs3", nextName: "JHS 3" },
        "c-jhs3": { nextId: "c-alumni", nextName: "Graduated (Alumni)" }
      };

      // Ensure alumni class exists
      const alumniClass = await db.get("classes", "c-alumni");
      if (!alumniClass) {
        await db.put("classes", { class_id: "c-alumni", class_name: "Graduated (Alumni)", class_teacher_id: "", academic_year: "2026/2027" });
      }

      const existingClasses = await db.getAll("classes");
      const classMap = new Map(existingClasses.map(c => [c.class_id, c.class_name]));
      const allEnrolments = await db.getAll("enrolments");
      const allProfiles = await db.getAll("profiles");
      const allUsers = await db.getAll("users");
      const studentUsers = allUsers.filter(u => u.role === "Student");
      const studentUserIds = new Set(studentUsers.map(u => u.user_id));

      let needsPromotion = false;
      for (const enr of allEnrolments) {
        if (studentUserIds.has(enr.student_id) && enr.academic_year === "2025/2026" && !enr.promoted_2026_2027) {
          needsPromotion = true;
          break;
        }
      }

      if (needsPromotion) {
        console.log("Applying academic progression promotion for 2026/2027 session...");
        for (const enr of allEnrolments) {
          if (!studentUserIds.has(enr.student_id)) continue;
          if (enr.academic_year !== "2025/2026" || enr.promoted_2026_2027) continue;

          const oldClassId = enr.class_id;
          const oldClassName = classMap.get(oldClassId) || oldClassId;
          const target = promotionLadder[oldClassId];

          if (target) {
            // Find student profile to attach history
            const prof = allProfiles.find(p => p.user_id === enr.student_id);
            if (prof) {
              prof.previous_class_id = oldClassId;
              prof.previous_class_name = oldClassName;
              prof.current_class_id = target.nextId;
              prof.current_class_name = target.nextName;
              
              const historyEntry = {
                academic_year: "2025/2026",
                class_id: oldClassId,
                class_name: oldClassName,
                attendance_rate: prof.cummulative_attendance ? (String(prof.cummulative_attendance).includes("%") ? prof.cummulative_attendance : `${prof.cummulative_attendance}%`) : "N/A",
                academic_average: prof.cummulative_academic_score ? (String(prof.cummulative_academic_score).includes("%") ? prof.cummulative_academic_score : `${prof.cummulative_academic_score}%`) : "N/A",
                status: target.nextId === "c-alumni" ? "GRADUATED" : `PROMOTED to ${target.nextName}`,
                terms: [
                  { term: "1st Term", dates: "02/09/2025 - 18/12/2025" },
                  { term: "2nd Term", dates: "08/01/2026 - 01/04/2026" },
                  { term: "3rd Term", dates: "21/04/2026 - 31/07/2026" }
                ]
              };
              
              let existingHist = [];
              try {
                if (prof.academic_history) {
                  existingHist = typeof prof.academic_history === "string" ? JSON.parse(prof.academic_history) : prof.academic_history;
                }
              } catch(e) {}
              if (!Array.isArray(existingHist)) existingHist = [];
              if (!existingHist.some(h => h.academic_year === "2025/2026")) {
                existingHist.push(historyEntry);
              }
              prof.academic_history = JSON.stringify(existingHist);
              prof.updated_at = new Date().toISOString();
              await db.put("profiles", prof);
            }

            // Update enrolment to promoted class for 2026/2027
            enr.class_id = target.nextId;
            enr.academic_year = "2026/2027";
            enr.previous_class_id = oldClassId;
            enr.status = target.nextId === "c-alumni" ? "GRADUATED" : "ACTIVE";
            enr.enrolled_at = "2026-09-08";
            enr.promoted_2026_2027 = true;
            enr.updated_at = new Date().toISOString();
            await db.put("enrolments", enr);
          }
        }
        console.log("✓ All students successfully promoted to 2026/2027 session!");
      }
    } catch (promErr) {
      console.warn("Promotion auto-migration notice:", promErr);
    }
  } catch (err) {
    console.warn("Error seeding upgraded stores:", err);
  }

  const users = await db.getAll("users");
  if (users.length > 0) {
    // Database already initialized with clean slate or live data
    return;
  }

  console.log("Seeding IndexedDB with initial mock datasets...");

  // --- Seed Users (Passwords matched in api.js) ---
  const seedUsers = [
    {
      user_id: "u-proprietor-1",
      uid: "PR20260001",
      role: "Proprietor",
      first_name: "Ebenezer",
      other_name: "Kofi",
      last_name: "Mensah",
      gender: "Male",
      email: "proprietor@school.com",
      phone: "0551112233",
      password_hash: "proprietor123", // Simulated hash, checked by API
      is_temporal_pwd: false,
      status: "ACTIVE",
      date_of_birth: "1968-04-12",
      created_at: new Date("2026-01-10").toISOString()
    }
  ];

  for (const u of seedUsers) {
    await db.seedLocal("users", u);
  }

  // --- Seed Staff Profiles ---
  const seedProfiles = [
    {
      profile_id: "p-proprietor-1",
      user_id: "u-proprietor-1",
      photo_url: "",
      emergency_contact: JSON.stringify({ name: "Grace Mensah", phone: "0244111222" }),
      address: "House 12, Spintex Road, Accra",
      base_salary: 8000.00,
      allowances: 1500.00,
      appointment_date: "2026-01-10"
    }
  ];

  for (const p of seedProfiles) {
    await db.seedLocal("profiles", p);
  }

  // --- Seed Classes (Clean Slate - No Teachers Assigned Yet) ---
  const seedClasses = [
    { class_id: "c-creche", class_name: "Creche", class_teacher_id: "", academic_year: "2026/2027" },
    { class_id: "c-nursery1", class_name: "Nursery 1", class_teacher_id: "", academic_year: "2026/2027" },
    { class_id: "c-nursery2", class_name: "Nursery 2", class_teacher_id: "", academic_year: "2026/2027" },
    { class_id: "c-kg1", class_name: "KG 1", class_teacher_id: "", academic_year: "2026/2027" },
    { class_id: "c-kg2", class_name: "KG 2", class_teacher_id: "", academic_year: "2026/2027" },
    { class_id: "c-primary1", class_name: "Primary 1", class_teacher_id: "", academic_year: "2026/2027" },
    { class_id: "c-primary2", class_name: "Primary 2", class_teacher_id: "", academic_year: "2026/2027" },
    { class_id: "c-primary3", class_name: "Primary 3", class_teacher_id: "", academic_year: "2026/2027" },
    { class_id: "c-primary4", class_name: "Primary 4", class_teacher_id: "", academic_year: "2026/2027" },
    { class_id: "c-primary5", class_name: "Primary 5", class_teacher_id: "", academic_year: "2026/2027" },
    { class_id: "c-primary6", class_name: "Primary 6", class_teacher_id: "", academic_year: "2026/2027" },
    { class_id: "c-jhs1", class_name: "JHS 1", class_teacher_id: "", academic_year: "2026/2027" },
    { class_id: "c-jhs2", class_name: "JHS 2", class_teacher_id: "", academic_year: "2026/2027" },
    { class_id: "c-jhs3", class_name: "JHS 3", class_teacher_id: "", academic_year: "2026/2027" }
  ];

  for (const c of seedClasses) {
    await db.seedLocal("classes", c);
  }

  // --- Seed CMS Content for Public Landing Page ---
  const seedCMS = [
    {
      content_key: "school_name",
      value: "Father's Joy Academy"
    },
    {
      content_key: "hero_title",
      value: "Nurturing Excellence, Inspiring Leadership"
    },
    {
      content_key: "hero_subtitle",
      value: "A progressive Christian institution committed to producing holistic, tech-literate global citizens in a supportive, offline-resilient digital workspace."
    },
    {
      content_key: "mission_statement",
      value: "To provide quality, child-centered education that empowers students to discover their creative capabilities, build sound ethical values, and excel academically in a dynamic world."
    },
    {
      content_key: "vision_statement",
      value: "To be a premier learning institution of choice, molding leaders who blend academic excellence, ethical integrity, and technological innovation to transform society."
    },
    {
      content_key: "core_values",
      value: JSON.stringify([
        { title: "Integrity", desc: "Honesty and transparency in all dealings." },
        { title: "Innovation", desc: "Embracing technology and creative instruction models." },
        { title: "Excellence", desc: "Maintaining high academic standards in continuous grading." },
        { title: "Empathy", desc: "Fostering collaboration, support, and community care." }
      ])
    },
    {
      content_key: "news_feed",
      value: JSON.stringify([])
    },
    {
      content_key: "gallery_images",
      value: JSON.stringify([])
    },
    {
      content_key: "leadership_board",
      value: JSON.stringify([
        { name: "Mr. Shadrach Dampson", role: "Board Chairman", image: "./assets/leadership/shadrach-dampson.jpeg" },
        { name: "Mr. Ernest Brew Paintsil", role: "Proprietor", image: "./assets/leadership/ernest-brew-paintsil.jpeg" },
        { name: "Mad. Abigail Sarfo", role: "Proprietress", image: "./assets/leadership/abigail-sarfo.jpeg" },
        { name: "Mr. John Mensah", role: "SPP Chairman", image: "./assets/leadership/john-mensah.jpeg" },
        { name: "Ps. Emmanuel Nuakoh", role: "Member", image: "./assets/leadership/emmanuel-nuakoh.jpeg" },
        { name: "Mad. Yvonne Anonadaga Kwarah", role: "Member", image: "./assets/leadership/yvonne-anonadaga-kwarah.jpeg" },
        { name: "Nana Appiah Otoo Kubi", role: "Member", image: "./assets/leadership/nana-appiah-otoo-kubi.jpeg" },
        { name: "Mr. Samuel Kwesi Afful", role: "Member", image: "./assets/leadership/samuel-kwesi-afful.jpeg" }
      ])
    },
    {
      content_key: "leadership_management",
      value: JSON.stringify([
        { name: "Mad. Abigail Sarfo", role: "Proprietress", image: "./assets/leadership/abigail-sarfo.jpeg" },
        { name: "Mad. Enid Freda Anku", role: "Head Teacher", image: "./assets/leadership/enid-freda-anku.jpeg" },
        { name: "Nana Appiah Otoo Kubi", role: "Asst. Head Teacher", image: "./assets/leadership/nana-appiah-otoo-kubi.jpeg" },
        { name: "Mr. Robert Fiifi Amoah", role: "Accountant", image: "./assets/leadership/robert-fiifi-amoah.jpeg" },
        { name: "Mad. Theresa Boako", role: "Administrator", image: "./assets/leadership/theresa-boako.jpeg" },
        { name: "Mad. Mabel Quintin-Cofie", role: "Sectional Head - JHS", image: "./assets/leadership/mabel-quintin-cofie.jpeg" },
        { name: "Mr. Kingsley Appiah", role: "Sectional Head - Primary", image: "./assets/leadership/kingsley-appiah.jpeg" },
        { name: "Mad. Delphina Kwarah", role: "Supervisor & Sectional Head - Pre School", image: "./assets/leadership/delphina-kwarah.jpeg" }
      ])
    },
    {
      content_key: "gallery_albums",
      value: JSON.stringify([
        { id: "alb-ghana", name: "Ghana Day Celebration" },
        { id: "alb-grad", name: "Graduation Ceremony" },
        { id: "alb-church", name: "Church Service" },
        { id: "alb-career", name: "Career Day" },
        { id: "alb-lab", name: "Lab Session" },
        { id: "alb-quiz", name: "Quiz" }
      ])
    }
  ];

  for (const c of seedCMS) {
    const existing = await db.get("cms_content", c.content_key);
    if (!existing) {
      await db.seedLocal("cms_content", c);
    }
  }

  // --- Seed Subjects ---
  const seedSubjects = [
    { subject_id: "sub-math", subject_name: "Core Mathematics" },
    { subject_id: "sub-eng", subject_name: "English Language" },
    { subject_id: "sub-sci", subject_name: "Integrated Science" },
    { subject_id: "sub-soc", subject_name: "Social Studies" },
    { subject_id: "sub-ict", subject_name: "Information Technology" },
    { subject_id: "sub-rme", subject_name: "Religious & Moral Education" },
    { subject_id: "sub-ca", subject_name: "Creative Arts & Design" },
    { subject_id: "sub-french", subject_name: "French Language" }
  ];
  for (const s of seedSubjects) {
    const existing = await db.get("subjects", s.subject_id);
    if (!existing) {
      await db.seedLocal("subjects", s);
    }
  }

  console.log("IndexedDB seeding completed successfully.");
}

// Start Firestore Sync if configured
const STORES_TO_SYNC = [
  "users",
  "profiles",
  "classes",
  "enrolments",
  "class_posts",
  "financial_transactions",
  "audit_logs",
  "attendance",
  "assignments",
  "student_scores",
  "lesson_notes",
  "pickup_guardians",
  "cms_content",
  "staff_tasks",
  "notifications",
  "sectional_reports",
  "questionnaires",
  "questionnaire_responses",
  "bank_reconciliations",
  "prospectuses",
  "broadcast_requests",
  "data_change_requests",
  "academic_calendar",
  "elibrary_books",
  "parent_profiles",
  "parent_student_relations",
  "notification_user_reads",
  "portal_messages",
  "broadcast_archives",
  "custom_recipient_groups",
  "subjects",
  "birthday_dispatches"
];

// Universal timestamp extractor supporting ISO strings, numeric timestamps, and Firestore Timestamps
function getDocTimestamp(doc) {
  if (!doc || typeof doc !== "object") return 0;
  const raw = doc.updated_at || doc.updatedAt || doc.timestamp || doc.created_at || doc.createdAt || doc.date || doc.recorded_at;
  if (!raw) return 0;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const t = Date.parse(raw);
    return isNaN(t) ? 0 : t;
  }
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw.toMillis === "function") return raw.toMillis();
  if (typeof raw.toDate === "function") return raw.toDate().getTime();
  if (typeof raw.seconds === "number") {
    return raw.seconds * 1000 + Math.floor((raw.nanoseconds || 0) / 1e6);
  }
  if (typeof raw._seconds === "number") {
    return raw._seconds * 1000 + Math.floor((raw._nanoseconds || 0) / 1e6);
  }
  return 0;
}

// Universal bidirectional conflict resolution guard across all stores
function shouldKeepLocalDoc(storeName, docId, localDoc, remoteDoc) {
  if (!localDoc) return false;
  if (!remoteDoc) return true;

  // Local seed/fallback records must never prevent real cloud data from syncing
  const seedTimestamp = typeof SEED_TIMESTAMP !== "undefined" ? SEED_TIMESTAMP : "1970-01-01T00:00:00.000Z";
  if (localDoc.is_seed === true || localDoc.updated_at === seedTimestamp || getDocTimestamp(localDoc) === 0) {
    return false;
  }

  // Never keep or push orphaned enrolment records
  if (storeName === "enrolments") {
    if (docId === "e-enrol-1790887884074" || (localDoc && localDoc.student_id === "u-d3qlgoe3h")) {
      return false;
    }
    // Prevent stale promoted nursery1 record from overriding creche in 2026/2027
    if (localDoc && ["u-j008jnsmd", "u-l8arzvhms", "u-a735towfj"].includes(localDoc.student_id) && localDoc.class_id === "c-nursery1") {
      return false;
    }
  }

  if (storeName === "profiles") {
    // Prevent stale promoted nursery1 profile from overriding creche in 2026/2027
    if (localDoc && ["u-j008jnsmd", "u-l8arzvhms", "u-a735towfj"].includes(localDoc.user_id) && localDoc.current_class_id === "c-nursery1") {
      return false;
    }
  }

  // Never keep legacy sample demo announcements, SVG mock galleries, or mock albums over real cloud data
  if (storeName === "cms_content") {
    try {
      const valStr = typeof localDoc.value === "string" ? localDoc.value : JSON.stringify(localDoc.value || "");
      if (
        valStr.includes("img_demo_") ||
        valStr.includes("Digital Coding Lab") ||
        valStr.includes("Science Experiments Lab") ||
        valStr.includes("Sports Grounds") ||
        valStr.includes("news-1") ||
        valStr.includes("New E-Library Portal Launched") ||
        valStr.includes("Upcoming PTA General Meeting") ||
        valStr.includes("Inter-Houses Athletics Competition") ||
        valStr.includes("alb-academics")
      ) {
        return false;
      }
    } catch (e) {}
  } else if (storeName === "academic_calendar" && docId === "main-calendar") {
    try {
      if (Array.isArray(localDoc.events)) {
        const hasLegacy = localDoc.events.some(e =>
          e.id === "ev-term1" ||
          (e.name && e.name.includes("2025/2026"))
        );
        if (hasLegacy) return false;
      }
    } catch (e) {}
  }

  // 1. Pending offline local changes must never be overwritten
  if (localDoc.synced === false) {
    return true;
  }

  const localTime = getDocTimestamp(localDoc);
  const remoteTime = getDocTimestamp(remoteDoc);

  // 2. Timestamp & clock-skew comparison
  // If remote document is newer, equal, or within a 2-second device clock skew buffer:
  if (remoteTime >= localTime - 2000) {
    // Edge case safety: protect user-populated data against blank/empty remote overwrites
    if (storeName === "cms_content") {
      try {
        if (docId === "gallery_images" || docId === "gallery_albums" || docId === "news_feed") {
          const localVal = localDoc.value ? JSON.parse(localDoc.value) : [];
          const remoteVal = remoteDoc.value ? JSON.parse(remoteVal) : [];
          if (Array.isArray(localVal) && localVal.length > 0 && Array.isArray(remoteVal) && remoteVal.length === 0) {
            return true;
          }
        } else if (typeof localDoc.value === "string" && localDoc.value.trim().length > 0) {
          if (!remoteDoc.value || remoteDoc.value.trim().length === 0) {
            return true;
          }
        }
      } catch (e) {}
    } else if (storeName === "academic_calendar" && docId === "main-calendar") {
      if (localDoc.canonical_terms && !remoteDoc.canonical_terms && (!Array.isArray(remoteDoc.events) || remoteDoc.events.length === 0)) return true;
      if (Array.isArray(localDoc.events) && localDoc.events.length > 0 && (!Array.isArray(remoteDoc.events) || remoteDoc.events.length === 0)) return true;
    }
    return false; // Remote is genuinely newer or equivalent, and non-empty
  }

  // 3. Local is genuinely newer by more than 2 seconds
  return true;
}

// Sanitize incoming Firestore documents to scrub legacy sample announcements and events
function sanitizeIncomingDoc(storeName, docId, docData) {
  if (!docData) return docData;

  if (storeName === "enrolments") {
    if (docId === "e-enrol-1790887884074" || docData.student_id === "u-d3qlgoe3h") {
      return null;
    }
  }
  if (storeName === "users") {
    const isMe = window.currentUser && window.currentUser.user_id === docData.user_id;
    if (!isMe) {
      delete docData.password_hash;
    }
  } if (storeName === "cms_content" && docId === "news_feed" && docData.value) {
    try {
      let news = typeof docData.value === "string" ? JSON.parse(docData.value) : docData.value;
      if (Array.isArray(news)) {
        const filtered = news.filter(item =>
          item.id !== "news-1" &&
          item.id !== "news-2" &&
          item.id !== "news-3" &&
          item.title !== "New E-Library Portal Launched" &&
          item.title !== "Upcoming PTA General Meeting" &&
          item.title !== "Inter-Houses Athletics Competition"
        );
        if (filtered.length !== news.length) {
          docData.value = JSON.stringify(filtered);
        }
      }
    } catch (e) {}
  } else if (storeName === "academic_calendar" && docId === "main-calendar") {
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
  }
  return docData;
}

// Active Firestore Unsubscribe Tracker to prevent duplicate listeners
const activeFirestoreUnsubscribes = {};

function clearAllFirestoreListeners() {
  isFullFirestoreSyncRunning = false;
  Object.keys(activeFirestoreUnsubscribes).forEach(storeName => {
    if (Array.isArray(activeFirestoreUnsubscribes[storeName])) {
      activeFirestoreUnsubscribes[storeName].forEach(unsub => {
        try { if (typeof unsub === "function") unsub(); } catch (e) {}
      });
    }
  });
  for (const k in activeFirestoreUnsubscribes) {
    delete activeFirestoreUnsubscribes[k];
  }
}

// Helper to safely retrieve current authenticated user from window, API, or localStorage
function getActiveAuthUser() {
  if (window.currentUser && window.currentUser.user_id) return window.currentUser;
  if (window.api && typeof window.api.getCurrentUser === "function") {
    const apiUser = window.api.getCurrentUser();
    if (apiUser && apiUser.user_id) {
      window.currentUser = apiUser;
      return apiUser;
    }
  }
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem("fja_session_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.user_id) {
          window.currentUser = parsed;
          return parsed;
        }
      }
    } catch (e) {}
  }
  return null;
}

// Role-based store pruning to avoid syncing unneeded collections on free tier
function getStoresForUserRole(role) {
  if (!role) {
    if (!DB_READ_ONLY) {
      // In authenticated portal context, always include financial_transactions and core operational stores
      return STORES_TO_SYNC;
    }
    return [
      "users", "profiles", "classes", "enrolments", "subjects",
      "parent_profiles", "parent_student_relations",
      "cms_content", "academic_calendar", "gallery_albums", "gallery_images"
    ];
  }
  if (role === "Student") {
    return [
      "users", "profiles", "classes", "enrolments", "assignments", "student_scores",
      "attendance", "financial_transactions", "notifications", "portal_messages", "notification_user_reads",
      "subjects", "cms_content", "academic_calendar", "elibrary_books"
    ];
  }
  if (role === "Parent") {
    return [
      "users", "profiles", "parent_profiles", "parent_student_relations",
      "classes", "enrolments", "student_scores", "attendance", "financial_transactions",
      "notifications", "portal_messages", "notification_user_reads",
      "subjects", "cms_content", "academic_calendar"
    ];
  }
  if (role === "Teacher" || role === "SectionalHead") {
    return [
      "users", "profiles", "classes", "enrolments", "class_posts",
      "assignments", "student_scores", "attendance", "lesson_notes",
      "staff_tasks", "broadcast_requests", "notifications", "portal_messages",
      "notification_user_reads", "subjects", "cms_content", "academic_calendar"
    ];
  }
  if (role === "Finance") {
    return [
      "users", "profiles", "classes", "enrolments", "financial_transactions",
      "bank_reconciliations", "notifications", "portal_messages",
      "notification_user_reads", "cms_content", "academic_calendar"
    ];
  }
  // Proprietor, HeadTeacher, Admin get full scope
  return STORES_TO_SYNC;
}

// Self-healing database sanitizer: heals score records missing score_obtained/max_score, and fixes NaN profile averages
async function healDatabaseScoresAndProfiles() {
  try {
    const scores = await db.getAll("student_scores");
    if (scores && scores.length > 0) {
      let repairedCount = 0;
      for (const sc of scores) {
        let changed = false;
        const totalNum = parseFloat(sc.total_score);
        const scoreObtainedNum = parseFloat(sc.score_obtained);
        const maxScoreNum = parseFloat(sc.max_score);

        if (isNaN(scoreObtainedNum) || sc.score_obtained === undefined || sc.score_obtained === null) {
          if (!isNaN(totalNum)) {
            sc.score_obtained = totalNum;
            changed = true;
          } else if (sc.class_score !== undefined || sc.exam_score !== undefined) {
            const cls = parseFloat(sc.class_score || sc.ca_score || 0) || 0;
            const exm = parseFloat(sc.exam_score || 0) || 0;
            sc.score_obtained = cls + exm;
            sc.total_score = sc.score_obtained;
            changed = true;
          }
        }
        if (isNaN(maxScoreNum) || !sc.max_score || maxScoreNum <= 0) {
          sc.max_score = 100;
          changed = true;
        }
        if (!sc.created_at) {
          sc.created_at = sc.updated_at || new Date().toISOString();
          changed = true;
        }
        if (changed) {
          await db.putLocal("student_scores", sc);
          repairedCount++;
        }
      }
      if (repairedCount > 0) {
        console.log(`Database self-healing: repaired ${repairedCount} student score records.`);
      }
    }

    // Clean up profiles with "NaN" or "NaN%"
    const profiles = await db.getAll("profiles");
    if (profiles && profiles.length > 0) {
      for (const p of profiles) {
        let profChanged = false;
        if (p.cummulative_academic_score && String(p.cummulative_academic_score).includes("NaN")) {
          const myScores = (scores || []).filter(s => s.student_id === p.user_id);
          const validPcts = myScores.map(s => {
            const val = parseFloat(s.score_obtained);
            const mx = parseFloat(s.max_score) || 100;
            return (!isNaN(val) && mx > 0) ? (val / mx) * 100 : null;
          }).filter(x => x !== null && !isNaN(x));

          if (validPcts.length > 0) {
            const avg = validPcts.reduce((a, b) => a + b, 0) / validPcts.length;
            p.cummulative_academic_score = `${avg.toFixed(1)}%`;
          } else {
            p.cummulative_academic_score = null;
          }
          profChanged = true;
        }

        if (p.cummulative_attendance && String(p.cummulative_attendance).includes("NaN")) {
          p.cummulative_attendance = null;
          profChanged = true;
        }

        if (profChanged) {
          await db.putLocal("profiles", p);
        }
      }
    }
  } catch (e) {
    console.warn("Database self-healing notice:", e);
  }
}

let isFullFirestoreSyncRunning = false;

async function startFirestoreSync(specificStores = null) {
  if (!window.isFirebaseConfigured || !window.isFirebaseConfigured()) {
    console.log("Firebase not configured - running in local-only Mode.");
    return;
  }

  // If full listener suite is already initialized and active, do not tear down and re-query
  if (!specificStores && isFullFirestoreSyncRunning) {
    return;
  }

  console.log("Firebase configured. Initializing Firestore sync for requested stores...");
  try {
    if (firebase.apps.length === 0) {
      firebase.initializeApp(window.firebaseConfig);
    }
    await ensureFirebaseAuth();
    const firestore = firebase.firestore();

    // Trigger score self-healing asynchronously
    healDatabaseScoresAndProfiles().catch(() => {});

    // Role-based store pruning to prevent exhausting free-tier read limits
    const authUser = getActiveAuthUser();
    const currentRole = authUser ? authUser.role : null;
    const roleAllowed = getStoresForUserRole(currentRole);
    const storesToFilter = specificStores || STORES_TO_SYNC;
    const storesToProcess = storesToFilter.filter(s => roleAllowed.includes(s));

    const REALTIME_STORES = [
      "portal_messages",
      "notifications",
      "notification_user_reads",
      "broadcast_requests",
      "cms_content",
      "academic_calendar",
      "financial_transactions",
      "attendance",
      "student_scores",
      "users",
      "profiles",
      "classes",
      "enrolments",
      "class_posts",
      "staff_tasks",
      "lesson_notes",
      "assignments",
      "data_change_requests",
      "parent_profiles",
      "parent_student_relations"
    ];

    storesToProcess.forEach(storeName => {
      if (DB_READ_ONLY) {
        const PUBLIC_STORES = ["cms_content", "academic_calendar", "gallery_albums", "gallery_images"];
        if (!PUBLIC_STORES.includes(storeName)) {
          return;
        }
      }

      // Cleanly teardown any prior listener for this store to prevent duplicate listener accumulation
      if (activeFirestoreUnsubscribes[storeName]) {
        activeFirestoreUnsubscribes[storeName].forEach(unsub => {
          try { if (typeof unsub === "function") unsub(); } catch (e) {}
        });
        activeFirestoreUnsubscribes[storeName] = [];
      } else {
        activeFirestoreUnsubscribes[storeName] = [];
      }

      const lastSyncKey = `fja_last_sync_${storeName}`;
      const lastSync = localStorage.getItem(lastSyncKey);
      const isRealtime = REALTIME_STORES.includes(storeName);

      const ingestBatch = async (snapshot) => {
        if (!snapshot.empty) {
          const promises = [];
          snapshot.forEach(doc => {
            const docData = doc.data();
            promises.push((async () => {
              let resolvedDocData = await assembleFirestoreDoc(storeName, docData);
              const docId = db.getDocId(storeName, resolvedDocData) || doc.id;
              resolvedDocData = sanitizeIncomingDoc(storeName, docId, resolvedDocData);
              if (!resolvedDocData) return;
              if (docId) {
                const localDoc = await db.get(storeName, docId);
                if (shouldKeepLocalDoc(storeName, docId, localDoc, resolvedDocData)) {
                  // Only push upward if localDoc has unsaved offline changes (synced === false)
                  if (localDoc && localDoc.synced === false) {
                    try {
                      if (navigator.onLine && canWriteToCloud(storeName)) {
                        if (localDoc.is_deleted === true) {
                          await firestore.collection(storeName).doc(docId).delete();
                          await db.deleteLocal(storeName, docId);
                        } else {
                          if (storeName === "cms_content" && docId === "gallery_images") {
                            await syncGalleryImagesToFirestore(localDoc);
                          } else {
                            await firestore.collection(storeName).doc(docId).set(localDoc, { merge: true });
                          }
                          localDoc.synced = true;
                          await db.putLocal(storeName, localDoc);
                        }
                      }
                    } catch (e) {
                      console.warn(`Upward sync push for ${storeName}/${docId} skipped:`, e);
                    }
                  }
                  return;
                }
              }
              await db.putLocal(storeName, resolvedDocData);
              const event = new CustomEvent("dbSyncUpdate", { detail: { storeName, docData: resolvedDocData } });
              window.dispatchEvent(event);
            })());
          });
          await Promise.all(promises);
          localStorage.setItem(lastSyncKey, new Date().toISOString());
          const batchEvent = new CustomEvent("dbSyncUpdate", { detail: { storeName, initialBatch: true } });
          window.dispatchEvent(batchEvent);
        }
      };

      // 1. Static Store Delta Sync: Only fetch static/non-realtime collections if not polled within 5 minutes
      if (!isRealtime) {
        const fiveMinutesMs = 5 * 60 * 1000;
        const lastSyncAge = lastSync ? (Date.now() - new Date(lastSync).getTime()) : Infinity;
        if (lastSyncAge > fiveMinutesMs) {
          let staticQuery = firestore.collection(storeName);
          if (lastSync && storeName !== "academic_calendar") {
            const safetyBufferMs = 15 * 60 * 1000;
            const lastSyncMs = new Date(lastSync).getTime();
            const bufferedSyncTime = (!isNaN(lastSyncMs) && lastSyncMs > safetyBufferMs)
              ? new Date(lastSyncMs - safetyBufferMs).toISOString()
              : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            staticQuery = staticQuery.where("updated_at", ">", bufferedSyncTime);
          } else if (!lastSync) {
            staticQuery = staticQuery.limit(100);
          }
          staticQuery.get().then(ingestBatch).catch(err => {
            console.warn(`Static sync fetch for ${storeName} skipped:`, err);
          });
        }
      }

      // 2. Real-time multi-device listener across all core operational stores
      // NOTE: We DO NOT run initialQuery.get() beforehand because onSnapshot already delivers initial documents!
      if (isRealtime) {
        let baseQueries = [];
        const authUser = getActiveAuthUser();
        if (authUser) {
          const role = authUser.role;
          const myId = authUser.user_id;
          
          if (role === "Student") {
            if (["student_scores", "financial_transactions", "enrolments"].includes(storeName)) {
              baseQueries.push(firestore.collection(storeName).where("student_id", "==", myId));
            } else if (storeName === "attendance") {
              baseQueries.push(firestore.collection(storeName).where("user_id", "==", myId));
            } else if (storeName === "users" || storeName === "profiles") {
              baseQueries.push(firestore.collection(storeName).where("user_id", "==", myId));
            } else if (storeName === "portal_messages") {
              baseQueries.push(firestore.collection(storeName).where("recipient_id", "==", myId));
              baseQueries.push(firestore.collection(storeName).where("sender_id", "==", myId));
            } else if (storeName === "notifications") {
              baseQueries.push(firestore.collection(storeName).where("target_user_id", "==", myId));
              baseQueries.push(firestore.collection(storeName).where("role", "==", role));
              baseQueries.push(firestore.collection(storeName).where("role", "==", "ALL"));
            } else if (["classes", "assignments", "class_posts", "cms_content", "academic_calendar"].includes(storeName)) {
              baseQueries.push(firestore.collection(storeName));
            }
          } else if (role === "Parent") {
            if (storeName === "portal_messages") {
              baseQueries.push(firestore.collection(storeName).where("recipient_id", "==", myId));
              baseQueries.push(firestore.collection(storeName).where("sender_id", "==", myId));
            } else if (storeName === "notifications") {
              baseQueries.push(firestore.collection(storeName).where("target_user_id", "==", myId));
              baseQueries.push(firestore.collection(storeName).where("role", "==", role));
              baseQueries.push(firestore.collection(storeName).where("role", "==", "ALL"));
            } else {
              baseQueries.push(firestore.collection(storeName));
            }
          } else {
            // Staff, Teacher, SectionalHead, Finance, Admin, HeadTeacher, Proprietor
            if (storeName === "portal_messages") {
              baseQueries.push(firestore.collection(storeName).where("recipient_id", "==", myId));
              baseQueries.push(firestore.collection(storeName).where("sender_id", "==", myId));
            } else if (storeName === "notifications") {
              baseQueries.push(firestore.collection(storeName).where("target_user_id", "==", myId));
              baseQueries.push(firestore.collection(storeName).where("role", "==", role));
              baseQueries.push(firestore.collection(storeName).where("role", "==", "ALL"));
            } else if (storeName === "broadcast_requests" && (role === "Teacher" || role === "SectionalHead")) {
              baseQueries.push(firestore.collection(storeName).where("teacher_id", "==", myId));
            } else {
              baseQueries.push(firestore.collection(storeName));
            }
          }
        } else {
          baseQueries.push(firestore.collection(storeName));
        }

        // Core relational & catalog stores must NEVER be delta-filtered by timestamp or truncated by limits
        const NON_DELTA_STORES = [
          "classes",
          "enrolments",
          "users",
          "profiles",
          "parent_profiles",
          "parent_student_relations",
          "academic_calendar",
          "subjects",
          "cms_content",
          "prospectuses",
          "financial_transactions"
        ];

        // Apply Delta filter to onSnapshot queries to avoid reading the whole collection on connect
        const queries = baseQueries.map(q => {
          if (NON_DELTA_STORES.includes(storeName)) return q;
          if (lastSync) {
            const safetyBufferMs = 15 * 60 * 1000;
            const lastSyncMs = new Date(lastSync).getTime();
            const bufferedSyncTime = (!isNaN(lastSyncMs) && lastSyncMs > safetyBufferMs)
              ? new Date(lastSyncMs - safetyBufferMs).toISOString()
              : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            return q.where("updated_at", ">", bufferedSyncTime);
          } else {
            // Unsynced device initial connect: bound query size
            return q.limit(300);
          }
        });

        queries.forEach(q => {
          const unsub = q.onSnapshot(snapshot => {
            snapshot.docChanges().forEach(async (change) => {
              const docData = change.doc.data();
              if (change.type === "added" || change.type === "modified") {
                let resolvedDocData = await assembleFirestoreDoc(storeName, docData);
                const docId = change.doc.id || db.getDocId(storeName, resolvedDocData);
                resolvedDocData = sanitizeIncomingDoc(storeName, docId, resolvedDocData);
                if (!resolvedDocData) return;
                const localDoc = await db.get(storeName, docId);
                if (shouldKeepLocalDoc(storeName, docId, localDoc, resolvedDocData)) {
                  // Only push upward if localDoc has unsaved offline changes (synced === false)
                  if (localDoc && localDoc.synced === false) {
                    try {
                      if (navigator.onLine && canWriteToCloud(storeName)) {
                        if (localDoc.is_deleted === true) {
                          await firestore.collection(storeName).doc(docId).delete();
                          await db.deleteLocal(storeName, docId);
                        } else {
                          if (storeName === "cms_content" && docId === "gallery_images") {
                            await syncGalleryImagesToFirestore(localDoc);
                          } else {
                            await firestore.collection(storeName).doc(docId).set(localDoc, { merge: true });
                          }
                          localDoc.synced = true;
                          await db.putLocal(storeName, localDoc);
                        }
                      }
                    } catch (e) {}
                  }
                  return;
                }
                await db.putLocal(storeName, resolvedDocData);
                const event = new CustomEvent("dbSyncUpdate", { detail: { storeName, docData: resolvedDocData } });
                window.dispatchEvent(event);
              } else if (change.type === "removed") {
                const docId = change.doc.id;
                await db.deleteLocal(storeName, docId);
                const event = new CustomEvent("dbSyncUpdate", { detail: { storeName, docId, deleted: true } });
                window.dispatchEvent(event);
              }
            });
            localStorage.setItem(lastSyncKey, new Date().toISOString());
          }, err => {
            if (err && (err.code === "resource-exhausted" || (err.message && err.message.includes("Quota exceeded")))) {
              window.isFirestoreQuotaExceeded = true;
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("firestoreQuotaExceeded", { detail: { error: err, storeName } }));
              }
            }
            console.warn(`Firestore snapshot sync for ${storeName}:`, err);
          });
          activeFirestoreUnsubscribes[storeName].push(unsub);
        });
      }
    });

    if (!specificStores) {
      isFullFirestoreSyncRunning = true;
    }

    // Real-time listener for gallery chunk updates across clients
    try {
      const unsubChunks = firestore.collection("cms_gallery_chunks").onSnapshot(async (snapshot) => {
        if (!snapshot.empty) {
          const galleryMeta = await db.get("cms_content", "gallery_images");
          const assembled = await assembleFirestoreDoc("cms_content", { ...(galleryMeta || {}), content_key: "gallery_images", is_chunked: true });
          if (assembled && assembled.value) {
            await db.putLocal("cms_content", assembled);
            const event = new CustomEvent("dbSyncUpdate", { detail: { storeName: "cms_content", docData: assembled } });
            window.dispatchEvent(event);
          }
        }
      }, err => {
        console.warn("Gallery chunks snapshot sync notice:", err);
      });
      if (!activeFirestoreUnsubscribes["cms_gallery_chunks"]) {
        activeFirestoreUnsubscribes["cms_gallery_chunks"] = [];
      }
      activeFirestoreUnsubscribes["cms_gallery_chunks"].push(unsubChunks);
    } catch (e) {}
  } catch (err) {
    console.error("Failed to initialize Firebase database sync:", err);
  }
}

// Automatically trigger seeding and sync on load
seedMockData()
  .then(() => {
    if (DB_READ_ONLY) {
      // Public website only needs CMS data
      return startFirestoreSync(["cms_content", "academic_calendar", "gallery_albums", "gallery_images"]);
    } else {
      // Portal needs auth data initially to allow users to login
      return startFirestoreSync(["users", "profiles", "parent_profiles", "parent_student_relations"]);
    }
  })
  .catch(err => console.error("Initial seed/sync execution error:", err));

// Cross-device live reconnection & safety focus sync
let lastFocusSyncTime = 0;
async function triggerFastSafetySync() {
  const now = Date.now();
  if (now - lastFocusSyncTime < 15000) return; // 15s debounce
  lastFocusSyncTime = now;

  if (!navigator.onLine) return;
  if (!window.isFirebaseConfigured || !window.isFirebaseConfigured()) return;

  try {
    if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length > 0 && firebase.firestore) {
      try {
        await firebase.firestore().enableNetwork();
      } catch (e) {}
    }
    // Only sync unsaved offline mutations. Existing onSnapshot listeners stay active without burning read quota!
    if (typeof window.syncDirtyRecords === "function") {
      await window.syncDirtyRecords();
    }
  } catch (err) {
    console.warn("Fast safety sync notice:", err);
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      triggerFastSafetySync();
    }
  });
}
if (typeof window !== "undefined") {
  window.addEventListener("focus", triggerFastSafetySync);
  window.addEventListener("online", triggerFastSafetySync);

  // Background Heartbeat: runs every 60s while active to sync dirty offline records
  setInterval(() => {
    if (document.visibilityState === "visible" && navigator.onLine && getActiveAuthUser()) {
      triggerFastSafetySync();
    }
  }, 60000);
}

// Cross-Device Full Database Export & Import for 100% Mobile/Desktop Parity
async function exportFullDatabase() {
  const backup = {
    version: DB_VERSION,
    exported_at: new Date().toISOString(),
    stores: {}
  };
  for (const storeName of STORES_TO_SYNC) {
    try {
      const records = await db.getAll(storeName) || [];
      backup.stores[storeName] = records;
    } catch (e) {
      console.warn(`Export skipped for store ${storeName}:`, e);
    }
  }
  return backup;
}

async function importFullDatabase(backup) {
  if (!backup || !backup.stores || typeof backup.stores !== "object") {
    throw new Error("Invalid database backup bundle. Must contain a 'stores' object.");
  }
  let totalRestored = 0;
  for (const storeName in backup.stores) {
    if (STORES_TO_SYNC.includes(storeName)) {
      const records = backup.stores[storeName];
      if (Array.isArray(records)) {
        for (const item of records) {
          try {
            await db.putLocal(storeName, item);
            totalRestored++;
          } catch (e) {}
        }
      }
    }
  }
  // Immediately dispatch a comprehensive sync update event for all listeners
  window.dispatchEvent(new CustomEvent("dbSyncUpdate", { detail: { allStores: true, totalRestored } }));
  return totalRestored;
}

function getSyncCode(backup) {
  const jsonStr = JSON.stringify(backup);
  return btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode("0x" + p1);
  }));
}

function parseSyncCode(code) {
  const decodedStr = decodeURIComponent(Array.prototype.map.call(atob(code.trim()), (c) => {
    return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(""));
  return JSON.parse(decodedStr);
}

// Export objects
window.db = db;
window.db.exportFullDatabase = exportFullDatabase;
window.db.importFullDatabase = importFullDatabase;
window.db.getSyncCode = getSyncCode;
window.db.parseSyncCode = parseSyncCode;
window.exportFullDatabase = exportFullDatabase;
window.importFullDatabase = importFullDatabase;
window.getSyncCode = getSyncCode;
window.parseSyncCode = parseSyncCode;
window.db.putBatch = db.putBatch;
window.db.wipeAllStudentFeeEntries = wipeAllStudentFeeEntries;
window.wipeAllStudentFeeEntries = wipeAllStudentFeeEntries;
window.db.purgeStudentFeeEntriesCleanSlate = purgeStudentFeeEntriesCleanSlate;
window.isStudentFeeTransaction = isStudentFeeTransaction;
window.healDatabaseScoresAndProfiles = healDatabaseScoresAndProfiles;
window.initDB = initDB;
window.shouldKeepLocalDoc = shouldKeepLocalDoc;
window.startFirestoreSync = startFirestoreSync;
window.STORES_TO_SYNC = STORES_TO_SYNC;
window.ensureFirebaseAuth = ensureFirebaseAuth;
window.clearAllFirestoreListeners = clearAllFirestoreListeners;
window.triggerFastSafetySync = triggerFastSafetySync;
