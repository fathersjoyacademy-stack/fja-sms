/**
 * 100% Server-Level Unattended Birthday SMS Dispatch Runner
 * Designed to run at fixed 09:00 AM GMT (Africa/Accra) every day via:
 * - Firebase Cloud Scheduler / Cloud Functions (functions.pubsub.schedule)
 * - GitHub Actions Cron (schedule: 0 9 * * *)
 * - Windows Task Scheduler / Linux cron / PM2 / VPS / Node daemon
 */
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// Initialize Firebase Admin with service account credentials before loading application modules
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, "../serviceAccountKey.json");
if (fs.existsSync(serviceAccountPath)) {
  console.log(`Loading service account credentials from: ${serviceAccountPath}`);
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  if (admin.apps.length > 0) {
    admin.app().delete();
  }
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || "fja-sms"
  });
} else {
  console.log("No serviceAccountKey.json detected. Initializing with default project 'fja-sms'...");
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: process.env.GCLOUD_PROJECT || "fja-sms"
    });
  }
}

const { executeDailyBirthdayScan } = require("../functions/index.js");

async function main() {
  console.log("========================================================");
  console.log("  Father's Joy Academy - Unattended Birthday SMS Runner  ");
  console.log("  Schedule: Fixed 09:00 AM GMT Everyday (Africa/Accra)  ");
  console.log("========================================================");

  const db = admin.firestore();
  console.log("Connected to Firestore. Starting daily celebrants scan...");

  try {
    const summary = await executeDailyBirthdayScan(db, {
      trigger: "server_cron_0900_gmt",
      force: process.argv.includes("--force"),
      dryRun: process.argv.includes("--dry-run")
    });

    console.log("\nScan Execution Summary:");
    console.log(`- Date (Africa/Accra / GMT): ${summary.date}`);
    console.log(`- Total Celebrants Today:   ${summary.totalCelebrants}`);
    console.log(`  * Students:               ${summary.studentsCount}`);
    console.log(`  * Staff:                  ${summary.staffCount}`);
    console.log(`- Sent Successfully:        ${summary.sentCount}`);
    console.log(`- Skipped (Already Sent):   ${summary.skippedCount}`);
    console.log(`- Failed:                   ${summary.failedCount}`);

    if (summary.dispatches && summary.dispatches.length > 0) {
      console.log("\nCelebrant Details:");
      summary.dispatches.forEach((d, idx) => {
        console.log(`  [${idx + 1}] ${d.name} (${d.role}${d.isStaff ? " - Staff" : " - Student"}) -> Phone: ${d.phone || "N/A"} | Status: ${d.status}`);
      });
    }

    console.log("\nExecution completed successfully.");
    process.exit(0);
  } catch (err) {
    if (err.code === 8 || (err.message && err.message.includes("Quota exceeded"))) {
      console.warn("\n========================================================");
      console.warn("  FIRESTORE QUOTA NOTICE (Spark Plan: 50,000 reads/day) ");
      console.warn("========================================================");
      console.warn("The free tier daily document read limit was reached for today.");
      console.warn("Firestore automatically resets daily quotas at 00:00 PST (08:00 AM GMT).");
      console.warn("The unattended runner will resume cleanly at tomorrow's 09:00 AM GMT schedule.");
      process.exit(0);
    }
    console.error("FATAL ERROR in Unattended Birthday SMS Runner:", err);
    process.exit(1);
  }
}

main();
