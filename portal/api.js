// api.js - Unified Authentication, JWT & Billing API Engines

// Universal HTML sanitizer to protect against Stored and Reflected XSS
function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
window.escapeHTML = escapeHTML;

const api = {
  currentUser: null,
  escapeHTML(str) {
    return escapeHTML(str);
  },

  // --- Centralized Academic Session & Active Term Engine ---
  async getCurrentTerm() {
    try {
      if (window.db) {
        const cal = await window.db.get("academic_calendar", "main-calendar");
        if (cal) {
          const today = new Date().toISOString().substring(0, 10);
          let activeTerm = cal.active_term || "Term 3";
          let termNum = 3;
          let isVacation = false;
          let startDate = cal.term3_start || "2026-05-04";
          let endDate = cal.term3_end || "2026-08-07";

          if (today >= cal.term1_start && today <= cal.term1_end) {
            activeTerm = "Term 1";
            termNum = 1;
            startDate = cal.term1_start;
            endDate = cal.term1_end;
          } else if (today >= cal.term2_start && today <= cal.term2_end) {
            activeTerm = "Term 2";
            termNum = 2;
            startDate = cal.term2_start;
            endDate = cal.term2_end;
          } else if (today >= cal.term3_start && today <= cal.term3_end) {
            activeTerm = "Term 3";
            termNum = 3;
            startDate = cal.term3_start;
            endDate = cal.term3_end;
          } else {
            isVacation = true;
            if (cal.active_term) activeTerm = cal.active_term;
            termNum = activeTerm === "Term 1" ? 1 : activeTerm === "Term 2" ? 2 : 3;
          }

          const termObj = {
            termName: activeTerm,
            academicYear: cal.academic_year || "2026/2027",
            termNumber: termNum,
            startDate,
            endDate,
            isVacation,
            rawCalendar: cal
          };
          window.currentTermName = activeTerm;
          return termObj;
        }
      }
    } catch (e) {
      console.warn("getCurrentTerm error:", e);
    }
    const fallbackName = window.currentTermName || "Term 1";
    return {
      termName: fallbackName,
      academicYear: "2026/2027",
      termNumber: fallbackName === "Term 1" ? 1 : fallbackName === "Term 2" ? 2 : 3,
      startDate: "2026-09-08",
      endDate: "2026-12-17",
      isVacation: false,
      rawCalendar: null
    };
  },

  getCurrentTermName() {
    return window.currentTermName || "Term 1";
  },

  async setActiveTerm(termName, academicYear) {
    if (!window.db) return false;
    try {
      let cal = await window.db.get("academic_calendar", "main-calendar");
      if (!cal) {
        cal = { calendar_id: "main-calendar" };
      }
      cal.active_term = termName;
      if (academicYear) cal.academic_year = academicYear;
      await window.db.put("academic_calendar", cal);
      window.currentTermName = termName;
      if (typeof window.dbSyncUpdate === "function") {
        window.dbSyncUpdate("academic_calendar");
      }
      return true;
    } catch (e) {
      console.error("setActiveTerm error:", e);
      return false;
    }
  },

  getCurrentUser() {
    return this.currentUser;
  },

  setCurrentUser(user) {
    this.currentUser = user;
  },

  // --- Password Hashing & Checks (SHA-256 Web Crypto) ---
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return "sha256_" + hashHex;
  },

  async checkPassword(plain, hashedOrUser, role = null, isTemporal = false) {
    if (!plain) return false;

    let hashed = hashedOrUser;
    if (typeof hashedOrUser === "object" && hashedOrUser !== null) {
      hashed = hashedOrUser.password_hash;
      role = role || hashedOrUser.role;
      isTemporal = isTemporal !== false ? isTemporal : !!hashedOrUser.is_temporal_pwd;
    }

    // 1. Check direct hash match if a hash is stored
    if (hashed && typeof hashed === "string" && hashed !== "NO_ACCESS") {
      if (hashed.startsWith("sha256_")) {
        const computed = await this.hashPassword(plain);
        if (computed === hashed) return true;
      } else if (hashed.startsWith("sim_hash_")) {
        if (hashed === "sim_hash_" + btoa(plain)) return true;
      } else if (hashed === plain) {
        return true;
      }
    }

    // 2. Role-based fallback support for standard default passwords ONLY if temporal password or uninitialized hash
    const needsFallback = isTemporal || !hashed || hashed === "NO_ACCESS";
    if (needsFallback) {
      if (role === "Student") {
        if (plain === "student123") return true;
      } else if (["Teacher", "Admin", "HeadTeacher", "Finance", "Proprietor", "SectionalHead"].includes(role)) {
        if (plain === "staff123") return true;
        if (role === "Teacher" && plain === "teacher123") return true;
        if (role === "Admin" && plain === "admin123") return true;
        if (role === "HeadTeacher" && plain === "headteacher123") return true;
        if (role === "Finance" && plain === "finance123") return true;
        if (role === "Proprietor" && plain === "proprietor123") return true;
      }
    }

    return false;
  },

  // --- JWT Session Management (Base64 Claims) ---
  generateJWT(userObj) {
    const claims = {
      user_id: userObj.user_id,
      uid: userObj.uid,
      role: userObj.role,
      name: `${userObj.first_name} ${userObj.last_name}`,
      phone: userObj.phone,
      email: userObj.email,
      exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hour expiry
    };
    return btoa(JSON.stringify(claims));
  },

  decodeToken(token) {
    try {
      const claims = JSON.parse(atob(token));
      if (Date.now() > claims.exp) {
        console.warn("Session token expired");
        return null;
      }
      return claims;
    } catch (e) {
      return null;
    }
  },

  // --- Auth Session Actions ---
  async login(uidOrPhone, password) {
    if (!window.db) {
      return { success: false, message: "Database is initializing..." };
    }

    try {
      const users = await window.db.getAll("users");
      // Search matching UID or primary Phone (supports Ghanaian normalized formats)
      const normInput = this.normalizeGhanaPhone(uidOrPhone);
      const matchingUsers = users.filter(u => u.status !== "ARCHIVED" && (
        u.uid === uidOrPhone || 
        u.phone === uidOrPhone || 
        (normInput && this.normalizeGhanaPhone(u.phone) === normInput)
      ));
      
      if (matchingUsers.length === 0) {
        return { success: false, message: "User account not found or disabled." };
      }

      // If multiple accounts share this phone (e.g. staff + ward, or multiple siblings),
      // verify password against candidates to select the authenticating account
      let user = matchingUsers[0];
      if (matchingUsers.length > 1) {
        for (const candidate of matchingUsers) {
          const valid = await this.checkPassword(password, candidate.password_hash, candidate.role, candidate.is_temporal_pwd);
          if (valid) {
            user = candidate;
            break;
          }
        }
      }

      if (user.status === "SUSPENDED") {
        return { success: false, message: "This account has been suspended." };
      }

      if (user.status === "RECORD_ONLY") {
        return { success: false, message: "This account is for record-keeping only and has no system portal access." };
      }

      // Check credentials locally
      const isValidLocally = await this.checkPassword(password, user.password_hash, user.role, user.is_temporal_pwd);

      // Check if Firebase is configured
      if (window.isFirebaseConfigured && window.isFirebaseConfigured()) {
        try {
          const authEmail = `${user.uid}@fathersjoy.com`;
          const authResult = await firebase.auth().signInWithEmailAndPassword(authEmail, password);
          const firebaseUser = authResult.user;
          console.log("Firebase Auth sign-in successful:", firebaseUser.uid);
        } catch (authErr) {
          // Auto-provision user in Firebase Auth if correct password entered locally
          if (isValidLocally) {
            try {
              const authEmail = `${user.uid}@fathersjoy.com`;
              const createResult = await firebase.auth().createUserWithEmailAndPassword(authEmail, password);
              console.log("Firebase Auth auto-provisioning successful:", createResult.user.uid);
            } catch (createErr) {
              console.warn("Firebase Auth notice (continuing with local auth):", createErr.message);
            }
          } else {
            console.error("Firebase Auth sign-in failed:", authErr);
            return { success: false, message: "Authentication failed. Incorrect password." };
          }
        }
      } else {
        // Local check fallback
        if (!isValidLocally) {
          return { success: false, message: "Incorrect password." };
        }
      }

      // If user successfully authenticated and had a legacy or temporal hash, synchronize hash
      if (isValidLocally && (!user.password_hash || user.password_hash === "NO_ACCESS" || user.is_temporal_pwd)) {
        try {
          const freshHash = await this.hashPassword(password);
          user.password_hash = freshHash;
          user.is_temporal_pwd = false;
          await window.db.put("users", user);
        } catch (syncErr) {
          console.warn("Could not upgrade temporal password hash:", syncErr);
        }
      }

      // Return session data
      const token = this.generateJWT(user);
      this.currentUser = user;
      return {
        success: true,
        token: token,
        user: {
          user_id: user.user_id,
          uid: user.uid,
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          phone: user.phone,
          gender: user.gender,
          is_temporal_pwd: user.is_temporal_pwd
        }
      };

    } catch (err) {
      console.error("Login Error:", err);
      return { success: false, message: "System error during authentication. Please retry." };
    }
  },

  // --- Collision-Proof UID Generator ---
  async generateUID(role) {
    if (!window.db) return "SCH-TEMP-0001";
    
    const users = await window.db.getAll("users");
    const currentYear = new Date().getFullYear();
    
    // Filter matching role UIDs
    const isStudent = role === "Student";
    const prefix = isStudent ? "FJS" : "FJT"; // FJS = Student, FJT = Staff
    
    const roleUsers = users.filter(u => u.uid && u.uid.startsWith(prefix + currentYear));
    
    let nextIndex = 1;
    if (roleUsers.length > 0) {
      const indices = roleUsers.map(u => {
        const idxPart = u.uid.replace(prefix + currentYear, "");
        return parseInt(idxPart, 10) || 0;
      });
      nextIndex = Math.max(...indices) + 1;
    }

    const padIndex = String(nextIndex).padStart(4, "0");
    return `${prefix}${currentYear}${padIndex}`;
  },

  // --- Single User Provisioning ---
  async createAccount(userPayload, profilePayload) {
    if (!window.db) throw new Error("Database not connected");

    // Allow shared phone numbers (e.g. staff enrolling their ward, or parent enrolling multiple wards)
    const users = await window.db.getAll("users");
    const existingWithPhone = users.filter(u => u.phone === userPayload.phone && u.status !== "ARCHIVED");
    if (existingWithPhone.length > 0) {
      console.log(`Phone ${userPayload.phone} is shared with ${existingWithPhone.length} account(s):`, 
        existingWithPhone.map(u => `${u.first_name} ${u.last_name} (${u.role})`).join(", "));
    }

    // Auto generate UID
    const uid = await this.generateUID(userPayload.role);
    const userId = "u-" + Math.random().toString(36).substring(2, 11);
    
    const isOther = userPayload.role === "Other";
    const isStudent = userPayload.role === "Student";
    
    // Default fallback password: for students "student123", for staff "staff123" (or provided custom password)
    const defaultPassword = userPayload.password || (isStudent ? "student123" : "staff123");
    const passwordHash = isOther ? "NO_ACCESS" : await this.hashPassword(defaultPassword);

    const newUser = {
      user_id: userId,
      uid: uid,
      role: userPayload.role,
      first_name: userPayload.first_name,
      other_name: userPayload.other_name || "",
      last_name: userPayload.last_name,
      gender: userPayload.gender || "Male",
      email: userPayload.email || null,
      phone: userPayload.phone,
      password_hash: passwordHash,
      is_temporal_pwd: userPayload.password ? false : (isOther ? false : true),
      status: isOther ? "RECORD_ONLY" : "ACTIVE",
      date_of_birth: userPayload.date_of_birth || null,
      created_at: new Date().toISOString()
    };

    const newProfile = {
      profile_id: "p-" + Math.random().toString(36).substring(2, 11),
      user_id: userId,
      photo_url: profilePayload.photo_url || "",
      emergency_contact: JSON.stringify(profilePayload.emergency_contact || {}),
      address: profilePayload.address || "",
      father_name: profilePayload.father_name || "",
      father_occupation: profilePayload.father_occupation || "",
      father_phone: profilePayload.father_phone || "",
      mother_name: profilePayload.mother_name || "",
      mother_occupation: profilePayload.mother_occupation || "",
      mother_phone: profilePayload.mother_phone || "",
      father_details: JSON.stringify(profilePayload.father_details || { name: profilePayload.father_name || "", occupation: profilePayload.father_occupation || "", phone: profilePayload.father_phone || "" }),
      mother_details: JSON.stringify(profilePayload.mother_details || { name: profilePayload.mother_name || "", occupation: profilePayload.mother_occupation || "", phone: profilePayload.mother_phone || "" }),
      base_salary: parseFloat(profilePayload.base_salary) || 0.00,
      allowances: parseFloat(profilePayload.allowances) || 0.00,
      section: profilePayload.section || "",
      appointment_date: profilePayload.appointment_date || new Date().toISOString().split("T")[0]
    };

    // Use window.db.put to ensure proper IndexedDB persistence + Firestore cloud synchronization across devices
    await window.db.put("users", newUser);
    await window.db.put("profiles", newProfile);

    // Parent details normalization write
    if (newUser.role === "Student") {
      try {
        let parentName = profilePayload.father_name || profilePayload.mother_name || "";
        let parentPhone = profilePayload.father_phone || profilePayload.mother_phone || "";
        let parentRelation = profilePayload.father_name ? "Father" : (profilePayload.mother_name ? "Mother" : "Guardian");
        let parentEmail = "";
        const emergency = profilePayload.emergency_contact;
        if (emergency && !parentName) {
          if (emergency.primary) {
            parentName = `${emergency.primary.first_name || ""} ${emergency.primary.last_name || ""}`.trim();
            parentPhone = emergency.primary.phone || "";
            parentRelation = emergency.primary.relation || "Guardian";
            parentEmail = emergency.primary.email || "";
          } else {
            parentName = emergency.name || "";
            parentPhone = emergency.phone || "";
            parentRelation = emergency.relation || "Guardian";
            parentEmail = userPayload.email || "";
          }
        }

        if (!parentName && userPayload.phone) {
          parentName = "Guardian of " + userPayload.first_name;
          parentPhone = userPayload.phone;
        }

        if (parentName && parentPhone) {
          const normParentPhone = this.normalizeGhanaPhone(parentPhone);
          const parents = await window.db.getAll("parent_profiles");
          let targetParent = parents.find(p => p.phone === parentPhone || (normParentPhone && this.normalizeGhanaPhone(p.phone) === normParentPhone));
          let pId = "";

          if (targetParent) {
            pId = targetParent.parent_id;
          } else {
            // Check if an existing staff or parent user has this phone number
            const existingUserParent = users.find(u => (u.phone === parentPhone || (normParentPhone && this.normalizeGhanaPhone(u.phone) === normParentPhone)) && u.role !== "Student");
            if (existingUserParent) {
              parentName = `${existingUserParent.first_name} ${existingUserParent.last_name}`.trim();
              parentEmail = existingUserParent.email || parentEmail;
              if (existingUserParent.role === "Teacher" || existingUserParent.role === "HeadTeacher" || existingUserParent.role === "Admin" || existingUserParent.role === "Finance" || existingUserParent.role === "Proprietor") {
                parentRelation = "Staff Parent";
              }
            }

            pId = "p-parent-" + Math.random().toString(36).substring(2, 9);
            const parentRecord = {
              parent_id: pId,
              first_name: parentName.split(" ")[0] || parentName,
              last_name: parentName.split(" ").slice(1).join(" ") || "Guardian",
              phone: parentPhone,
              email: parentEmail,
              address: profilePayload.address || ""
            };
            await window.db.put("parent_profiles", parentRecord);
          }
          
          const relRecord = {
            relation_id: "r-rel-" + Math.random().toString(36).substring(2, 9),
            parent_id: pId,
            student_id: newUser.user_id,
            relation_type: parentRelation
          };
          await window.db.put("parent_student_relations", relRecord);
        }
      } catch (err) {
        console.warn("Parent normalization write failed:", err);
      }
    }

    // Sync to Cloud Firestore if online
    if (window.isFirebaseConfigured && window.isFirebaseConfigured()) {
      try {
        firebase.firestore().collection("users").doc(newUser.user_id).set(newUser);
        firebase.firestore().collection("profiles").doc(newProfile.profile_id).set(newProfile);
      } catch (err) {
        console.warn("Firestore creation sync failed:", err);
      }
    }

    // Write audit log trail
    await window.db.put("audit_logs", {
      audit_id: "a-audit-" + Date.now(),
      timestamp: new Date().toISOString(),
      action_details: JSON.stringify({
        action: "CREATE_USER",
        role: newUser.role,
        uid: newUser.uid,
        name: `${newUser.first_name} ${newUser.last_name}`,
        timestamp: new Date().toISOString()
      })
    });

    // Generate link for password initialization
    if (newUser.role !== "Other") {
      const origin = (typeof window !== "undefined" && window.location && window.location.origin) ? window.location.origin : "https://fja-sms.web.app";
      const setupLink = `${origin}/portal/index.html?action=set-password&uid=${uid}&userId=${userId}`;

      // Dispatch Hubtel SMS containing the setup link
      await this.sendHubtelSMS(
        newUser.phone,
        `Hello ${newUser.first_name}, your Father's Joy Academy account is active. Login ID: ${uid}. To customize your password for the portal, visit: ${setupLink}`
      );
    }

    return newUser;
  },

  // --- Reset Password ---
  async resetPassword(userId) {
    if (!window.db) throw new Error("Database not connected");

    const user = await window.db.get("users", userId);
    if (!user) throw new Error("User does not exist");

    user.status = "ACTIVE"; // Keep account active
    user.is_temporal_pwd = true;

    await window.db.put("users", user);

    // Generate link for password setup
    const setupLink = `${window.location.origin}/portal/index.html?action=set-password&uid=${user.uid}&userId=${userId}`;

    // Dispatch Hubtel SMS containing the setup link
    await this.sendHubtelSMS(
      user.phone,
      `Hello, your school account password has been reset. You can set your new password using this link: ${setupLink}`
    );

    return setupLink;
  },

  // --- User Archival (Disables login, cleans roster, preserves history) ---
  async archiveUser(userId) {
    if (!window.db) throw new Error("Database not connected");

    const user = await window.db.get("users", userId);
    if (!user) throw new Error("User does not exist");

    user.status = "ARCHIVED";
    await window.db.put("users", user);

    // If student, push owed fees to bad debt and remove from enrolments
    if (user.role === "Student") {
      await this.pushStudentDebtToBadDebt(userId, user);
      const enrolments = await window.db.getAll("enrolments");
      const studentEnrols = enrolments.filter(e => e.student_id === userId);
      for (const en of studentEnrols) {
        await window.db.delete("enrolments", en.enrolment_id);
      }
    }

    // If teacher, clear from classes
    if (user.role === "Teacher") {
      const classes = await window.db.getAll("classes");
      const teacherClasses = classes.filter(c => c.class_teacher_id === userId);
      for (const cl of teacherClasses) {
        cl.class_teacher_id = ""; // Unassign teacher
        await window.db.put("classes", cl);
      }
    }

    // Write audit log trail
    await window.db.put("audit_logs", {
      audit_id: "a-audit-" + Date.now(),
      timestamp: new Date().toISOString(),
      action_details: JSON.stringify({
        action: "ARCHIVE_USER",
        user_id: user.user_id,
        uid: user.uid,
        name: `${user.first_name} ${user.last_name}`,
        timestamp: new Date().toISOString()
      })
    });

    return true;
  },

  // --- Regional Payroll Calculator (PAYE & SSNIT - GRA Act 1178 2026 Schedule) ---
  calculatePayroll(baseSalary, allowances, bonus = 0, advance = 0) {
    const gross = (parseFloat(baseSalary) || 0) + (parseFloat(allowances) || 0) + (parseFloat(bonus) || 0);
    const ssnit = parseFloat((gross * 0.055).toFixed(2)); // 5.5% employee SSNIT Tier 1 contribution
    
    let remaining = Math.max(0, gross - ssnit);
    let paye = 0;
    
    // Band 1: First 588.00 @ 0%
    const band1 = Math.min(remaining, 588.00);
    remaining -= band1;
    
    // Band 2: Next 80.00 @ 5.00%
    if (remaining > 0) {
      const band2 = Math.min(remaining, 80.00);
      paye += band2 * 0.05;
      remaining -= band2;
    }
    
    // Band 3: Next 100.00 @ 10.00%
    if (remaining > 0) {
      const band3 = Math.min(remaining, 100.00);
      paye += band3 * 0.10;
      remaining -= band3;
    }
    
    // Band 4: Next 2,900.00 @ 17.50%
    if (remaining > 0) {
      const band4 = Math.min(remaining, 2900.00);
      paye += band4 * 0.175;
      remaining -= band4;
    }
    
    // Band 5: Next 16,000.00 @ 25.00%
    if (remaining > 0) {
      const band5 = Math.min(remaining, 16000.00);
      paye += band5 * 0.25;
      remaining -= band5;
    }
    
    // Band 6: Next 30,334.00 @ 30.00%
    if (remaining > 0) {
      const band6 = Math.min(remaining, 30334.00);
      paye += band6 * 0.30;
      remaining -= band6;
    }
    
    // Band 7: Exceeding 50,000.00 @ 35.00%
    if (remaining > 0) {
      paye += remaining * 0.35;
    }
    
    paye = parseFloat(paye.toFixed(2));
    const preNet = gross - ssnit - paye;
    const netPay = parseFloat((preNet - (parseFloat(advance) || 0)).toFixed(2));
    
    return {
      gross: parseFloat(gross.toFixed(2)),
      ssnit: ssnit,
      paye: paye,
      netPay: netPay
    };
  },

  // --- SMS & Communications Engine ---
  smsQueue: [],
  pushQueue: [],

  /**
   * Ghanaian Phone Number Normalizer
   * Standardizes any Ghanaian phone format to 233XXXXXXXXX
   */
  normalizeGhanaPhone(phone) {
    if (!phone) return "";
    let digits = String(phone).replace(/\D/g, "");
    if (digits.startsWith("0")) {
      digits = "233" + digits.substring(1);
    } else if (digits.startsWith("233")) {
      // already in standard format
    } else if (digits.length === 9) {
      digits = "233" + digits;
    }
    return digits;
  },

  /**
   * Unified SMS Dispatcher
   * - Normalizes phone to international Ghana standard (233...)
   * - Securely invokes Firebase Cloud Function (sendSchoolSMS) with HTTP gateway fallback
   * - Tracks Hubtel response status (including status 12 for payment required)
   * - Updates local queue, dispatches sms-logged event, and syncs to In-App Notification Center
   */
  async sendSMS(phone, message) {
    const normalizedPhone = this.normalizeGhanaPhone(phone) || phone;
    let gatewayResult = null;

    // Dispatch via backend Firebase Cloud Function if online
    if (navigator.onLine) {
      try {
        if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length > 0 && typeof firebase.functions === "function") {
          const sendFn = firebase.functions().httpsCallable("sendSchoolSMS");
          const resp = await sendFn({ recipientPhone: normalizedPhone, message });
          gatewayResult = resp.data;
        }
      } catch (cfErr) {
        console.warn("Callable sendSchoolSMS notice (attempting HTTP fallback):", cfErr.message || cfErr);
      }

      if (!gatewayResult) {
        try {
          const projectId = (window.firebaseConfig && window.firebaseConfig.projectId) || "fja-sms";
          const httpUrl = `https://us-central1-${projectId}.cloudfunctions.net/apiSendSMS`;
          const res = await fetch(httpUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": "fja-sms-authorized-key-2026"
            },
            body: JSON.stringify({ recipientPhone: normalizedPhone, message })
          });
          if (res.ok || res.status === 400 || res.status === 402) {
            gatewayResult = await res.json();
          }
        } catch (httpErr) {
          // Functions uninitialized or running in offline mode
        }
      }

      if (!gatewayResult) {
        try {
          const cfg = (typeof window !== "undefined" && window.hubtelConfig) ? window.hubtelConfig : {};
          const clientId = cfg.clientId || "cvnhobyo";
          const clientSecret = cfg.clientSecret || "rnrxvuxd";
          const from = cfg.senderId || "FathersJoy";
          const endpoint = cfg.directEndpoint || "https://sms.hubtel.com/v1/messages/send";

          const directUrl = `${endpoint}?clientsecret=${clientSecret}&clientid=${clientId}&from=${encodeURIComponent(from)}&to=${normalizedPhone}&content=${encodeURIComponent(message)}`;
          
          await fetch(directUrl, { mode: "no-cors", method: "GET" });
          gatewayResult = {
            success: true,
            status: 0,
            statusDescription: "Hubtel: Dispatched via Direct Gateway"
          };
        } catch (directErr) {
          console.warn("Direct Hubtel Gateway dispatch notice:", directErr);
        }
      }
    }

    const isSuccess = gatewayResult ? !!gatewayResult.success : true;
    let statusDesc = "Delivered (Virtual Gateway)";
    if (gatewayResult) {
      if (gatewayResult.statusDescription) {
        statusDesc = gatewayResult.statusDescription;
      } else if (gatewayResult.status === 12) {
        statusDesc = "Hubtel: Payment required on account";
      } else if (gatewayResult.status === 0) {
        statusDesc = "Hubtel: Delivered Successfully";
      }
    }

    const formatted = `[SMS GATEWAY] To: ${normalizedPhone} (raw: ${phone}) | Status: ${statusDesc} | Msg: ${message}`;
    console.log(formatted);

    const queueEntry = {
      phone: normalizedPhone,
      rawPhone: phone,
      message: message,
      gateway: gatewayResult,
      status: statusDesc,
      timestamp: new Date().toISOString()
    };
    this.smsQueue.push(queueEntry);

    // Dispatch custom event to notify SMS visual components and consoles
    const event = new CustomEvent("sms-logged", {
      detail: {
        phone: normalizedPhone,
        rawPhone: phone,
        message,
        status: statusDesc,
        success: isSuccess,
        timestamp: new Date().toLocaleTimeString()
      }
    });
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(event);
    }

    // Automatically deliver a copy into in-system Notification Center
    try {
      if (window.db) {
        const users = await window.db.getAll("users") || [];
        const matchingUsers = users.filter(u => {
          if (!u.phone) return false;
          return u.phone === phone || this.normalizeGhanaPhone(u.phone) === normalizedPhone;
        });

        if (matchingUsers.length > 0) {
          for (const u of matchingUsers) {
            const notifId = "notif-sms-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4);
            await window.db.put("notifications", {
              notification_id: notifId,
              role: u.role,
              target_user_id: u.user_id,
              target_phone: phone,
              title: "SMS Notification",
              message: message,
              target_view: "dashboard",
              status: "UNREAD",
              created_at: new Date().toISOString()
            });
          }
        } else {
          const notifId = "notif-sms-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4);
          await window.db.put("notifications", {
            notification_id: notifId,
            role: "ALL",
            target_phone: phone,
            title: "SMS Notification",
            message: message,
            target_view: "dashboard",
            status: "UNREAD",
            created_at: new Date().toISOString()
          });
        }

        if (typeof window.updateNotificationBadge === "function") {
          window.updateNotificationBadge();
        }
      }
    } catch (err) {
      console.warn("Failed to write SMS copy to notification center:", err);
    }

    return isSuccess;
  },

  async simulateSMS(phone, message) {
    return this.sendSMS(phone, message);
  },

  async sendHubtelSMS(phone, message) {
    return this.sendSMS(phone, message);
  },

  simulatePush(title, body) {
    const formatted = `[PWA WEB PUSH] Title: ${title} | Body: ${body}`;
    console.log(formatted);
    this.pushQueue.push({ title, body, timestamp: new Date().toISOString() });

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  },

  /**
   * Builds rich recipient context by cross-referencing:
   * - parent_student_relations
   * - parent_profiles
   * - users
   * - student emergency contacts in profiles
   * - financial_transactions
   * - attendance (current school week)
   */
  async buildRecipientContext(recipient, data = {}) {
    const users = data.users || (window.db ? await window.db.getAll("users") : []) || [];
    const profiles = data.profiles || (window.db ? await window.db.getAll("profiles") : []) || [];
    const parentProfiles = data.parentProfiles || (window.db ? await window.db.getAll("parent_profiles") : []) || [];
    const parentRelations = data.parentRelations || (window.db ? await window.db.getAll("parent_student_relations") : []) || [];
    const transactions = data.transactions || (window.db ? await window.db.getAll("financial_transactions") : []) || [];
    const attendance = data.attendance || (window.db ? await window.db.getAll("attendance") : []) || [];

    const rec = recipient || {};
    const normRecPhone = this.normalizeGhanaPhone(rec.phone);

    let parentName = "";
    let linkedStudents = [];

    if (rec.role === "Parent") {
      parentName = `${rec.first_name || ""} ${rec.last_name || ""}`.trim() || "Parent/Guardian";

      // 1. Find parent_id(s) from parent_profiles matching phone/email/user_id
      const matchedPIds = new Set();
      if (rec.user_id) matchedPIds.add(rec.user_id);
      if (rec.uid) matchedPIds.add(rec.uid);
      
      parentProfiles.forEach(pp => {
        const normPPhone = this.normalizeGhanaPhone(pp.phone);
        if (
          (normPPhone && normPPhone === normRecPhone) ||
          (pp.phone && pp.phone === rec.phone) ||
          (pp.email && rec.email && pp.email.toLowerCase() === rec.email.toLowerCase())
        ) {
          matchedPIds.add(pp.parent_id);
        }
      });

      // 2. Find students from parent_student_relations
      const matchedStudentIds = new Set();
      parentRelations.forEach(pr => {
        if (matchedPIds.has(pr.parent_id)) {
          matchedStudentIds.add(pr.student_id);
        }
      });

      // 3. Find students from profiles emergency contact phone or name
      profiles.forEach(p => {
        if (p.emergency_contact) {
          let ec = p.emergency_contact;
          if (typeof ec === "string") {
            try { ec = JSON.parse(ec); } catch(e) {}
          }
          const ecPhone = ec?.primary?.phone || ec?.phone || "";
          const normEcPhone = this.normalizeGhanaPhone(ecPhone);
          if (
            (normEcPhone && normEcPhone === normRecPhone) ||
            (ecPhone && ecPhone === rec.phone)
          ) {
            matchedStudentIds.add(p.user_id);
          }
        }
      });

      // 4. Find students with matching phone in users table
      users.forEach(u => {
        if (u.role === "Student" && u.phone) {
          const normStudPhone = this.normalizeGhanaPhone(u.phone);
          if ((normStudPhone && normStudPhone === normRecPhone) || u.phone === rec.phone) {
            matchedStudentIds.add(u.user_id);
          }
        }
      });

      linkedStudents = users.filter(u => u.role === "Student" && matchedStudentIds.has(u.user_id));

    } else if (rec.role === "Student") {
      linkedStudents = [rec];

      // Find parent for this student
      let foundParentName = "";
      const rel = parentRelations.find(pr => pr.student_id === rec.user_id);
      if (rel) {
        const pp = parentProfiles.find(p => p.parent_id === rel.parent_id);
        if (pp) {
          foundParentName = `${pp.first_name || ""} ${pp.last_name || ""}`.trim();
        }
        if (!foundParentName) {
          const pu = users.find(u => u.user_id === rel.parent_id);
          if (pu) foundParentName = `${pu.first_name || ""} ${pu.last_name || ""}`.trim();
        }
      }

      if (!foundParentName) {
        const prof = profiles.find(p => p.user_id === rec.user_id);
        if (prof && prof.emergency_contact) {
          let ec = prof.emergency_contact;
          if (typeof ec === "string") {
            try { ec = JSON.parse(ec); } catch(e) {}
          }
          foundParentName = (ec?.primary ? `${ec.primary.first_name || ""} ${ec.primary.last_name || ""}`.trim() : (ec?.name || "")).trim();
        }
      }

      if (!foundParentName && rec.phone) {
        const pu = users.find(u => u.role === "Parent" && (u.phone === rec.phone || this.normalizeGhanaPhone(u.phone) === normRecPhone));
        if (pu) foundParentName = `${pu.first_name || ""} ${pu.last_name || ""}`.trim();
      }

      parentName = foundParentName || "Parent/Guardian";
    } else {
      parentName = `${rec.first_name || ""} ${rec.last_name || ""}`.trim() || rec.username || "Staff Member";
      linkedStudents = [];
    }

    // Student names string
    const studentName = linkedStudents.length > 0
      ? linkedStudents.map(s => `${s.first_name || ""} ${s.last_name || ""}`.trim()).join(", ")
      : (rec.role === "Parent" ? "Your Child" : "N/A");

    // Fees calculation
    let totalPaid = 0;
    let totalArrears = 0;
    linkedStudents.forEach(s => {
      const sFin = this.getStudentFinancials(s.user_id, transactions);
      totalPaid += (sFin.totalPaid || 0);
      totalArrears += (sFin.netArrears || 0);
    });

    // Attendance calculation: Absences in current school week (Monday to today)
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const mondayStr = monday.toISOString().split("T")[0];
    const nowStr = now.toISOString().split("T")[0];

    const studentIds = linkedStudents.map(s => s.user_id);
    const weeklyAbsences = attendance.filter(a => {
      const isAbsent = a.status && a.status.toUpperCase() === "ABSENT";
      return studentIds.includes(a.user_id) && isAbsent && a.date >= mondayStr && a.date <= nowStr;
    });
    const daysAbsentedCount = weeklyAbsences.length;
    const daysAbsentedStr = `${daysAbsentedCount} day${daysAbsentedCount === 1 ? '' : 's'}`;

    return {
      parent_name: parentName,
      student_name: studentName,
      fees_paid: `GH¢ ${totalPaid.toFixed(2)}`,
      outstanding_fees: `GH¢ ${totalArrears.toFixed(2)}`,
      days_absented: daysAbsentedStr,
      uid: rec.uid || rec.user_id || "N/A",
      name: rec.first_name || parentName.split(" ")[0] || "User",
      phone: rec.phone || "",
      linkedStudents
    };
  },

  /**
   * Resolves tags within a broadcast template string:
   * Supports both #tag# and {tag} notations case-insensitively.
   */
  resolveBroadcastTags(template, context = {}) {
    if (!template) return "";
    let msg = String(template);

    const replacements = {
      parent_name: context.parent_name || "Parent/Guardian",
      student_name: context.student_name || "Student",
      fees_paid: context.fees_paid !== undefined ? context.fees_paid : "GH¢ 0.00",
      outstanding_fees: context.outstanding_fees !== undefined ? context.outstanding_fees : "GH¢ 0.00",
      fees_owed: context.outstanding_fees !== undefined ? context.outstanding_fees : "GH¢ 0.00",
      arrears: context.outstanding_fees !== undefined ? context.outstanding_fees : "GH¢ 0.00",
      days_absented: context.days_absented !== undefined ? context.days_absented : "0 days",
      days_absent: context.days_absented !== undefined ? context.days_absented : "0 days",
      uid: context.uid || "N/A",
      name: context.name || context.parent_name || ""
    };

    for (const [key, val] of Object.entries(replacements)) {
      const hashRegex = new RegExp("#" + key + "#", "gi");
      const braceRegex = new RegExp("{" + key + "}", "gi");
      const safeVal = String(val);
      msg = msg.replace(hashRegex, () => safeVal).replace(braceRegex, () => safeVal);
    }
    return msg;
  },

  /**
   * Resolves the parent/guardian contact for any given student across all data sources:
   * 1. parent_student_relations -> parent_profiles or users
   * 2. profiles emergency_contact (primary.phone or phone)
   * 3. users table matching parent phone
   * 4. fallback: student's own phone (which in this school is the parent/guardian's primary phone)
   */
  resolveParentContactForStudent(stud, data = {}) {
    if (!stud) return null;
    const users = data.users || [];
    const profiles = data.profiles || [];
    const parentProfiles = data.parentProfiles || [];
    const parentRelations = data.parentRelations || [];
    const normStudPhone = this.normalizeGhanaPhone(stud.phone);

    // 1. Check parent_student_relations
    const rel = parentRelations.find(r => r.student_id === stud.user_id);
    if (rel) {
      const pp = parentProfiles.find(p => p.parent_id === rel.parent_id);
      if (pp && pp.phone) {
        return {
          user_id: pp.parent_id,
          uid: pp.parent_id,
          first_name: pp.first_name,
          last_name: pp.last_name,
          phone: pp.phone,
          email: pp.email || "",
          role: "Parent",
          status: "ACTIVE",
          linkedStudents: [stud]
        };
      }
      const pu = users.find(u => u.user_id === rel.parent_id);
      if (pu && pu.phone) {
        return {
          ...pu,
          role: "Parent",
          linkedStudents: [stud]
        };
      }
    }

    // 2. Check student's emergency contact in profiles
    const prof = profiles.find(p => p.user_id === stud.user_id);
    if (prof && prof.emergency_contact) {
      let ec = prof.emergency_contact;
      if (typeof ec === "string") {
        try { ec = JSON.parse(ec); } catch(e) {}
      }
      const ecPhone = ec?.primary?.phone || ec?.phone;
      const ecName = (ec?.primary ? `${ec.primary.first_name || ""} ${ec.primary.last_name || ""}`.trim() : (ec?.name || "")).trim();
      if (ecPhone) {
        const parts = ecName ? ecName.split(" ") : ["Parent/Guardian", ""];
        return {
          user_id: "p-ec-" + stud.user_id,
          uid: "PAR-" + (stud.uid || stud.user_id),
          first_name: parts[0] || "Parent of",
          last_name: parts.slice(1).join(" ") || `${stud.first_name} ${stud.last_name}`,
          phone: ecPhone,
          email: ec?.primary?.email || "",
          role: "Parent",
          status: "ACTIVE",
          linkedStudents: [stud]
        };
      }
    }

    // 3. Check users table for user with role Parent having matching phone
    if (normStudPhone) {
      const parentUser = users.find(u => u.role === "Parent" && this.normalizeGhanaPhone(u.phone) === normStudPhone && u.status !== "ARCHIVED");
      if (parentUser) {
        return {
          ...parentUser,
          linkedStudents: [stud]
        };
      }
    }

    // 4. Fallback: student's own phone is the parent/guardian's primary phone
    if (stud.phone) {
      return {
        user_id: "p-stud-" + stud.user_id,
        uid: "PAR-" + (stud.uid || stud.user_id),
        first_name: "Parent/Guardian of",
        last_name: `${stud.first_name} ${stud.last_name}`,
        phone: stud.phone,
        email: stud.email || "",
        role: "Parent",
        status: "ACTIVE",
        linkedStudents: [stud]
      };
    }

    return null;
  },

  /**
   * Resolves target recipients for SMS Broadcasts with 2-level filter architecture:
   * @param {string} generalScope - General School Grouping (ALL_PARENTS_STUDENTS, ALL_STAFF, SECTION_JHS, SECTION_UPPER_PRIMARY, SECTION_LOWER_PRIMARY, SECTION_NURSERY, CLASS_<id>)
   * @param {string} conditionScope - Conditional Grouping (COND_ALL, COND_ACTIVE, COND_SECTIONAL_HEADS, COND_ARREARS, COND_ABSENT, COND_CUSTOM, BIRTHDAYS)
   * @param {string|Array} customGroupIdOrMembers - Optional group_id or array of user_ids for COND_CUSTOM
   * @param {object} dataCache - Optional pre-fetched stores cache
   */
  async getBroadcastRecipients(generalScope = "ALL_PARENTS_STUDENTS", conditionScope = "COND_ALL", customGroupIdOrMembers = null, dataCache = {}) {
    // Handle legacy single-string calls and cache parameter shifting
    if (typeof conditionScope === "object" && conditionScope !== null && !Array.isArray(conditionScope)) {
      dataCache = conditionScope;
      conditionScope = "COND_ALL";
    }

    // Map legacy single-string target values for 100% backward compatibility
    let genTarget = generalScope;
    let condTarget = conditionScope;

    if (generalScope === "ALL_PARENTS") {
      genTarget = "ALL_PARENTS_STUDENTS";
      condTarget = "COND_ALL";
    } else if (generalScope === "ARREARS_PARENTS") {
      genTarget = "ALL_PARENTS_STUDENTS";
      condTarget = "COND_ARREARS";
    } else if (generalScope === "ABSENCE_ALERTS") {
      genTarget = "ALL_PARENTS_STUDENTS";
      condTarget = "COND_ABSENT";
    } else if (generalScope === "ALL_TEACHERS") {
      genTarget = "ALL_STAFF";
      condTarget = "COND_ALL";
    } else if (generalScope === "SECTIONAL_HEADS") {
      genTarget = "ALL_STAFF";
      condTarget = "COND_SECTIONAL_HEADS";
    } else if (generalScope === "BIRTHDAYS") {
      genTarget = "ALL_USERS";
      condTarget = "BIRTHDAYS";
    } else if (generalScope === "NURSERY" || generalScope === "PRE_PRIMARY" || generalScope === "SECTION_PRE_PRIMARY") {
      genTarget = "SECTION_PRE_PRIMARY";
    } else if (generalScope === "LOWER_PRIMARY") {
      genTarget = "SECTION_LOWER_PRIMARY";
    } else if (generalScope === "UPPER_PRIMARY") {
      genTarget = "SECTION_UPPER_PRIMARY";
    } else if (generalScope === "JHS") {
      genTarget = "SECTION_JHS";
    }

    const users = dataCache.users || (window.db ? await window.db.getAll("users") : []) || [];
    const profiles = dataCache.profiles || (window.db ? await window.db.getAll("profiles") : []) || [];
    const parentProfiles = dataCache.parentProfiles || (window.db ? await window.db.getAll("parent_profiles") : []) || [];
    const parentRelations = dataCache.parentRelations || (window.db ? await window.db.getAll("parent_student_relations") : []) || [];
    const transactions = dataCache.transactions || (window.db ? await window.db.getAll("financial_transactions") : []) || [];
    const attendance = dataCache.attendance || (window.db ? await window.db.getAll("attendance") : []) || [];
    const classes = dataCache.classes || (window.db ? await window.db.getAll("classes") : []) || [];
    const enrolments = dataCache.enrolments || (window.db ? await window.db.getAll("enrolments") : []) || [];
    const customGroups = dataCache.customGroups || (window.db ? await window.db.getAll("custom_recipient_groups") : []) || [];

    const cache = { users, profiles, parentProfiles, parentRelations, transactions, attendance, classes, enrolments, customGroups };

    const activeStudents = users.filter(u => u.role === "Student" && u.status !== "ARCHIVED");
    const activeParents = users.filter(u => u.role === "Parent" && u.status !== "ARCHIVED");
    const staffRoles = ["Teacher", "SectionalHead", "HeadTeacher", "Admin", "Finance", "Proprietor"];

    let candidateUsers = [];
    let isStaffScope = false;

    // --- 1. FILTER GROUP 1: GENERAL SCHOOL GROUPINGS ---
    if (genTarget === "ALL_STAFF" || genTarget === "ALL_TEACHERS") {
      isStaffScope = true;
      candidateUsers = users.filter(u => staffRoles.includes(u.role) && u.status !== "ARCHIVED");
    } else if (genTarget === "ALL_USERS") {
      candidateUsers = users.filter(u => u.status !== "ARCHIVED");
    } else if (genTarget === "ALL_PARENTS_STUDENTS" || genTarget === "ALL_STUDENTS") {
      candidateUsers = activeStudents;
    } else if (genTarget.startsWith("SECTION_") || ["NURSERY", "PRE_PRIMARY", "LOWER_PRIMARY", "UPPER_PRIMARY", "JHS"].includes(genTarget)) {
      let targetClassIds = [];
      const cleanSection = genTarget.replace("SECTION_", "");
      if (cleanSection === "NURSERY" || cleanSection === "PRE_PRIMARY") {
        targetClassIds = classes.filter(c => ["creche", "nursery", "kg", "kindergarten"].some(k => (c.class_name || "").toLowerCase().includes(k))).map(c => c.class_id);
      } else if (cleanSection === "LOWER_PRIMARY") {
        targetClassIds = classes.filter(c => ["primary 1", "primary 2", "primary 3", "class 1", "class 2", "class 3"].some(k => (c.class_name || "").toLowerCase().includes(k))).map(c => c.class_id);
      } else if (cleanSection === "UPPER_PRIMARY") {
        targetClassIds = classes.filter(c => ["primary 4", "primary 5", "primary 6", "class 4", "class 5", "class 6"].some(k => (c.class_name || "").toLowerCase().includes(k))).map(c => c.class_id);
      } else if (cleanSection === "JHS") {
        targetClassIds = classes.filter(c => ["jhs", "junior high"].some(k => (c.class_name || "").toLowerCase().includes(k))).map(c => c.class_id);
      }

      const studIds = enrolments.filter(e => targetClassIds.includes(e.class_id)).map(e => e.student_id);
      candidateUsers = activeStudents.filter(s => studIds.includes(s.user_id));
    } else if (genTarget.startsWith("CLASS_")) {
      const targetClassId = genTarget.replace("CLASS_", "");
      const studIds = enrolments.filter(e => e.class_id === targetClassId).map(e => e.student_id);
      candidateUsers = activeStudents.filter(s => studIds.includes(s.user_id));
    } else {
      candidateUsers = activeStudents;
    }

    // --- 2. FILTER GROUP 2: CONDITIONAL GROUPINGS ---
    if (condTarget === "COND_ACTIVE") {
      candidateUsers = candidateUsers.filter(u => u.status === "ACTIVE");
    } else if (condTarget === "COND_SECTIONAL_HEADS" || condTarget === "SECTIONAL_HEADS") {
      const shUserIds = profiles.filter(p => p.additional_role === "sectional head" || (p.section && p.section !== "non-teaching staff")).map(p => p.user_id);
      candidateUsers = users.filter(u => (u.role === "SectionalHead" || u.role === "HeadTeacher" || shUserIds.includes(u.user_id)) && u.status === "ACTIVE");
      isStaffScope = true;
    } else if (condTarget === "COND_ARREARS" || condTarget === "ARREARS_PARENTS") {
      candidateUsers = candidateUsers.filter(s => {
        if (s.role !== "Student") return false;
        const sFin = this.getStudentFinancials(s.user_id, transactions);
        return sFin && sFin.netArrears > 0;
      });
    } else if (condTarget === "COND_ABSENT" || condTarget === "ABSENCE_ALERTS") {
      const now = new Date();
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);
      const mondayStr = monday.toISOString().split("T")[0];
      const nowStr = now.toISOString().split("T")[0];

      let absentIds = attendance
        .filter(a => a.status && a.status.toUpperCase() === "ABSENT" && a.date >= mondayStr && a.date <= nowStr)
        .map(a => a.user_id);

      if (absentIds.length === 0) {
        absentIds = attendance
          .filter(a => a.status && a.status.toUpperCase() === "ABSENT")
          .map(a => a.user_id);
      }

      candidateUsers = candidateUsers.filter(s => absentIds.includes(s.user_id));
    } else if (condTarget === "COND_CUSTOM") {
      let memberIds = [];
      if (Array.isArray(customGroupIdOrMembers)) {
        memberIds = customGroupIdOrMembers;
      } else if (typeof customGroupIdOrMembers === "string") {
        const foundGroup = customGroups.find(g => g.group_id === customGroupIdOrMembers || g.group_name.toLowerCase() === customGroupIdOrMembers.toLowerCase());
        memberIds = foundGroup ? (foundGroup.member_ids || []) : [];
      }

      if (memberIds.length > 0) {
        candidateUsers = users.filter(u => memberIds.includes(u.user_id));
      }
    } else if (condTarget === "BIRTHDAYS") {
      const todayStr = new Date().toISOString().substring(5, 10);
      candidateUsers = users.filter(u => u.date_of_birth && u.date_of_birth.substring(5, 10) === todayStr && u.status === "ACTIVE");
    }

    // --- 3. RECIPIENT RESOLUTION & PARENT NORMALIZATION ---
    let recipients = [];

    if (isStaffScope) {
      recipients = candidateUsers.map(u => ({
        user_id: u.user_id,
        uid: u.uid || u.user_id,
        first_name: u.first_name,
        last_name: u.last_name,
        phone: u.phone,
        email: u.email || "",
        role: u.role,
        status: u.status || "ACTIVE"
      }));
    } else {
      // For student candidates, map to parents/guardians
      candidateUsers.forEach(candidate => {
        if (candidate.role === "Student") {
          const parent = this.resolveParentContactForStudent(candidate, cache);
          if (parent) recipients.push(parent);
        } else if (candidate.role === "Parent") {
          recipients.push(candidate);
        } else if (staffRoles.includes(candidate.role)) {
          recipients.push(candidate);
        }
      });

      // If general scope is ALL_PARENTS_STUDENTS and condition is COND_ALL, ensure direct parent profiles are included
      if (genTarget === "ALL_PARENTS_STUDENTS" && condTarget === "COND_ALL") {
        recipients.push(...activeParents);
        parentProfiles.forEach(pp => {
          if (pp.phone) {
            recipients.push({
              user_id: pp.parent_id,
              uid: pp.parent_id,
              first_name: pp.first_name,
              last_name: pp.last_name,
              phone: pp.phone,
              email: pp.email || "",
              role: "Parent",
              status: "ACTIVE"
            });
          }
        });
      }
    }

    // Deduplicate recipients by normalized phone number
    const phoneMap = new Set();
    const uniqueRecipients = [];
    for (const rec of recipients) {
      if (!rec || !rec.phone) continue;
      const normPhone = this.normalizeGhanaPhone(rec.phone) || rec.phone;
      if (phoneMap.has(normPhone)) continue;
      phoneMap.add(normPhone);
      uniqueRecipients.push(rec);
    }

    return uniqueRecipients;
  },

  // =========================================================================
  // CENTRALIZED FINANCIAL ENGINE (Single Source of Truth)
  // =========================================================================

  /**
   * Calculate exact ledger figures for a single student.
   * Properly distinguishes between invoices/charges, actual cash payments, and ledger reversals/credit notes.
   */
  getStudentFinancials(studentId, transactions = []) {
    const studTxs = transactions
      .filter(t => t.student_id === studentId || (t.reference_no && t.reference_no.includes(studentId)))
      .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

    let totalCharged = 0;
    let totalPaid = 0;
    let totalBadDebt = 0;
    let runningBalance = 0;

    const ledgerEntries = studTxs.map(t => {
      const isReversal = t.type === "REVERSAL" || t.is_reversal === true || (t.reference_no && t.reference_no.startsWith("REV-"));
      const isBadDebt = t.type === "BAD_DEBT" || (t.reference_no && t.reference_no.startsWith("BD-"));
      const isPayment = !isReversal && !isBadDebt && (t.type === "PAYMENT" || (t.type === "FEE_PAYMENT" && t.amount < 0) || t.amount < 0);
      const amountVal = Math.abs(t.amount || 0);

      if (isReversal) {
        // A reversal cancels a previous transaction
        if (t.reference_no && t.reference_no.startsWith("REV-BD-")) {
          // Reversing a bad debt write-off restores balance and debt to collect
          totalBadDebt -= amountVal;
          runningBalance += amountVal;
        } else if (t.amount < 0) {
          // Reversing a charge invoice (reduces charged total & reduces running balance)
          totalCharged -= amountVal;
          runningBalance -= amountVal;
        } else {
          // Reversing a payment (reduces paid total & increases running balance)
          totalPaid -= amountVal;
          runningBalance += amountVal;
        }
      } else if (isBadDebt) {
        // Bad debt write-off: removes outstanding debt balance from active collection
        totalBadDebt += amountVal;
        runningBalance -= amountVal;
      } else if (isPayment) {
        // Actual fee deposit / payment collected
        totalPaid += amountVal;
        runningBalance -= amountVal;
      } else {
        // Fee invoice / charge
        totalCharged += amountVal;
        runningBalance += amountVal;
      }

      return {
        transaction_id: t.transaction_id,
        date: t.timestamp ? new Date(t.timestamp).toLocaleDateString() : "N/A",
        timestamp: t.timestamp,
        ref: t.reference_no || t.transaction_id || "N/A",
        desc: t.billing_description || (isBadDebt ? "Bad Debt Write-off (Archived Student)" : (isReversal ? "Ledger Reversal Correction" : (isPayment ? "Fee Payment / Deposit" : "Tuition Fee / Charge"))),
        type: isBadDebt ? "BAD DEBT" : (isReversal ? "REVERSAL" : (isPayment ? "PAYMENT" : "INVOICE / BILL")),
        method: isPayment ? (t.payment_method || "CASH") : (isBadDebt ? "BAD_DEBT" : (isReversal ? (t.payment_method && t.payment_method !== "BANK_TRANSFER" ? t.payment_method : "N/A") : "N/A")),
        amount: amountVal,
        balanceAfter: runningBalance,
        isPayment: isPayment,
        isReversal: isReversal,
        isBadDebt: isBadDebt,
        rawAmount: t.amount,
        rawTx: t
      };
    });

    const netCharged = Math.max(0, totalCharged);
    const netPaid = Math.max(0, totalPaid);
    const netBadDebt = Math.max(0, totalBadDebt);
    const netArrears = Math.max(0, netCharged - netPaid - netBadDebt);
    const creditBalance = (netPaid + netBadDebt) > netCharged ? ((netPaid + netBadDebt) - netCharged) : 0;

    return {
      totalCharged: netCharged,
      totalPaid: netPaid,
      totalBadDebt: netBadDebt,
      netArrears: netArrears,
      creditBalance: creditBalance,
      runningBalance: runningBalance,
      ledgerEntries: ledgerEntries,
      transactions: studTxs
    };
  },

  /**
   * Compute comprehensive institutional financial figures across the entire school.
   * Used uniformly across Finance Dashboard, Proprietor Overview, Financial Statements (P&L), and General Accounting.
   */
  getFinancialMetrics(transactions = [], dateFilter = "all", users = []) {
    const now = new Date();
    let filteredTx = transactions;
    let dateRangeLabel = "All-Time Financial Overview";

    if (dateFilter === "month") {
      filteredTx = transactions.filter(t => {
        const d = new Date(t.timestamp || 0);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      });
      const monthName = now.toLocaleString("default", { month: "long", year: "numeric" });
      dateRangeLabel = `Current Month (${monthName})`;
    } else if (dateFilter === "3months") {
      const threshold = new Date();
      threshold.setMonth(now.getMonth() - 3);
      filteredTx = transactions.filter(t => new Date(t.timestamp || 0) >= threshold);
      const startStr = threshold.toLocaleString("default", { month: "short", year: "numeric" });
      const endStr = now.toLocaleString("default", { month: "short", year: "numeric" });
      dateRangeLabel = `Past 3 Months (${startStr} - ${endStr})`;
    } else if (dateFilter === "6months") {
      const threshold = new Date();
      threshold.setMonth(now.getMonth() - 6);
      filteredTx = transactions.filter(t => new Date(t.timestamp || 0) >= threshold);
      const startStr = threshold.toLocaleString("default", { month: "short", year: "numeric" });
      const endStr = now.toLocaleString("default", { month: "short", year: "numeric" });
      dateRangeLabel = `Past 6 Months (${startStr} - ${endStr})`;
    } else if (dateFilter === "ytd") {
      const threshold = new Date(now.getFullYear(), 0, 1);
      filteredTx = transactions.filter(t => new Date(t.timestamp || 0) >= threshold);
      const startStr = threshold.toLocaleString("default", { month: "short", year: "numeric" });
      const endStr = now.toLocaleString("default", { month: "short", year: "numeric" });
      dateRangeLabel = `Year-to-Date (${startStr} - ${endStr})`;
    }

    // 1. Student Tuition Billings & Collections
    let feesInvoiced = 0;
    let feesCollected = 0;
    let totalBadDebt = 0;

    // Collect all unique student IDs with transaction history in this dataset
    const studentIds = new Set(filteredTx.filter(t => t.student_id).map(t => t.student_id));
    
    // If users array passed, ensure all active students are considered
    if (users && users.length > 0) {
      users.filter(u => u.role === "Student" && u.status === "ACTIVE").forEach(u => studentIds.add(u.user_id));
    }

    studentIds.forEach(sId => {
      const sFin = this.getStudentFinancials(sId, filteredTx);
      feesInvoiced += sFin.totalCharged;
      feesCollected += sFin.totalPaid;
      totalBadDebt += (sFin.totalBadDebt || 0);
    });

    // Capture any fee payments recorded without explicit student_id attachment
    const orphanFeePayments = filteredTx.filter(t => !t.student_id && t.type === "FEE_PAYMENT" && t.amount < 0 && t.type !== "REVERSAL");
    orphanFeePayments.forEach(t => {
      feesCollected += Math.abs(t.amount);
    });

    // 2. Non-Tuition Operating Income
    const otherIncomesTx = filteredTx.filter(t => t.type === "OTHER_INCOME");
    const otherIncome = otherIncomesTx.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

    // 3. Gross Cash Inflows (Total Cash Collected)
    const grossInflows = feesCollected + otherIncome;

    // 4. Staff Payroll Net Disbursements
    const payrollTx = filteredTx.filter(t => t.type === "PAYROLL");
    const totalPayroll = payrollTx.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

    // 5. Operating & Operational Expenses
    const expenseTx = filteredTx.filter(t => t.type === "EXPENSE" || t.type === "OTHER_EXPENSE");
    const totalExpenses = expenseTx.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

    // 6. Total Cash Outflows
    const totalOutflows = totalPayroll + totalExpenses;

    // 7. Net Operating Cash Flow Margins
    const netCash = grossInflows - totalOutflows;

    // 8. Total Outstanding School Arrears (fees invoiced minus collected and written off bad debt)
    const totalArrears = Math.max(0, feesInvoiced - feesCollected - totalBadDebt);
    const collectionRate = feesInvoiced > 0 ? ((feesCollected / feesInvoiced) * 100).toFixed(1) : "100.0";

    return {
      dateRangeLabel,
      filteredTransactions: filteredTx,
      feesInvoiced,
      feesCollected,
      totalArrears,
      totalBadDebt,
      collectionRate: parseFloat(collectionRate),
      otherIncome,
      grossInflows,
      totalPayroll,
      totalExpenses,
      totalOutflows,
      netCash
    };
  },

  /**
   * Push an archived student's outstanding fees to Bad Debt so it is excluded from outstanding fee collection rosters.
   */
  async pushStudentDebtToBadDebt(studentId, studentUser) {
    if (!window.db || !studentId) return;
    try {
      const student = studentUser || await window.db.get("users", studentId);
      const txs = await window.db.getAll("financial_transactions") || [];
      const sFin = this.getStudentFinancials(studentId, txs);
      const arrears = sFin.netArrears;

      if (arrears > 0) {
        const badDebtTx = {
          transaction_id: "t-baddebt-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
          student_id: studentId,
          type: "BAD_DEBT",
          amount: arrears,
          reference_no: "BD-" + (student && student.uid ? student.uid : studentId),
          billing_description: `Bad Debt Write-off - Archived Student (${student ? student.first_name + ' ' + student.last_name : studentId})`,
          payment_method: "BAD_DEBT_PROVISION",
          timestamp: new Date().toISOString()
        };
        await window.db.put("financial_transactions", badDebtTx);

        // Audit log
        try {
          if (typeof generateAuditHash === "function") {
            const audits = await window.db.getAll("audit_logs") || [];
            const prevHash = audits.length > 0 && audits[audits.length - 1].action_details ? JSON.parse(audits[audits.length - 1].action_details).hash : "genesis";
            const hash = generateAuditHash("BAD_DEBT_WRITEOFF", badDebtTx, prevHash);
            await window.db.put("audit_logs", {
              audit_id: "a-audit-" + Date.now(),
              timestamp: new Date().toISOString(),
              action_details: JSON.stringify({
                action: "BAD_DEBT_WRITEOFF",
                student_id: studentId,
                amount: arrears,
                hash
              })
            });
          }
        } catch(e) {}
      }
    } catch(err) {
      console.error("pushStudentDebtToBadDebt error:", err);
    }
  },

  /**
   * Reverse bad debt write-offs when an archived student's account is reactivated.
   */
  async restoreStudentBadDebtOnReactivation(studentId, studentUser) {
    if (!window.db || !studentId) return;
    try {
      const student = studentUser || await window.db.get("users", studentId);
      const txs = await window.db.getAll("financial_transactions") || [];
      const bdTxs = txs.filter(t => t.student_id === studentId && (t.type === "BAD_DEBT" || (t.reference_no && t.reference_no.startsWith("BD-"))));

      for (const bd of bdTxs) {
        const revRef = "REV-" + bd.reference_no;
        const alreadyReversed = txs.some(t => t.reference_no === revRef);
        if (!alreadyReversed) {
          const revTx = {
            transaction_id: "t-rev-bd-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
            student_id: studentId,
            type: "REVERSAL",
            amount: Math.abs(bd.amount),
            reference_no: revRef,
            billing_description: `Reversal of Bad Debt on Account Reactivation (${student ? student.first_name + ' ' + student.last_name : studentId})`,
            payment_method: "BAD_DEBT_RECOVERY",
            timestamp: new Date().toISOString()
          };
          await window.db.put("financial_transactions", revTx);
        }
      }
    } catch(err) {
      console.error("restoreStudentBadDebtOnReactivation error:", err);
    }
  },

  // ==========================================
  // --- Centralized Enrolment & Class Roster Engine ---
  // ==========================================
  async getClassRoster(classId, options = { activeOnly: true }) {
    if (!window.db || !classId) return [];
    try {
      const enrolments = await window.db.getAll("enrolments") || [];
      const users = await window.db.getAll("users") || [];
      
      const classEnrols = enrolments.filter(e => e.class_id === classId);
      const studentMap = new Map(users.map(u => [u.user_id, u]));
      
      const roster = [];
      for (const en of classEnrols) {
        const student = studentMap.get(en.student_id);
        if (!student) continue;
        if (options.activeOnly && student.status !== "ACTIVE") continue;
        
        roster.push({
          ...student,
          enrolment_id: en.enrolment_id,
          class_id: en.class_id,
          enrolment_date: en.enrolment_date,
          status: student.status || "ACTIVE"
        });
      }
      
      // Sort alphabetically by last name, then first name
      roster.sort((a, b) => {
        const nameA = `${a.last_name || ""} ${a.first_name || ""}`.toLowerCase();
        const nameB = `${b.last_name || ""} ${b.first_name || ""}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      return roster;
    } catch (e) {
      console.error("getClassRoster error:", e);
      return [];
    }
  },

  async getStudentClass(studentId) {
    if (!window.db || !studentId) return null;
    try {
      const enrolments = await window.db.getAll("enrolments") || [];
      const classes = await window.db.getAll("classes") || [];
      const users = await window.db.getAll("users") || [];
      
      const en = enrolments.find(e => e.student_id === studentId);
      if (!en) return null;
      
      const cls = classes.find(c => c.class_id === en.class_id);
      if (!cls) return null;
      
      let teacherName = "Unassigned";
      if (cls.class_teacher_id) {
        const teacher = users.find(u => u.user_id === cls.class_teacher_id);
        if (teacher) teacherName = `${teacher.first_name} ${teacher.last_name}`;
      }
      
      return {
        class_id: cls.class_id,
        class_name: cls.class_name,
        stage: cls.stage || "Primary",
        section: cls.section || "General",
        class_teacher_id: cls.class_teacher_id,
        class_teacher_name: teacherName,
        enrolment_id: en.enrolment_id,
        enrolment_date: en.enrolment_date
      };
    } catch (e) {
      console.error("getStudentClass error:", e);
      return null;
    }
  },

  async getEnrolmentStats() {
    if (!window.db) return { totalActive: 0, byStage: { Nursery: 0, Primary: 0, JHS: 0, Other: 0 }, byClass: {} };
    try {
      const enrolments = await window.db.getAll("enrolments") || [];
      const classes = await window.db.getAll("classes") || [];
      const users = await window.db.getAll("users") || [];
      
      const activeStudents = new Set(
        users.filter(u => u.role === "Student" && u.status === "ACTIVE").map(u => u.user_id)
      );
      
      const classMap = new Map(classes.map(c => [c.class_id, c]));
      
      let totalActive = 0;
      const byStage = { "Pre-Primary": 0, Nursery: 0, Primary: 0, JHS: 0, Other: 0 };
      const byClass = {};
      
      classes.forEach(c => {
        let stg = c.stage || "Primary";
        if (stg === "Nursery") stg = "Pre-Primary";
        byClass[c.class_id] = {
          class_id: c.class_id,
          class_name: c.class_name,
          stage: stg,
          count: 0
        };
      });
      
      for (const en of enrolments) {
        if (!activeStudents.has(en.student_id)) continue;
        totalActive++;
        
        const cls = classMap.get(en.class_id);
        if (cls) {
          let stage = cls.stage || "Primary";
          if (stage === "Nursery") stage = "Pre-Primary";
          if (byStage[stage] !== undefined) {
            byStage[stage]++;
            if (stage === "Pre-Primary") byStage.Nursery++;
          } else {
            byStage.Other++;
          }
          if (byClass[cls.class_id]) {
            byClass[cls.class_id].count++;
          }
        }
      }
      
      return {
        totalActive,
        byStage,
        byClass
      };
    } catch (e) {
      console.error("getEnrolmentStats error:", e);
      return { totalActive: 0, byStage: { "Pre-Primary": 0, Nursery: 0, Primary: 0, JHS: 0, Other: 0 }, byClass: {} };
    }
  },

  getNextClassLadder(className) {
    if (!className) return null;
    const clean = className.trim().toLowerCase();
    
    if (clean === "creche" || clean.includes("crèche")) return "Nursery 1";
    if (clean === "nursery 1") return "Nursery 2";
    if (clean === "nursery 2") return "KG 1";
    if (clean === "kg 1" || clean === "kindergarten 1") return "KG 2";
    if (clean === "kg 2" || clean === "kindergarten 2") return "Primary 1";
    
    // Primary / Class / Grade 1-6
    const primMatch = clean.match(/(primary|class|grade)\s*(\d+)/i);
    if (primMatch) {
      const prefix = primMatch[1];
      const num = parseInt(primMatch[2], 10);
      if (num < 6) {
        const capitalPrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase();
        return `${capitalPrefix} ${num + 1}`;
      } else if (num === 6) {
        return "JHS 1";
      }
    }
    
    // JHS 1-3
    const jhsMatch = clean.match(/jhs\s*(\d+)/i);
    if (jhsMatch) {
      const num = parseInt(jhsMatch[1], 10);
      if (num === 1) return "JHS 2";
      if (num === 2) return "JHS 3";
      if (num === 3) return "GRADUATED";
    }
    
    return null;
  },

  async promoteStudent(studentId, { isTeacherPromoted = false, finalScore = 0, actor_id = "system" } = {}) {
    if (!window.db || !studentId) return { success: false, message: "Missing student ID" };
    try {
      const passMarks = 50;
      if (finalScore < passMarks && !isTeacherPromoted) {
        return { success: false, message: "Student did not meet the 50% passing threshold for promotion." };
      }

      const enrolments = await window.db.getAll("enrolments") || [];
      const classes = await window.db.getAll("classes") || [];
      const student = await window.db.get("users", studentId);
      if (!student) return { success: false, message: "Student not found" };

      const en = enrolments.find(e => e.student_id === studentId);
      if (!en) return { success: false, message: "Enrolment record not found" };

      const currentClass = classes.find(c => c.class_id === en.class_id);
      const currentClassName = currentClass ? currentClass.class_name : "Current Class";
      const nextClassName = this.getNextClassLadder(currentClassName);

      if (!nextClassName) {
        return { success: false, message: `Could not determine next class from ${currentClassName}` };
      }

      const currentTerm = await this.getCurrentTerm();

      // Case 1: Graduated from JHS 3 -> Auto-Archive & Alumnus Status
      if (nextClassName === "GRADUATED") {
        student.status = "ARCHIVED";
        student.graduation_status = "GRADUATED";
        student.graduated_academic_year = currentTerm.academicYear;
        student.graduation_date = new Date().toISOString();
        await window.db.put("users", student);
        await this.pushStudentDebtToBadDebt(studentId, student);

        en.status = "COMPLETED";
        en.completion_date = new Date().toISOString();
        await window.db.put("enrolments", en);

        // Send congratulations notification to Parent
        await window.db.put("notifications", {
          notification_id: `notif-grad-${studentId}-${Date.now()}`,
          title: "🎉 Basic Education Graduation (JHS 3)",
          message: `Congratulations! ${student.first_name} ${student.last_name} (${student.uid}) has completed Junior High School (JHS 3) and officially graduated. Academic records have been archived for official transcripts.`,
          role: "Parent",
          target_user_id: student.user_id,
          target_phone: student.phone || "",
          created_at: new Date().toISOString()
        });

        return {
          success: true,
          action: "GRADUATED",
          fromClass: currentClassName,
          toClass: "Graduated Alumni",
          message: `Student completed JHS 3 and officially graduated! Profile auto-archived.`
        };
      }

      // Case 2: Standard Advancement to Next Class
      let targetClass = classes.find(c => c.class_name.toLowerCase().trim() === nextClassName.toLowerCase().trim());
      if (!targetClass) {
        const newClassId = "c-class-" + Date.now();
        targetClass = {
          class_id: newClassId,
          class_name: nextClassName,
          stage: nextClassName.startsWith("JHS") ? "JHS" : (nextClassName.startsWith("Nursery") || nextClassName.startsWith("Creche") || nextClassName.startsWith("KG") ? "Pre-Primary" : "Primary"),
          section: nextClassName.startsWith("JHS") ? "JHS" : (nextClassName.startsWith("Nursery") || nextClassName.startsWith("Creche") || nextClassName.startsWith("KG") ? "Pre-Primary" : "Primary"),
          class_teacher_id: currentClass ? currentClass.class_teacher_id : "",
          academic_year: currentTerm.academicYear
        };
        await window.db.put("classes", targetClass);
      }

      en.class_id = targetClass.class_id;
      en.updated_at = new Date().toISOString();
      await window.db.put("enrolments", en);

      return {
        success: true,
        action: "PROMOTED",
        fromClass: currentClassName,
        toClass: targetClass.class_name,
        message: `Student promoted! Advanced from ${currentClassName} to ${targetClass.class_name}.`
      };
    } catch (e) {
      console.error("promoteStudent error:", e);
      return { success: false, message: e.message };
    }
  },

  // ==========================================
  // --- Centralized Continuous Assessment & Grading Engine ---
  // ==========================================
  getGradeScale(totalScore) {
    const s = Math.round(totalScore);
    if (s >= 80) return { grade: "A", gradePoint: 1, remarks: "Excellent Work" };
    if (s >= 70) return { grade: "B", gradePoint: 2, remarks: "Very Good" };
    if (s >= 60) return { grade: "C", gradePoint: 3, remarks: "Good Effort" };
    if (s >= 50) return { grade: "D", gradePoint: 4, remarks: "Satisfactory" };
    if (s >= 40) return { grade: "E", gradePoint: 5, remarks: "Pass" };
    return { grade: "F", gradePoint: 9, remarks: "Needs Improvement" };
  },

  async calculateClassPositions(classId, termParam) {
    if (!window.db || !classId) return new Map();
    try {
      const term = termParam || this.getCurrentTermName();
      const roster = await this.getClassRoster(classId, { activeOnly: true });
      const allScores = await window.db.getAll("student_scores") || [];
      
      const studentAverages = roster.map(student => {
        const studScores = allScores.filter(sc => 
          sc.student_id === student.user_id && 
          (!sc.term || sc.term === term)
        );
        
        let total = 0;
        let count = 0;
        
        if (studScores.length > 0) {
          studScores.forEach(sc => {
            const classScore = parseFloat(sc.class_score !== undefined ? sc.class_score : (parseFloat(sc.assignment_score || 0) + parseFloat(sc.class_test_score || 0)));
            const examScore = parseFloat(sc.exam_score || 0);
            const scTotal = parseFloat(sc.total_score !== undefined ? sc.total_score : (classScore + examScore));
            total += scTotal;
            count++;
          });
        } else if (student.term_grades) {
          try {
            const g = JSON.parse(student.term_grades);
            const classScore = parseFloat(g.classScore !== undefined ? g.classScore : (parseFloat(g.assMark || 0) + parseFloat(g.testMark || 0)));
            const examScore = parseFloat(g.examMark || 0);
            total = classScore + examScore;
            count = 1;
          } catch (e) {
            total = 0;
            count = 1;
          }
        }
        
        const average = count > 0 ? (total / count) : 0;
        return {
          user_id: student.user_id,
          totalScore: total,
          averageScore: parseFloat(average.toFixed(2)),
          subjectCount: count
        };
      });
      
      // Sort descending by averageScore (or totalScore)
      studentAverages.sort((a, b) => b.averageScore - a.averageScore);
      
      // Assign standard competition ranks (1, 2, 2, 4...)
      const rankMap = new Map();
      let currentRank = 1;
      for (let i = 0; i < studentAverages.length; i++) {
        if (i > 0 && studentAverages[i].averageScore < studentAverages[i - 1].averageScore) {
          currentRank = i + 1;
        }
        rankMap.set(studentAverages[i].user_id, {
          rank: currentRank,
          averageScore: studentAverages[i].averageScore,
          totalScore: studentAverages[i].totalScore,
          subjectCount: studentAverages[i].subjectCount,
          classSize: roster.length
        });
      }
      
      return rankMap;
    } catch (e) {
      console.error("calculateClassPositions error:", e);
      return new Map();
    }
  },

  async getStudentReportCard(studentId, termParam) {
    if (!window.db || !studentId) return null;
    try {
      const term = termParam || this.getCurrentTermName();
      const currentTermObj = await this.getCurrentTerm();
      const users = await window.db.getAll("users") || [];
      const subjects = await window.db.getAll("subjects") || [];
      const allScores = await window.db.getAll("student_scores") || [];
      
      const student = users.find(u => u.user_id === studentId);
      if (!student) return null;
      
      const classInfo = await this.getStudentClass(studentId);
      const classId = classInfo ? classInfo.class_id : null;
      
      // Get Class Ranking
      let rankInfo = { rank: 1, classSize: 1, averageScore: 0, totalScore: 0 };
      if (classId) {
        const rankMap = await this.calculateClassPositions(classId, term);
        if (rankMap.has(studentId)) {
          rankInfo = rankMap.get(studentId);
        }
      }
      
      // Parse stored behavioral ratings and terminal summary
      let storedGrades = { assMark: 0, testMark: 0, examMark: 0, promotedByTeacher: false, behavior: { contribution: 5, sports: 5, arts: 5, social: 5 } };
      if (student.term_grades) {
        try {
          const parsed = JSON.parse(student.term_grades);
          storedGrades = { ...storedGrades, ...parsed, behavior: { ...storedGrades.behavior, ...(parsed.behavior || {}) } };
        } catch (e) {}
      }
      
      // Subject Scores breakdown
      const studScores = allScores.filter(sc => 
        sc.student_id === studentId && 
        (!sc.term || sc.term === term)
      );
      
      let subjectBreakdown = [];
      const subjectMap = new Map(subjects.map(s => [s.subject_id, s]));
      
      if (studScores.length > 0) {
        subjectBreakdown = studScores.map(sc => {
          const subObj = subjectMap.get(sc.subject_id);
          const subName = subObj ? subObj.subject_name : (sc.subject_name || "General Subject");
          const classScore = parseFloat(sc.class_score !== undefined ? sc.class_score : (parseFloat(sc.assignment_score || 0) + parseFloat(sc.class_test_score || 0)));
          const exam = parseFloat(sc.exam_score || 0);
          const tot = parseFloat(sc.total_score !== undefined ? sc.total_score : (classScore + exam));
          const scale = this.getGradeScale(tot);
          
          return {
            score_id: sc.score_id,
            subject_id: sc.subject_id,
            subject_name: subName,
            class_score: classScore,
            assignment_score: 0,
            class_test_score: classScore,
            ca_score: classScore,
            exam_score: exam,
            total_score: tot,
            grade: scale.grade,
            grade_point: scale.gradePoint,
            remarks: scale.remarks
          };
        });
      } else {
        // Build fallback standard curriculum subjects using storedGrades
        const defaultSubjectNames = ["Core Mathematics", "English Language", "Integrated Science", "Social Studies", "Information Technology"];
        const classScore = parseFloat(storedGrades.classScore !== undefined ? storedGrades.classScore : (parseFloat(storedGrades.assMark || 0) + parseFloat(storedGrades.testMark || 0)));
        const exam = parseFloat(storedGrades.examMark || 0);
        const tot = classScore + exam;
        const scale = this.getGradeScale(tot);
        
        subjectBreakdown = defaultSubjectNames.map((sName, idx) => ({
          score_id: `default-${studentId}-${idx}`,
          subject_id: `sub-${idx + 1}`,
          subject_name: sName,
          class_score: classScore,
          assignment_score: 0,
          class_test_score: classScore,
          ca_score: classScore,
          exam_score: exam,
          total_score: tot,
          grade: scale.grade,
          grade_point: scale.gradePoint,
          remarks: scale.remarks
        }));
      }
      
      // Calculate overall composite average
      const totalMarks = subjectBreakdown.reduce((sum, s) => sum + s.total_score, 0);
      const compositeAverage = subjectBreakdown.length > 0 ? parseFloat((totalMarks / subjectBreakdown.length).toFixed(2)) : 0;
      const overallScale = this.getGradeScale(compositeAverage);

      // Calculate terminal attendance days (X out of Y days)
      const allAttendance = await window.db.getAll("attendance") || [];
      const studentAtt = allAttendance.filter(a => a.student_id === studentId || a.user_id === studentId);
      const presCount = studentAtt.filter(a => a.status === "PRESENT" || a.status === "LATE").length;
      let totalSchoolDays = studentAtt.length;
      
      try {
        const cal = await window.db.get("academic_calendar", "main-calendar");
        if (cal && cal.canonical_terms) {
          const ct = cal.canonical_terms;
          const termKey = term.toLowerCase().includes("1") || term.toLowerCase().includes("first") ? "term1" :
                         (term.toLowerCase().includes("2") || term.toLowerCase().includes("second") ? "term2" : "term3");
          if (ct[termKey] && ct[termKey].net_days) {
            totalSchoolDays = Math.max(studentAtt.length, ct[termKey].net_days);
          }
        }
      } catch (calErr) {}
      if (totalSchoolDays === 0) totalSchoolDays = studentAtt.length || 0;
      const attendanceText = `${presCount} out of ${totalSchoolDays} days`;
      
      return {
        student,
        classInfo: classInfo || { class_name: "General Class", section: "General", stage: "Primary", class_teacher_name: "Unassigned Teacher" },
        termName: currentTermObj.termName,
        academicYear: currentTermObj.academicYear,
        subjects: subjectBreakdown,
        totalMarks,
        compositeAverage,
        overallGrade: overallScale.grade,
        overallRemarks: overallScale.remarks,
        classRank: rankInfo.rank,
        classSize: rankInfo.classSize,
        behavior: storedGrades.behavior,
        attendanceRecord: attendanceText,
        isPromoted: storedGrades.promotedByTeacher || compositeAverage >= 50
      };
    } catch (e) {
      console.error("getStudentReportCard error:", e);
      return null;
    }
  },

  async saveStudentGrades({ student_id, class_id, subject_id, scores, behavior, promotedByTeacher, actor_id }) {
    if (!window.db || !student_id) return { success: false, message: "Missing student ID" };
    try {
      const currentTerm = this.getCurrentTermName();
      const currentTermObj = await this.getCurrentTerm();
      
      const classScore = Math.min(50, Math.max(0, parseFloat(scores.classScore !== undefined ? scores.classScore : (parseFloat(scores.class_score !== undefined ? scores.class_score : (parseFloat(scores.assMark || 0) + parseFloat(scores.testMark || 0)))))));
      const exam = Math.min(50, Math.max(0, parseFloat(scores.examMark || scores.exam_score || 0)));
      const total = classScore + exam;
      const scale = this.getGradeScale(total);
      
      // 1. Save or update individual subject score row in student_scores
      if (subject_id) {
        const scoreId = `score-${student_id}-${subject_id}-${currentTerm}`;
        const scoreRecord = {
          score_id: scoreId,
          student_id,
          class_id: class_id || "",
          subject_id,
          class_score: classScore,
          ca_score: classScore,
          assignment_score: 0,
          class_test_score: classScore,
          exam_score: exam,
          total_score: total,
          grade: scale.grade,
          remarks: scale.remarks,
          term: currentTerm,
          academic_year: currentTermObj.academicYear,
          updated_at: new Date().toISOString()
        };
        await window.db.put("student_scores", scoreRecord);
      }
      
      // 2. Synchronize student's term_grades JSON on the user record
      const studentObj = await window.db.get("users", student_id);
      if (studentObj) {
        const gradesData = {
          classScore: classScore,
          assMark: 0,
          testMark: classScore,
          examMark: exam,
          promotedByTeacher: !!promotedByTeacher,
          behavior: behavior || { contribution: 5, sports: 5, arts: 5, social: 5 }
        };
        studentObj.term_grades = JSON.stringify(gradesData);
        await window.db.put("users", studentObj);
        
        // 3. Cryptographic Audit Log
        try {
          if (typeof generateAuditHash === "function") {
            const audits = await window.db.getAll("audit_logs") || [];
            const prevHash = audits.length > 0 && audits[audits.length - 1].action_details ? JSON.parse(audits[audits.length - 1].action_details).hash : "genesis";
            const payload = { student_id, term_grades: gradesData, scores };
            const hash = generateAuditHash("GRADE_MUTATION", payload, prevHash);
            await window.db.put("audit_logs", {
              audit_id: "a-audit-" + Date.now(),
              timestamp: new Date().toISOString(),
              action_details: JSON.stringify({
                action: "GRADE_MUTATION",
                actor_id: actor_id || "system",
                payload,
                hash
              })
            });
          }
        } catch (audErr) {
          console.warn("Audit log error:", audErr);
        }
      }
      
      return { success: true, totalScore: total, grade: scale.grade };
    } catch (e) {
      console.error("saveStudentGrades error:", e);
      return { success: false, message: e.message };
    }
  },

  // ==========================================
  // --- Centralized Institutional Attendance Engine ---
  // ==========================================
  async getAttendanceMetrics({ userId = null, classId = null, role = null, startDate = null, endDate = null } = {}) {
    if (!window.db) {
      return { totalRecords: 0, presentCount: 0, lateCount: 0, absentCount: 0, excusedCount: 0, attendanceRate: 100, punctualityRate: 100, records: [] };
    }
    try {
      const allAttendance = await window.db.getAll("attendance") || [];
      const enrolments = classId ? await window.db.getAll("enrolments") || [] : [];
      const users = role ? await window.db.getAll("users") || [] : [];
      
      let targetUserIds = null;
      if (userId) {
        targetUserIds = new Set([userId]);
      } else if (classId) {
        const classStudIds = enrolments.filter(e => e.class_id === classId).map(e => e.student_id);
        targetUserIds = new Set(classStudIds);
      } else if (role) {
        const roleUserIds = users.filter(u => u.role === role && u.status === "ACTIVE").map(u => u.user_id);
        targetUserIds = new Set(roleUserIds);
      }
      
      const filtered = allAttendance.filter(a => {
        if (targetUserIds && !targetUserIds.has(a.user_id)) return false;
        if (startDate && a.date < startDate) return false;
        if (endDate && a.date > endDate) return false;
        return true;
      });
      
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let excusedCount = 0;
      
      for (const rec of filtered) {
        const status = (rec.status || "").toUpperCase();
        if (status === "PRESENT") presentCount++;
        else if (status === "LATE") lateCount++;
        else if (status === "EXCUSED") excusedCount++;
        else if (status === "ABSENT") absentCount++;
        else presentCount++;
      }
      
      const totalRecords = filtered.length;
      const attended = presentCount + lateCount;
      const attendanceRate = totalRecords > 0 ? parseFloat(((attended / totalRecords) * 100).toFixed(1)) : 100.0;
      const punctualityRate = attended > 0 ? parseFloat(((presentCount / attended) * 100).toFixed(1)) : 100.0;
      
      return {
        totalRecords,
        presentCount,
        lateCount,
        absentCount,
        excusedCount,
        attendanceRate,
        punctualityRate,
        records: filtered
      };
    } catch (e) {
      console.error("getAttendanceMetrics error:", e);
      return { totalRecords: 0, presentCount: 0, lateCount: 0, absentCount: 0, excusedCount: 0, attendanceRate: 100, punctualityRate: 100, records: [] };
    }
  },

  async getDailyAttendanceSummary(dateStr) {
    if (!window.db) return { student: { present: 0, total: 0, rate: 100 }, staff: { present: 0, total: 0, rate: 100 } };
    try {
      const date = dateStr || new Date().toISOString().substring(0, 10);
      const allAttendance = await window.db.getAll("attendance") || [];
      const users = await window.db.getAll("users") || [];
      
      const userMap = new Map(users.map(u => [u.user_id, u]));
      const dayRecords = allAttendance.filter(a => a.date === date);
      
      let studTotal = 0, studPresent = 0;
      let staffTotal = 0, staffPresent = 0;
      
      for (const r of dayRecords) {
        const u = userMap.get(r.user_id);
        const role = u ? u.role : "Student";
        const isPres = (r.status === "PRESENT" || r.status === "LATE");
        
        if (role === "Student") {
          studTotal++;
          if (isPres) studPresent++;
        } else if (["Teacher", "Administrator", "HeadTeacher", "Finance", "Proprietor"].includes(role)) {
          staffTotal++;
          if (isPres) staffPresent++;
        }
      }
      
      return {
        date,
        student: {
          present: studPresent,
          total: studTotal,
          rate: studTotal > 0 ? parseFloat(((studPresent / studTotal) * 100).toFixed(1)) : 100.0
        },
        staff: {
          present: staffPresent,
          total: staffTotal,
          rate: staffTotal > 0 ? parseFloat(((staffPresent / staffTotal) * 100).toFixed(1)) : 100.0
        }
      };
    } catch (e) {
      console.error("getDailyAttendanceSummary error:", e);
      return { student: { present: 0, total: 0, rate: 100 }, staff: { present: 0, total: 0, rate: 100 } };
    }
  },

  // ==========================================
  // --- Centralized Notification & Cross-Device Sync Engine ---
  // ==========================================
  async getNotificationsForUser(user) {
    if (!user || !window.db) {
      return { unreadCount: 0, unreadNotifCount: 0, unreadMessageCount: 0, notifications: [], unreadNotifications: [], unreadMessages: [] };
    }
    try {
      const allNotifs = await window.db.getAll("notifications") || [];
      const readRecords = await window.db.getAll("notification_user_reads") || [];
      const allMessages = await window.db.getAll("portal_messages") || [];
      
      const myReadIds = new Set(
        readRecords.filter(r => r.user_id === user.user_id).map(r => r.notification_id)
      );
      
      const userPhone = user.phone ? String(user.phone).trim() : "";
      
      const myNotifs = allNotifs.filter(n => {
        const targetRole = n.role || n.target_role;
        const targetUid = n.target_user_id;
        const targetPhone = n.target_phone ? String(n.target_phone).trim() : "";
        
        const roleMatch = !targetRole || targetRole === "ALL" || targetRole === user.role;
        const userMatch = targetUid && targetUid === user.user_id;
        const phoneMatch = userPhone && targetPhone && targetPhone === userPhone;
        
        if (targetUid && targetUid !== user.user_id) return false;
        return roleMatch || userMatch || phoneMatch;
      });
      
      myNotifs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      
      const notificationsWithReadState = myNotifs.map(n => ({
        ...n,
        is_read: myReadIds.has(n.notification_id)
      }));
      
      const unreadNotifs = notificationsWithReadState.filter(n => !n.is_read);
      
      const unreadMessages = allMessages.filter(m => 
        m.recipient_id === user.user_id && m.status !== "READ"
      );
      
      const unreadNotifCount = unreadNotifs.length;
      const unreadMessageCount = unreadMessages.length;
      const totalUnreadCount = unreadNotifCount + unreadMessageCount;
      
      return {
        unreadCount: totalUnreadCount,
        unreadNotifCount,
        unreadMessageCount,
        notifications: notificationsWithReadState,
        unreadNotifications: unreadNotifs,
        unreadMessages
      };
    } catch (e) {
      console.error("getNotificationsForUser error:", e);
      return { unreadCount: 0, unreadNotifCount: 0, unreadMessageCount: 0, notifications: [], unreadNotifications: [], unreadMessages: [] };
    }
  },

  async markNotificationAsRead(notificationId, userId) {
    if (!window.db || !notificationId || !userId) return false;
    try {
      const readId = `read-${userId}-${notificationId}`;
      await window.db.put("notification_user_reads", {
        read_id: readId,
        user_id: userId,
        notification_id: notificationId,
        read_at: new Date().toISOString()
      });
      return true;
    } catch (e) {
      console.error("markNotificationAsRead error:", e);
      return false;
    }
  },

  async markAllNotificationsAsRead(userId, notificationIds) {
    if (!window.db || !userId || !Array.isArray(notificationIds)) return false;
    try {
      const now = new Date().toISOString();
      for (const nId of notificationIds) {
        const readId = `read-${userId}-${nId}`;
        await window.db.put("notification_user_reads", {
          read_id: readId,
          user_id: userId,
          notification_id: nId,
          read_at: now
        });
      }
      return true;
    } catch (e) {
      console.error("markAllNotificationsAsRead error:", e);
      return false;
    }
  },

  async deleteNotification(notificationId) {
    if (!window.db || !notificationId) return false;
    try {
      await window.db.delete("notifications", notificationId);
      if (window.isFirebaseConfigured && window.isFirebaseConfigured()) {
        try {
          firebase.firestore().collection("notifications").doc(notificationId).delete();
        } catch (e) {}
      }
      if (typeof window.dbSyncUpdate === "function") {
        window.dbSyncUpdate("notifications");
      }
      return true;
    } catch (e) {
      console.error("deleteNotification error:", e);
      return false;
    }
  },

  async clearAllNotifications(userId, role) {
    if (!window.db) return false;
    try {
      const allNotifs = await window.db.getAll("notifications") || [];
      const targets = allNotifs.filter(n => {
        if (n.target_user_id === userId) return true;
        if (!n.target_user_id && (n.role === role || n.role === "All" || !n.role)) return true;
        return false;
      });
      for (const n of targets) {
        await window.db.delete("notifications", n.notification_id);
        if (window.isFirebaseConfigured && window.isFirebaseConfigured()) {
          try {
            firebase.firestore().collection("notifications").doc(n.notification_id).delete();
          } catch (e) {}
        }
      }
      if (typeof window.dbSyncUpdate === "function") {
        window.dbSyncUpdate("notifications");
      }
      return true;
    } catch (e) {
      console.error("clearAllNotifications error:", e);
      return false;
    }
  }
};

window.api = api;
