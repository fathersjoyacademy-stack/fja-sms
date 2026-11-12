const assert = require("assert");
const { dispatchHubtelSMS, normalizeGhanaPhone } = require("../functions/index.js");

async function runDiagnostics() {
  console.log("===============================================================");
  console.log("  HUBTEL API BACKEND RESPONSE & LOGGING VERIFICATION");
  console.log("===============================================================\n");

  // Capture console.log and console.error output to verify logging behavior
  const logs = [];
  const errors = [];
  const origLog = console.log;
  const origError = console.error;

  console.log = (...args) => {
    logs.push(args.join(" "));
    origLog.apply(console, args);
  };
  console.error = (...args) => {
    errors.push(args.join(" "));
    origError.apply(console, args);
  };

  try {
    // -------------------------------------------------------------
    // TEST 1: Phone Normalization Test
    // -------------------------------------------------------------
    console.log("--- TEST 1: Testing Phone Normalization ---");
    assert.strictEqual(normalizeGhanaPhone("0244123456"), "233244123456");
    assert.strictEqual(normalizeGhanaPhone("+233 24 412 3456"), "233244123456");
    assert.strictEqual(normalizeGhanaPhone("233244123456"), "233244123456");
    origLog("✓ Normalization passed.\n");

    // -------------------------------------------------------------
    // TEST 2: Dispatch Valid Request and Check Logged HTTP Status & Body
    // -------------------------------------------------------------
    console.log("--- TEST 2: Real Hubtel POST Request Logging Verification ---");
    logs.length = 0;
    errors.length = 0;

    const testMsg = "Diagnostic verification: password reset message routing check.";
    const result = await dispatchHubtelSMS("0244123456", testMsg);

    origLog("\nCaptured Result Object:", JSON.stringify(result, null, 2));

    // Verify properties returned
    assert.strictEqual(typeof result.httpStatusCode, "number", "Result must contain numeric httpStatusCode");
    assert.strictEqual(typeof result.status, "number", "Result must contain numeric Hubtel status code");
    assert(result.rawResponse, "Result must contain raw response body from Hubtel");
    assert(result.statusDescription, "Result must contain statusDescription");

    // Verify console logs captured the HTTP status and body
    const hasHttpStatusLog = logs.some(l => l.includes("[Hubtel SMS Response] HTTP Status:"));
    const hasRawBodyLog = logs.some(l => l.includes("[Hubtel SMS Response] Raw Body:"));
    assert(hasHttpStatusLog, "Backend must log HTTP status code");
    assert(hasRawBodyLog, "Backend must log raw response body");
    origLog("✓ Test 2 Passed: HTTP Status and JSON response body logged successfully.\n");

    // -------------------------------------------------------------
    // TEST 3: Invalid Phone Format Handling and Logging
    // -------------------------------------------------------------
    console.log("--- TEST 3: Invalid Recipient Format Logging ---");
    logs.length = 0;
    errors.length = 0;

    const invalidResult = await dispatchHubtelSMS("123", "Short phone");
    assert.strictEqual(invalidResult.success, false);
    assert.strictEqual(invalidResult.httpStatusCode, 400);
    assert.strictEqual(invalidResult.status, -1);
    origLog("✓ Test 3 Passed: Invalid numbers correctly rejected and logged.\n");

    console.log("===============================================================");
    console.log("  ALL HUBTEL API BACKEND LOGGING TESTS COMPLETED SUCCESSFULLY");
    console.log("===============================================================");
  } finally {
    console.log = origLog;
    console.error = origError;
  }
}

runDiagnostics().catch(err => {
  console.error("DIAGNOSTIC TEST FAILED:", err);
  process.exit(1);
});
