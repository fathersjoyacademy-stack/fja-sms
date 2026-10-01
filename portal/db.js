// db.js - IndexedDB Engine & Seeding System

const DB_NAME = "SchoolManagementDB";
const DB_VERSION = 11;
let dbInstance = null;

// Initializer function
function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

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
    };
  });
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
        request.onsuccess = () => resolve(request.result);
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
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    });
  },

  // Get all records
  getAll(storeName) {
    return initDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => {
          let results = request.result || [];
          if (storeName === "classes") {
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
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  },

  // Save/Update record globally (IndexedDB + Cloud Firestore)
  put(storeName, obj) {
    const isOnline = navigator.onLine;
    obj.synced = isOnline;
    if (!obj.updated_at) {
      obj.updated_at = new Date().toISOString();
    }
    
    return this.putLocal(storeName, obj).then((res) => {
      if (isOnline && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
        try {
          const docId = this.getDocId(storeName, obj);
          if (docId) {
            firebase.firestore().collection(storeName).doc(docId).set(obj);
          }
        } catch (err) {
          console.warn("Firestore save failed (offline queue active):", err);
          obj.synced = false;
          this.putLocal(storeName, obj);
        }
      }
      return res;
    });
  },

  // Add record (fails if key exists)
  add(storeName, obj) {
    return initDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.add(obj);
        request.onsuccess = () => {
          if (window.isFirebaseConfigured && window.isFirebaseConfigured()) {
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
  delete(storeName, key) {
    return this.deleteLocal(storeName, key).then((res) => {
      if (window.isFirebaseConfigured && window.isFirebaseConfigured()) {
        try {
          firebase.firestore().collection(storeName).doc(key).delete();
        } catch (err) {
          console.warn("Firestore delete failed:", err);
        }
      }
      return res;
    });
  },

  // Query records matching an index
  queryByIndex(storeName, indexName, value) {
    return initDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(value);
        request.onsuccess = () => resolve(request.result || []);
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
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    });
  }
};

// Seed Mock Data
async function seedMockData() {
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
        await db.put("elibrary_books", b);
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
        await db.put("staff_tasks", t);
      }
    }

    const notifications = await db.getAll("notifications");
    if (notifications.length === 0) {
      console.log("Seeding initial notifications...");
      const seedNotifications = [
        {
          notification_id: "notif-1",
          role: "Proprietor",
          target_user_id: "",
          title: "New Online Admission",
          message: "Admission request submitted for John Mensah Jr. seeking Grade 5A.",
          target_view: "admissions-intake",
          status: "UNREAD",
          created_at: new Date().toISOString()
        },
        {
          notification_id: "notif-2",
          role: "Proprietor",
          target_user_id: "",
          title: "Weekly Sectional Evaluation Report",
          message: "New report submitted for the Pre-Primary section.",
          target_view: "proprietor-dash",
          status: "UNREAD",
          created_at: new Date().toISOString()
        }
      ];
      for (const n of seedNotifications) {
        await db.put("notifications", n);
      }
    }

    const calendars = await db.getAll("academic_calendar");
    if (calendars.length === 0) {
      console.log("Seeding initial academic calendar...");
      const seedCalendar = {
        calendar_id: "main-calendar",
        term1_start: "2026-01-05",
        term1_end: "2026-04-15",
        term2_start: "2026-05-04",
        term2_end: "2026-07-31",
        term3_start: "2026-08-03",
        term3_end: "2026-12-15",
        midterm_start: "2026-10-12",
        midterm_end: "2026-10-16",
        exam_start: "2026-11-30",
        exam_end: "2026-12-04",
        pta_date: "2026-09-19"
      };
      await db.put("academic_calendar", seedCalendar);
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
        await db.put("questionnaires", q);
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
        await db.put("custom_recipient_groups", g);
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
        await db.put("broadcast_archives", a);
      }
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
    await db.put("users", u);
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
    await db.put("profiles", p);
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
    await db.put("classes", c);
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
      value: JSON.stringify([
        {
          id: "news-1",
          title: "New E-Library & Persistent PDF Reader Launched",
          date: "2026-08-01",
          summary: "Students can now download open-access textbooks offline directly inside their dashboard, with auto-save reading history."
        },
        {
          id: "news-2",
          title: "Upcoming PTA General Term Meeting",
          date: "2026-08-15",
          summary: "All parents are invited to the Term 3 general review meeting. Digital report cards and pickup registration will be discussed."
        }
      ])
    },
    {
      content_key: "gallery_images",
      value: JSON.stringify([
        {
          album: "Academics",
          title: "Digital Coding Lab",
          url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60' fill='%231e3a8a'><rect width='100' height='60'/><text x='15' y='35' fill='white' font-family='sans-serif' font-size='8'>Computer Science Lab</text></svg>"
        },
        {
          album: "Academics",
          title: "Science Experiments Lab",
          url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60' fill='%23065f46'><rect width='100' height='60'/><text x='20' y='35' fill='white' font-family='sans-serif' font-size='8'>Practical Chemistry</text></svg>"
        },
        {
          album: "Sports",
          title: "Sports Grounds",
          url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60' fill='%23854d0e'><rect width='100' height='60'/><text x='30' y='35' fill='white' font-family='sans-serif' font-size='8'>Soccer Field</text></svg>"
        }
      ])
    },
    {
      content_key: "leadership_team",
      value: JSON.stringify([
        { name: "Mr. Ebenezer K. Mensah", role: "Proprietor & Director", image: "" },
        { name: "Mrs. Comfort A. Appiah", role: "Head Teacher", image: "" },
        { name: "John K. Larbi", role: "Administration & Accounts", image: "" }
      ])
    }
  ];

  for (const c of seedCMS) {
    await db.put("cms_content", c);
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
      await db.put("subjects", s);
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
  "subjects"
];

function startFirestoreSync() {
  if (!window.isFirebaseConfigured || !window.isFirebaseConfigured()) {
    console.log("Firebase not configured - running in local-only Mode.");
    return;
  }

  console.log("Firebase configured. Initializing real-time Firestore sync...");
  try {
    if (firebase.apps.length === 0) {
      firebase.initializeApp(window.firebaseConfig);
    }
    if (firebase.auth && typeof firebase.auth === "function") {
      try {
        firebase.auth().signInAnonymously().catch(authErr => {
          console.warn("Firebase anonymous authentication:", authErr.message || authErr);
        });
      } catch (authInitErr) {
        console.warn("Auth init skipped:", authInitErr);
      }
    }
    const firestore = firebase.firestore();

    STORES_TO_SYNC.forEach(storeName => {
      const lastSyncKey = `fja_last_sync_${storeName}`;
      const lastSync = localStorage.getItem(lastSyncKey);

      const ingestBatch = async (snapshot) => {
        if (!snapshot.empty) {
          const promises = [];
          snapshot.forEach(doc => {
            const docData = doc.data();
            promises.push(
              db.putLocal(storeName, docData).then(() => {
                const event = new CustomEvent("dbSyncUpdate", { detail: { storeName, docData } });
                window.dispatchEvent(event);
              })
            );
          });
          await Promise.all(promises);
          localStorage.setItem(lastSyncKey, new Date().toISOString());
          const batchEvent = new CustomEvent("dbSyncUpdate", { detail: { storeName, initialBatch: true } });
          window.dispatchEvent(batchEvent);
        }
      };

      // 1. Initial Cloud State Pull: Delta Query if lastSync exists, otherwise full pull & bootstrap
      let initialQuery = firestore.collection(storeName);
      if (lastSync) {
        initialQuery = initialQuery.where("updated_at", ">", lastSync);
      }

      initialQuery.get().then(async snapshot => {
        if (!lastSync && snapshot.empty) {
          // Cloud empty on first setup: bootstrap seed data
          try {
            const localRecords = await db.getAll(storeName);
            if (localRecords && localRecords.length > 0) {
              localRecords.forEach(rec => {
                const docId = db.getDocId(storeName, rec);
                if (docId) {
                  if (!rec.updated_at) rec.updated_at = new Date().toISOString();
                  firestore.collection(storeName).doc(docId).set(rec).catch(e => console.warn(`Initial seed push for ${storeName} skipped:`, e));
                }
              });
            }
          } catch (seedPushErr) {
            console.warn(`Auto-populating cloud collection ${storeName} skipped:`, seedPushErr);
          }
          localStorage.setItem(lastSyncKey, new Date().toISOString());
        } else {
          await ingestBatch(snapshot);
        }
      }).catch(err => {
        console.warn(`Delta Firestore pull for ${storeName} fell back to full fetch:`, err);
        firestore.collection(storeName).get().then(ingestBatch).catch(e => console.warn(`Full pull fallback for ${storeName} skipped:`, e));
      });

      // 2. Real-time multi-device listener
      firestore.collection(storeName).onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
          const docData = change.doc.data();
          const docId = change.doc.id;
          
          if (change.type === "added" || change.type === "modified") {
            db.putLocal(storeName, docData).then(() => {
              const event = new CustomEvent("dbSyncUpdate", { detail: { storeName, docData } });
              window.dispatchEvent(event);
            });
          } else if (change.type === "removed") {
            db.deleteLocal(storeName, docId).then(() => {
              const event = new CustomEvent("dbSyncUpdate", { detail: { storeName, docId, deleted: true } });
              window.dispatchEvent(event);
            });
          }
        });
        localStorage.setItem(lastSyncKey, new Date().toISOString());
      }, err => {
        console.warn(`Firestore snapshot sync for ${storeName}:`, err);
      });
    });
  } catch (err) {
    console.error("Failed to initialize Firebase database sync:", err);
  }
}

// Automatically trigger seeding and sync on load
seedMockData()
  .then(() => startFirestoreSync())
  .catch(err => console.error("Initial seed/sync execution error:", err));

// Export objects
window.db = db;
window.initDB = initDB;
