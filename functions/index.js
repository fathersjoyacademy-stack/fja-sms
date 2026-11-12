const functions = require("firebase-functions");
const admin = require("firebase-admin");
const https = require("https");
const fs = require("fs");
const path = require("path");

if (!admin.apps.length) {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, "../serviceAccountKey.json");
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const sa = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
      admin.initializeApp({
        credential: admin.credential.cert(sa),
        projectId: sa.project_id || "fja-sms"
      });
    } catch (e) {
      admin.initializeApp({ projectId: "fja-sms" });
    }
  } else {
    admin.initializeApp({
      projectId: process.env.GCLOUD_PROJECT || "fja-sms"
    });
  }
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
 * Internal helper to dispatch SMS to Hubtel Gateway with exhaustive HTTP status and body logging
 */
function dispatchHubtelSMS(phone, message) {
  return new Promise((resolve) => {
    const normalizedPhone = normalizeGhanaPhone(phone);
    if (!normalizedPhone || normalizedPhone.length < 10) {
      console.warn(`[Hubtel SMS Error] Invalid Ghanaian phone number format provided: "${phone}"`);
      return resolve({
        success: false,
        httpStatusCode: 400,
        status: -1,
        statusDescription: "Invalid Ghanaian phone number format",
        error: "Invalid Ghanaian phone number format",
        normalizedPhone
      });
    }

    const payload = JSON.stringify({
      From: HUBTEL_CONFIG.from,
      To: normalizedPhone,
      Content: message,
      RegisteredDelivery: true
    });

    const authHeader = "Basic " + Buffer.from(`${HUBTEL_CONFIG.clientId}:${HUBTEL_CONFIG.clientSecret}`).toString("base64");
    
    console.log(`[Hubtel SMS Dispatch] Initiating POST to ${HUBTEL_CONFIG.endpoint}`);
    console.log(`[Hubtel SMS Dispatch] Recipient: ${normalizedPhone} | SenderID: "${HUBTEL_CONFIG.from}" | Length: ${message.length} chars`);
    console.log(`[Hubtel SMS Dispatch] Payload Preview: "${message.substring(0, 80).replace(/\n/g, ' ')}${message.length > 80 ? '...' : ''}"`);

    const urlObj = new URL(HUBTEL_CONFIG.endpoint);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "Content-Length": Buffer.byteLength(payload)
      },
      timeout: 15000 // 15-second network timeout
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        const httpStatus = res.statusCode;
        const httpStatusMsg = res.statusMessage || "";
        console.log(`[Hubtel SMS Response] HTTP Status: ${httpStatus} ${httpStatusMsg}`);
        console.log(`[Hubtel SMS Response] Response Headers:`, JSON.stringify(res.headers));
        console.log(`[Hubtel SMS Response] Raw Body: ${data}`);

        try {
          const parsed = JSON.parse(data);
          // Hubtel Status Code 0 = Success (HTTP status 200 or 201 Created)
          const isSuccess = (httpStatus === 200 || httpStatus === 201) && parsed.status === 0;

          // Interpret known Hubtel status codes for clear diagnostics
          let diagnosticNote = "";
          switch (parsed.status) {
            case 0:
              diagnosticNote = "Request submitted successfully";
              break;
            case 1:
              diagnosticNote = "Invalid recipient phone number or format";
              break;
            case 2:
              diagnosticNote = "Message Undelivered / Expired in SMSC queue";
              break;
            case 3:
              diagnosticNote = "Message Failed / Rejected by Telco";
              break;
            case 11:
              diagnosticNote = `Invalid or unapproved SenderId (${HUBTEL_CONFIG.from}). Telcos rejected this Sender ID.`;
              break;
            case 12:
              diagnosticNote = "Insufficient SMS credits / Payment required on Hubtel account";
              break;
            case 100:
              diagnosticNote = "Authentication failure: ClientSecret does not match ApiKey/ClientId";
              break;
            default:
              diagnosticNote = parsed.statusDescription || `Hubtel gateway returned code ${parsed.status}`;
          }

          if (isSuccess) {
            console.log(`[Hubtel SMS SUCCESS] MsgID: ${parsed.messageId} | Rate: ${parsed.rate} | Network: ${parsed.networkId} | Note: ${diagnosticNote}`);
          } else {
            console.error(`[Hubtel SMS REJECTED/FAILED] HTTP: ${httpStatus} | Gateway Status: ${parsed.status} | Reason: ${diagnosticNote} | Raw: ${data}`);
          }

          resolve({
            success: isSuccess,
            httpStatusCode: httpStatus,
            status: parsed.status,
            statusDescription: parsed.statusDescription || diagnosticNote,
            messageId: parsed.messageId || null,
            rate: parsed.rate || 0,
            networkId: parsed.networkId || null,
            clientReference: parsed.clientReference || null,
            normalizedPhone,
            rawResponse: data,
            raw: parsed
          });
        } catch (parseErr) {
          console.error(`[Hubtel SMS Parse Error] HTTP ${httpStatus}: Failed to parse JSON response. Body: ${data}`);
          resolve({
            success: false,
            httpStatusCode: httpStatus,
            status: -2,
            statusDescription: `HTTP ${httpStatus}: Failed to parse Hubtel JSON response`,
            error: "Failed to parse Hubtel JSON response",
            rawResponse: data,
            normalizedPhone
          });
        }
      });
    });

    req.on("timeout", () => {
      req.destroy();
      console.error(`[Hubtel SMS Network Timeout] Request to ${HUBTEL_CONFIG.endpoint} timed out after 15s`);
      resolve({
        success: false,
        httpStatusCode: 408,
        status: -3,
        statusDescription: "Network timeout connecting to Hubtel SMS gateway",
        error: "Network timeout after 15 seconds",
        normalizedPhone
      });
    });

    req.on("error", (err) => {
      console.error(`[Hubtel SMS Network Error] Failed to connect to Hubtel: ${err.message}`);
      resolve({
        success: false,
        httpStatusCode: 500,
        status: -4,
        statusDescription: `Network error: ${err.message}`,
        error: err.message,
        normalizedPhone
      });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Firebase Callable Function: sendSchoolSMS
 * Invoked securely from the client web portal via firebase.functions().httpsCallable("sendSchoolSMS")
 */
exports.sendSchoolSMS = functions.https.onCall(async (data, context) => {
  const callerUid = context.auth ? context.auth.uid : "ANONYMOUS";
  console.log(`[sendSchoolSMS Callable] Invoked by caller UID: ${callerUid}`);

  // Ensure the caller is authenticated
  if (!context.auth) {
    console.warn(`[sendSchoolSMS 401] Rejected unauthenticated caller.`);
    throw new functions.https.HttpsError("unauthenticated", "Authentication required. You must be signed into Father's Joy Academy portal to dispatch SMS.");
  }

  const { recipientPhone, message } = data || {};
  if (!recipientPhone || !message) {
    throw new functions.https.HttpsError("invalid-argument", "recipientPhone and message are required.");
  }

  console.log(`[sendSchoolSMS] Dispatching to ${recipientPhone} from caller ${callerUid}`);
  const result = await dispatchHubtelSMS(recipientPhone, message);
  console.log(`[sendSchoolSMS Result] Caller: ${callerUid} | Phone: ${recipientPhone} | Success: ${result.success} | HTTP: ${result.httpStatusCode} | Status: ${result.status} | Description: ${result.statusDescription}`);
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
    console.warn(`[apiSendSMS 401 Unauthorized] Invalid or missing API key from IP: ${req.ip}`);
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Valid Authorization header or X-API-Key required to dispatch SMS."
    });
  }

  const phone = req.body?.recipientPhone || req.query?.to || req.body?.to;
  const message = req.body?.message || req.query?.content || req.body?.content;

  if (!phone || !message) {
    console.warn(`[apiSendSMS 400 Bad Request] Missing parameters: phone=${phone}, messageLength=${message ? message.length : 0}`);
    return res.status(400).json({
      success: false,
      error: "Missing required parameters: 'recipientPhone' (or 'to') and 'message' (or 'content')"
    });
  }

  console.log(`[apiSendSMS Request] Dispatching SMS to ${phone} (Message length: ${message.length} chars)`);
  const result = await dispatchHubtelSMS(phone, message);
  console.log(`[apiSendSMS Result] Success: ${result.success} | HTTP: ${result.httpStatusCode} | HubtelStatus: ${result.status} | MsgId: ${result.messageId}`);
  
  const returnCode = result.success ? 200 : (result.httpStatusCode || (result.status === 12 ? 402 : 400));
  return res.status(returnCode).json(result);
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
    // Parent accounts do not receive student/staff birthday SMS
    if (u.role === "Parent") return;
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
  const staffCount = celebrants.filter(c => c.role !== "Student" && c.role !== "Parent").length;

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

  // Pre-load parent relations ONLY for students who actually lack a direct phone number
  // Concurrency and Quota Optimization: Avoids bulk downloading 3 entire collections on every daily run
  const studentsNeedingParents = celebrants.filter(c => c.role === "Student" && !c.phone);

  let parentRelMap = {};
  let parentPhoneMap = {};
  let emergencyPhoneMap = {};

  if (studentsNeedingParents.length > 0) {
    try {
      const targetStudentIds = new Set(studentsNeedingParents.map(s => s.user_id));
      const relCollection = db.collection("parent_student_relations");

      if (typeof relCollection.where === "function") {
        for (const st of studentsNeedingParents) {
          const relSnap = await relCollection.where("student_id", "==", st.user_id).get();
          if (relSnap && !relSnap.empty) {
            relSnap.forEach(doc => {
              const r = doc.data();
              if (r && r.parent_id && (!parentRelMap[st.user_id] || r.is_primary)) {
                parentRelMap[st.user_id] = r.parent_id;
              }
            });
          }
        }
      } else {
        // Fallback for mock environments
        const relSnap = await relCollection.get();
        relSnap.forEach(doc => {
          const r = doc.data();
          if (r && r.student_id && r.parent_id && targetStudentIds.has(r.student_id)) {
            if (!parentRelMap[r.student_id] || r.is_primary) {
              parentRelMap[r.student_id] = r.parent_id;
            }
          }
        });
      }

      // Fetch only the specific parent profiles identified
      const neededParentIds = new Set(Object.values(parentRelMap));
      for (const pId of neededParentIds) {
        try {
          const pDoc = await db.collection("parent_profiles").doc(pId).get();
          if (pDoc && pDoc.exists && pDoc.data() && pDoc.data().phone) {
            parentPhoneMap[pId] = pDoc.data().phone;
          } else {
            const pSnap = await db.collection("parent_profiles").get();
            pSnap.forEach(doc => {
              const p = doc.data();
              if (p && (p.parent_id === pId || doc.id === pId) && p.phone) {
                parentPhoneMap[pId] = p.phone;
              }
            });
          }
        } catch (e) {}
      }

      // Fallback to student profile emergency contact for any student still missing a parent phone
      for (const st of studentsNeedingParents) {
        if (!parentRelMap[st.user_id]) {
          try {
            const profDoc = await db.collection("profiles").doc(st.user_id).get();
            if (profDoc && profDoc.exists && profDoc.data() && profDoc.data().emergency_contact) {
              const em = typeof profDoc.data().emergency_contact === "string" ? JSON.parse(profDoc.data().emergency_contact) : profDoc.data().emergency_contact;
              if (em && em.phone) emergencyPhoneMap[st.user_id] = em.phone;
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn("[Birthday Scan] Notice: Non-critical issue reading parent relations:", err.message);
    }
  }

  // Optional custom template from Firestore settings
  let defaultTemplate = "Happy Birthday, #student_name#! Father's Joy Academy wishes you a blessed day of growth and excellence!";
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
        http_status: dispatchRes.httpStatusCode,
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
          http_status: dispatchRes.httpStatusCode,
          hubtel_status: dispatchRes.status,
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
      console.error(`[Birthday Scan SMS Failed] Celebrant: ${celebrant.user_id} (${fullName}) | Phone: ${targetPhone} | HTTP Status: ${dispatchRes.httpStatusCode} | Hubtel Status: ${dispatchRes.status} | Reason: ${dispatchRes.statusDescription || dispatchRes.error} | Raw: ${dispatchRes.rawResponse || ""}`);

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
        http_status: dispatchRes.httpStatusCode,
        hubtel_status: dispatchRes.status,
        error: dispatchRes.error || dispatchRes.statusDescription,
        raw_response: dispatchRes.rawResponse || null,
        dispatched_at: admin.firestore.FieldValue.serverTimestamp(),
        trigger: triggerType
      }, { merge: true });

      // Audit Log: Record failure in central sms_logs so administrators can troubleshoot
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
          status: "FAILED",
          http_status: dispatchRes.httpStatusCode,
          hubtel_status: dispatchRes.status,
          error: dispatchRes.error || dispatchRes.statusDescription,
          raw_response: dispatchRes.rawResponse || null,
          automated: true,
          trigger: triggerType,
          dispatched_at: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (logErr) {
        console.warn("[Birthday Scan] Error logging failure to sms_logs:", logErr.message);
      }

      results.push({
        userId: celebrant.user_id,
        name: fullName,
        role: celebrant.role,
        isStaff,
        phone: targetPhone,
        status: "FAILED",
        httpStatus: dispatchRes.httpStatusCode,
        hubtelStatus: dispatchRes.status,
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
