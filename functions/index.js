const functions = require("firebase-functions");
const admin = require("firebase-admin");
const https = require("https");

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Ghanaian Phone Number Normalizer
 * Converts all Ghanaian formats to standard international: 233XXXXXXXXX
 * Examples:
 *   "0244123456"       -> "233244123456"
 *   "+233 24 412 3456" -> "233244123456"
 *   "244123456"        -> "233244123456"
 *   "233244123456"     -> "233244123456"
 */
function normalizeGhanaPhone(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  
  if (digits.startsWith("0")) {
    digits = "233" + digits.substring(1);
  } else if (digits.startsWith("233")) {
    // already starts with 233
  } else if (digits.length === 9) {
    digits = "233" + digits;
  }
  
  return digits;
}

// Hubtel Configuration (Securely configured on the backend server)
const HUBTEL_CONFIG = {
  clientId: process.env.HUBTEL_CLIENT_ID || "cvnhobyo",
  clientSecret: process.env.HUBTEL_CLIENT_SECRET || "rnrxvuxd",
  from: process.env.HUBTEL_SENDER_ID || "FathersJoy",
  endpoint: "https://sms.hubtel.com/v1/messages/send"
};

/**
 * Internal helper to dispatch SMS to Hubtel Gateway
 */
function dispatchHubtelSMS(phone, message) {
  return new Promise((resolve) => {
    const normalizedPhone = normalizeGhanaPhone(phone);
    if (!normalizedPhone || normalizedPhone.length < 10) {
      return resolve({
        success: false,
        error: "Invalid Ghanaian phone number format",
        normalizedPhone
      });
    }

    const encodedContent = encodeURIComponent(message);
    const url = `${HUBTEL_CONFIG.endpoint}?clientsecret=${HUBTEL_CONFIG.clientSecret}&clientid=${HUBTEL_CONFIG.clientId}&from=${encodeURIComponent(HUBTEL_CONFIG.from)}&to=${normalizedPhone}&content=${encodedContent}`;

    https.get(url, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          // Hubtel Status Code 0 = Success
          const isSuccess = res.statusCode === 200 && parsed.status === 0;
          resolve({
            success: isSuccess,
            status: parsed.status,
            statusDescription: parsed.statusDescription || (isSuccess ? "Sent" : "Gateway responded with code " + parsed.status),
            messageId: parsed.messageId || null,
            rate: parsed.rate || 0,
            normalizedPhone,
            raw: parsed
          });
        } catch (e) {
          resolve({
            success: false,
            error: "Failed to parse Hubtel JSON response",
            rawResponse: data,
            normalizedPhone
          });
        }
      });
    }).on("error", (err) => {
      resolve({
        success: false,
        error: err.message,
        normalizedPhone
      });
    });
  });
}

/**
 * Firebase Callable Function: sendSchoolSMS
 * Invoked securely from the client web portal via firebase.functions().httpsCallable("sendSchoolSMS")
 */
exports.sendSchoolSMS = functions.https.onCall(async (data, context) => {
  // Ensure the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required. You must be signed into Father's Joy Academy portal to dispatch SMS.");
  }

  const { recipientPhone, message } = data || {};
  if (!recipientPhone || !message) {
    throw new functions.https.HttpsError("invalid-argument", "recipientPhone and message are required.");
  }

  const result = await dispatchHubtelSMS(recipientPhone, message);
  return result;
});

/**
 * Public HTTP Endpoint: apiSendSMS (with CORS and authorization support)
 * Enables authorized REST POST/GET calls
 */
exports.apiSendSMS = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  // Verify internal API Key or Authorization header
  const authHeader = req.headers.authorization || "";
  const apiKey = req.headers["x-api-key"] || req.query?.apiKey;
  const expectedKey = process.env.SMS_API_KEY || "fja-sms-authorized-key-2026";
  const isAuthorized = (authHeader && authHeader.startsWith("Bearer ") && authHeader.substring(7) === expectedKey) || (apiKey === expectedKey);
  
  if (!isAuthorized) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Valid Authorization header or X-API-Key required to dispatch SMS."
    });
  }

  const phone = req.body?.recipientPhone || req.query?.to || req.body?.to;
  const message = req.body?.message || req.query?.content || req.body?.content;

  if (!phone || !message) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameters: 'recipientPhone' (or 'to') and 'message' (or 'content')"
    });
  }

  const result = await dispatchHubtelSMS(phone, message);
  return res.status(result.success ? 200 : (result.status === 12 ? 402 : 400)).json(result);
});

/**
 * Core Engine: executeDailyBirthdayScan
 * Evaluates all active celebrants (students AND staff) for today's date in GMT (Africa/Accra).
 * Performs parent contact resolution for students if direct phone is absent.
 * Enforces per-day idempotency via Firestore to prevent duplicate dispatches.
 */
async function executeDailyBirthdayScan(db, options = {}) {
  const force = Boolean(options.force);
  const dryRun = Boolean(options.dryRun);
  const triggerType = options.trigger || "server_cron_0900_gmt";

  // Ghana operates on GMT / UTC+0 (Africa/Accra) year-round without daylight savings
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Accra",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const todayDateStr = formatter.format(now); // "YYYY-MM-DD"
  const currentMMDD = todayDateStr.substring(5, 10); // "MM-DD"

  console.log(`[Birthday Scan] Executing scan for date: ${todayDateStr} (MM-DD: ${currentMMDD}) in timezone Africa/Accra (GMT). Trigger: ${triggerType}`);

  // Fetch all users
  const usersSnap = await db.collection("users").get();
  const celebrants = [];

  usersSnap.forEach((doc) => {
    const u = doc.data();
    if (!u) return;
    const status = (u.status || "ACTIVE").toUpperCase();
    if (status !== "ACTIVE") return;
    if (!u.date_of_birth) return;
    const dob = String(u.date_of_birth).trim();
    if (dob.length >= 10 && dob.substring(5, 10) === currentMMDD) {
      celebrants.push({
        id: doc.id,
        user_id: u.user_id || doc.id,
        first_name: u.first_name || "",
        last_name: u.last_name || "",
        role: u.role || "Student",
        phone: u.phone || "",
        date_of_birth: dob
      });
    }
  });

  const studentsCount = celebrants.filter(c => c.role === "Student").length;
  const staffCount = celebrants.filter(c => c.role !== "Student").length;

  console.log(`[Birthday Scan] Identified ${celebrants.length} total celebrant(s): ${studentsCount} student(s) and ${staffCount} staff member(s).`);

  if (celebrants.length === 0) {
    return {
      date: todayDateStr,
      timezone: "Africa/Accra (GMT)",
      totalCelebrants: 0,
      studentsCount: 0,
      staffCount: 0,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      dispatches: []
    };
  }

  // Pre-load parent relations, parent profiles, and general profiles for parent contact resolution
  let parentRelMap = {};
  let parentPhoneMap = {};
  let emergencyPhoneMap = {};

  try {
    const relSnap = await db.collection("parent_student_relations").get();
    relSnap.forEach(doc => {
      const r = doc.data();
      if (r && r.student_id && r.parent_id) {
        if (!parentRelMap[r.student_id] || r.is_primary) {
          parentRelMap[r.student_id] = r.parent_id;
        }
      }
    });

    const parentSnap = await db.collection("parent_profiles").get();
    parentSnap.forEach(doc => {
      const p = doc.data();
      if (p && p.parent_id && p.phone) {
        parentPhoneMap[p.parent_id] = p.phone;
      }
    });

    const profSnap = await db.collection("profiles").get();
    profSnap.forEach(doc => {
      const pr = doc.data();
      if (pr && pr.user_id && pr.emergency_contact) {
        try {
          const em = typeof pr.emergency_contact === "string" ? JSON.parse(pr.emergency_contact) : pr.emergency_contact;
          if (em && em.phone) emergencyPhoneMap[pr.user_id] = em.phone;
        } catch (e) {}
      }
    });
  } catch (err) {
    console.warn("[Birthday Scan] Notice: Non-critical issue reading parent relations:", err.message);
  }

  // Optional custom template from Firestore settings
  let defaultTemplate = "Happy Birthday, #name#! Father's Joy Academy wishes you a blessed day of growth and excellence!";
  try {
    const tplDoc = await db.collection("settings").doc("sms_templates").get();
    if (tplDoc.exists && tplDoc.data().birthday_message) {
      defaultTemplate = tplDoc.data().birthday_message;
    }
  } catch (e) {}

  const results = [];
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const celebrant of celebrants) {
    const isStaff = celebrant.role !== "Student";
    let targetPhone = celebrant.phone || "";
    let phoneSource = isStaff ? "staff_direct" : "student_direct";

    if (!isStaff && !targetPhone) {
      const pId = parentRelMap[celebrant.user_id];
      if (pId && parentPhoneMap[pId]) {
        targetPhone = parentPhoneMap[pId];
        phoneSource = "parent_primary";
      } else if (emergencyPhoneMap[celebrant.user_id]) {
        targetPhone = emergencyPhoneMap[celebrant.user_id];
        phoneSource = "emergency_contact";
      }
    }

    // Idempotency doc ID: e.g. bday_2026-09-27_u-teacher-2
    const dispatchDocId = `bday_${todayDateStr}_${celebrant.user_id}`;
    const dispatchRef = db.collection("birthday_dispatches").doc(dispatchDocId);

    // Check if already dispatched today
    if (!force) {
      const existingDoc = await dispatchRef.get();
      if (existingDoc.exists && existingDoc.data().status === "SENT") {
        console.log(`[Birthday Scan] Skipping celebrant ${celebrant.user_id} (${celebrant.first_name} ${celebrant.last_name}): already dispatched today.`);
        skippedCount++;
        results.push({
          userId: celebrant.user_id,
          name: `${celebrant.first_name} ${celebrant.last_name}`.trim(),
          role: celebrant.role,
          isStaff,
          status: "SKIPPED_ALREADY_SENT"
        });
        continue;
      }
    }

    // Personalize message
    const firstName = celebrant.first_name || (isStaff ? "Staff Member" : "Student");
    const fullName = `${celebrant.first_name} ${celebrant.last_name}`.trim();
    const personalizedMsg = defaultTemplate
      .replace(/#student_name#/g, firstName)
      .replace(/#name#/g, firstName)
      .replace(/#role#/g, celebrant.role);

    if (dryRun) {
      results.push({
        userId: celebrant.user_id,
        name: fullName,
        role: celebrant.role,
        isStaff,
        phone: targetPhone,
        phoneSource,
        message: personalizedMsg,
        status: "DRY_RUN_SIMULATED"
      });
      continue;
    }

    if (!targetPhone) {
      console.warn(`[Birthday Scan] Failed: No phone number resolved for ${fullName} (${celebrant.role})`);
      failedCount++;
      await dispatchRef.set({
        dispatch_id: dispatchDocId,
        date: todayDateStr,
        user_id: celebrant.user_id,
        recipient_name: fullName,
        role: celebrant.role,
        is_staff: isStaff,
        status: "FAILED_MISSING_PHONE",
        dispatched_at: admin.firestore.FieldValue.serverTimestamp(),
        trigger: triggerType
      }, { merge: true });

      results.push({
        userId: celebrant.user_id,
        name: fullName,
        role: celebrant.role,
        isStaff,
        status: "FAILED_MISSING_PHONE"
      });
      continue;
    }

    // Dispatch via Hubtel SMS
    const dispatchRes = await dispatchHubtelSMS(targetPhone, personalizedMsg);

    if (dispatchRes.success) {
      sentCount++;
      await dispatchRef.set({
        dispatch_id: dispatchDocId,
        date: todayDateStr,
        user_id: celebrant.user_id,
        recipient_name: fullName,
        role: celebrant.role,
        is_staff: isStaff,
        phone: targetPhone,
        phone_source: phoneSource,
        message: personalizedMsg,
        status: "SENT",
        hubtel_status: dispatchRes.status,
        hubtel_message_id: dispatchRes.messageId || null,
        dispatched_at: admin.firestore.FieldValue.serverTimestamp(),
        trigger: triggerType
      });

      // Also record in central sms_logs for administrative auditing
      try {
        await db.collection("sms_logs").add({
          type: "BIRTHDAY_GREETING",
          recipient_id: celebrant.user_id,
          recipient_name: fullName,
          recipient_role: celebrant.role,
          is_staff: isStaff,
          phone: targetPhone,
          phone_source: phoneSource,
          message: personalizedMsg,
          status: "DELIVERED",
          message_id: dispatchRes.messageId || null,
          automated: true,
          trigger: triggerType,
          dispatched_at: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (logErr) {
        console.warn("[Birthday Scan] Error logging to sms_logs:", logErr.message);
      }

      results.push({
        userId: celebrant.user_id,
        name: fullName,
        role: celebrant.role,
        isStaff,
        phone: targetPhone,
        status: "SENT",
        messageId: dispatchRes.messageId
      });
    } else {
      failedCount++;
      await dispatchRef.set({
        dispatch_id: dispatchDocId,
        date: todayDateStr,
        user_id: celebrant.user_id,
        recipient_name: fullName,
        role: celebrant.role,
        is_staff: isStaff,
        phone: targetPhone,
        message: personalizedMsg,
        status: "FAILED_GATEWAY",
        error: dispatchRes.error || dispatchRes.statusDescription,
        dispatched_at: admin.firestore.FieldValue.serverTimestamp(),
        trigger: triggerType
      }, { merge: true });

      results.push({
        userId: celebrant.user_id,
        name: fullName,
        role: celebrant.role,
        isStaff,
        phone: targetPhone,
        status: "FAILED",
        error: dispatchRes.error || dispatchRes.statusDescription
      });
    }
  }

  return {
    date: todayDateStr,
    timezone: "Africa/Accra (GMT)",
    totalCelebrants: celebrants.length,
    studentsCount,
    staffCount,
    sentCount,
    skippedCount,
    failedCount,
    dispatches: results
  };
}

/**
 * Scheduled Cloud Function: dailyBirthdayScheduler
 * 100% Server-Level Unattended Dispatch at fixed 09:00 AM GMT (Africa/Accra) every day.
 * Cron expression: "0 9 * * *"
 * Does not depend on any user or admin being logged in or browser being open.
 */
exports.dailyBirthdayScheduler = functions.pubsub
  .schedule("0 9 * * *")
  .timeZone("Africa/Accra")
  .onRun(async (context) => {
    console.log("[SERVER CRON] 9:00 AM GMT Unattended Birthday SMS Dispatch triggered.");
    const db = admin.firestore();
    const summary = await executeDailyBirthdayScan(db, {
      trigger: "unattended_server_cron_0900_gmt",
      force: false,
      dryRun: false
    });
    console.log("[SERVER CRON] 9:00 AM GMT Dispatch Completed Summary:", JSON.stringify(summary));
    return summary;
  });

/**
 * HTTP Endpoint: apiTriggerDailyBirthdayScan
 * Allows authorized on-demand execution, testing, or external webhook trigger.
 * Supported Query / Body parameters:
 *   - apiKey or key: internal API key
 *   - dryRun: "true" | true (evaluates celebrants and returns payload without dispatching SMS)
 *   - force: "true" | true (bypasses idempotency check for today)
 */
exports.apiTriggerDailyBirthdayScan = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  const authHeader = req.headers.authorization || "";
  const apiKey = req.headers["x-api-key"] || req.query?.apiKey || req.query?.key || req.body?.apiKey;
  const expectedKey = process.env.SMS_API_KEY || "fja-sms-authorized-key-2026";
  const isAuthorized = (authHeader && authHeader.startsWith("Bearer ") && authHeader.substring(7) === expectedKey) || (apiKey === expectedKey);

  if (!isAuthorized) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Valid Authorization header or apiKey parameter required."
    });
  }

  const dryRun = req.query?.dryRun === "true" || req.body?.dryRun === true;
  const force = req.query?.force === "true" || req.body?.force === true;

  try {
    const db = admin.firestore();
    const summary = await executeDailyBirthdayScan(db, {
      dryRun,
      force,
      trigger: "authorized_http_request"
    });

    return res.status(200).json({
      success: true,
      message: "Daily birthday scan executed successfully",
      summary
    });
  } catch (err) {
    console.error("apiTriggerDailyBirthdayScan error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to execute birthday scan"
    });
  }
});

module.exports = {
  normalizeGhanaPhone,
  dispatchHubtelSMS,
  executeDailyBirthdayScan
};
