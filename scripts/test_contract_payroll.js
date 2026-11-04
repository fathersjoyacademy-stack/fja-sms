const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("==================================================================");
console.log("   TESTING CONTRACT OPTION & CASUAL/PERMANENT PAYROLL ENGINE      ");
console.log("==================================================================\n");

// Mock window and DB environment to test api.js in Node
const mockIndexedDbData = {
  users: [
    { user_id: "u-teacher-1", uid: "T20260001", first_name: "Kofi", last_name: "Mensah", role: "Teacher", status: "ACTIVE", phone: "0241234567" },
    { user_id: "u-driver-1", uid: "ST20260002", first_name: "Kwame", last_name: "Boateng", role: "NonTeachingStaff", status: "ACTIVE", phone: "0509876543" }
  ],
  profiles: [
    { profile_id: "p-u-teacher-1", user_id: "u-teacher-1", base_salary: 2500.00, allowances: 300.00, address: "Ghana" },
    { profile_id: "p-u-driver-1", user_id: "u-driver-1", base_salary: 1800.00, allowances: 200.00, address: "Ghana" }
  ],
  financial_transactions: [],
  audit_logs: []
};

global.window = {
  db: {
    get: async (store, id) => {
      const list = mockIndexedDbData[store] || [];
      const keyField = store === "users" ? "user_id" : (store === "profiles" ? "profile_id" : "id");
      return list.find(item => item[keyField] === id || item.user_id === id);
    },
    getAll: async (store) => {
      return [...(mockIndexedDbData[store] || [])];
    },
    put: async (store, item) => {
      if (!mockIndexedDbData[store]) mockIndexedDbData[store] = [];
      const keyField = store === "users" ? "user_id" : (store === "profiles" ? "profile_id" : "id");
      const idx = mockIndexedDbData[store].findIndex(x => x[keyField] === item[keyField]);
      if (idx >= 0) {
        mockIndexedDbData[store][idx] = { ...item };
      } else {
        mockIndexedDbData[store].push({ ...item });
      }
      return item;
    }
  },
  payrollAdjustments: {}
};

// Load api.js definitions into window.api
const apiCode = fs.readFileSync(path.join(__dirname, "../portal/api.js"), "utf8");
const vm = require("vm");
vm.runInThisContext(`(function() {\n${apiCode}\n})()`);

const api = global.window.api;
assert.ok(api, "window.api must be initialized");
assert.strictEqual(typeof api.calculatePayroll, "function", "api.calculatePayroll must be a function");

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    testsFailed++;
  }
}

// 1. Permanent Staff Default & Preservation of Existing Behavior
runTest("1. Existing Permanent staff calculation is completely preserved (GH¢ 2,500 base, GH¢ 300 allowance, GH¢ 200 adv)", () => {
  const result = api.calculatePayroll(2500, 300, 0, 200);
  assert.strictEqual(result.gross, 2800.00, "Gross should be base + allowance (2800)");
  assert.strictEqual(result.ssnit, 154.00, "SSNIT should be 5.5% (154.00)");
  assert.strictEqual(result.paye, 342.65, "PAYE should be progressive 342.65");
  assert.strictEqual(result.withholdingTax, 0.00, "Withholding tax should be 0.00 for permanent staff");
  assert.strictEqual(result.netPay, 2103.35, "Net pay should be gross - ssnit - paye - advance (2103.35)");
  assert.strictEqual(result.isCasual, false, "Should be flagged as not casual");
  assert.strictEqual(result.contractType, "permanent", "Contract type should default to permanent");
});

runTest("2. Explicitly Permanent staff preserves SSNIT and PAYE deductions", () => {
  const result = api.calculatePayroll(2500, 300, 0, 200, "permanent");
  assert.strictEqual(result.ssnit, 154.00);
  assert.strictEqual(result.paye, 342.65);
  assert.strictEqual(result.withholdingTax, 0.00);
  assert.strictEqual(result.netPay, 2103.35);
  assert.strictEqual(result.isCasual, false);
});

// 2. Casual / Contract Option Behavior
runTest("3. Toggled to Contract: Keeps base and allowances, NO SSNIT, NO PAYE, 10% Withholding Tax", () => {
  const result = api.calculatePayroll(2500, 300, 0, 200, "contract");
  // Keeps base (2500) and allowances (300) => Gross = 2800
  assert.strictEqual(result.gross, 2800.00, "Gross must keep base + allowance (2800.00)");
  // Does NOT deduct SSNIT
  assert.strictEqual(result.ssnit, 0.00, "SSNIT must be 0.00 (not deducted)");
  // Does NOT deduct PAYE
  assert.strictEqual(result.paye, 0.00, "PAYE must be 0.00 (not deducted)");
  // Deducts 10% mandatory withholding tax => 2800 * 0.10 = 280.00
  assert.strictEqual(result.withholdingTax, 280.00, "Withholding tax must be exactly 10% of gross (280.00)");
  // Net payout = Gross (2800) - Withholding Tax (280) - Advance (200) = 2320.00
  assert.strictEqual(result.netPay, 2320.00, "Net payout must be Gross - 10% WHT - advance (2320.00)");
  assert.strictEqual(result.isContract, true, "isContract flag must be true");
  assert.strictEqual(result.isCasual, true, "isCasual flag must be true for backward compatibility");
  assert.strictEqual(result.contractType, "contract", "contractType must be contract");
});

runTest("3b. Backward compatibility: passing 'casual' also yields 10% WHT, 0 SSNIT, 0 PAYE", () => {
  const result = api.calculatePayroll(2500, 300, 0, 200, "casual");
  assert.strictEqual(result.gross, 2800.00);
  assert.strictEqual(result.ssnit, 0.00);
  assert.strictEqual(result.paye, 0.00);
  assert.strictEqual(result.withholdingTax, 280.00);
  assert.strictEqual(result.netPay, 2320.00);
  assert.strictEqual(result.isContract, true);
  assert.strictEqual(result.contractType, "contract");
});

runTest("4. Casual staff with only base salary (GH¢ 1,800 base, 0 allowance, 0 adjustments)", () => {
  const result = api.calculatePayroll(1800, 0, 0, 0, "casual");
  assert.strictEqual(result.gross, 1800.00);
  assert.strictEqual(result.ssnit, 0.00, "No SSNIT deducted");
  assert.strictEqual(result.paye, 0.00, "No PAYE deducted");
  assert.strictEqual(result.withholdingTax, 180.00, "10% mandatory withholding tax on 1800 is 180.00");
  assert.strictEqual(result.netPay, 1620.00, "Net is 1800 - 180 = 1620.00");
});

runTest("5. Casual staff with special additions (bonus) (GH¢ 2,000 base + GH¢ 500 allowance + GH¢ 300 bonus)", () => {
  const result = api.calculatePayroll(2000, 500, 300, 0, "casual");
  assert.strictEqual(result.gross, 2800.00, "Gross includes base + allowance + bonus");
  assert.strictEqual(result.ssnit, 0.00);
  assert.strictEqual(result.paye, 0.00);
  assert.strictEqual(result.withholdingTax, 280.00, "10% WHT applies to gross earnings (280.00)");
  assert.strictEqual(result.netPay, 2520.00, "Net is 2800 - 280 = 2520.00");
});

// 3. Flexible Signature Support
runTest("6. Flexible signature: calculatePayroll(base, allow, 'casual') correctly detects casual contract", () => {
  const result = api.calculatePayroll(3000, 200, "casual");
  assert.strictEqual(result.gross, 3200.00);
  assert.strictEqual(result.ssnit, 0.00);
  assert.strictEqual(result.paye, 0.00);
  assert.strictEqual(result.withholdingTax, 320.00);
  assert.strictEqual(result.netPay, 2880.00);
  assert.strictEqual(result.isCasual, true);
});

// 4. End-to-end Toggle function test
(async () => {
  await (async () => {
    try {
      console.log("\n--- Testing api.toggleStaffContractType ---");
      const teacherId = "u-teacher-1";

      // 1. Initial state: undefined contract_type (existing data defaults to permanent)
      const userBefore = await window.db.get("users", teacherId);
      const profBefore = await window.db.get("profiles", "p-u-teacher-1");
      assert.strictEqual(userBefore.contract_type, undefined, "Existing user has no contract_type initially");
      const calcBefore = api.calculatePayroll(profBefore.base_salary, profBefore.allowances, 0, 0, profBefore.contract_type);
      assert.strictEqual(calcBefore.contractType, "permanent");
      assert.strictEqual(calcBefore.ssnit, 154.00);
      assert.strictEqual(calcBefore.withholdingTax, 0.00);
      console.log("[PASS] 7. Unmodified existing record defaults to permanent calculation");
      testsPassed++;

      // 2. Toggle to contract
      const toggledToContract = await api.toggleStaffContractType(teacherId);
      assert.strictEqual(toggledToContract.contractType, "contract", "Should now be contract");
      
      const userAfterContract = await window.db.get("users", teacherId);
      const profAfterContract = await window.db.get("profiles", "p-u-teacher-1");
      assert.strictEqual(userAfterContract.contract_type, "contract");
      assert.strictEqual(profAfterContract.contract_type, "contract");

      // Verify calculation after toggle
      const calcContract = api.calculatePayroll(profAfterContract.base_salary, profAfterContract.allowances, 0, 0, profAfterContract.contract_type);
      assert.strictEqual(calcContract.gross, 2800.00, "Base and allowance preserved intact");
      assert.strictEqual(calcContract.ssnit, 0.00, "SSNIT waived");
      assert.strictEqual(calcContract.paye, 0.00, "PAYE waived");
      assert.strictEqual(calcContract.withholdingTax, 280.00, "10% mandatory withholding tax applied");
      assert.strictEqual(calcContract.netPay, 2520.00, "Net is 2800 - 280 = 2520.00");
      console.log("[PASS] 8. Toggled to Contract: Base & allowances preserved, SSNIT & PAYE 0, 10% WHT deducted");
      testsPassed++;

      // 3. Toggle back to permanent
      const toggledBack = await api.toggleStaffContractType(teacherId);
      assert.strictEqual(toggledBack.contractType, "permanent", "Should now be permanent");
      
      const userAfterPerm = await window.db.get("users", teacherId);
      const profAfterPerm = await window.db.get("profiles", "p-u-teacher-1");
      assert.strictEqual(userAfterPerm.contract_type, "permanent");
      assert.strictEqual(profAfterPerm.contract_type, "permanent");

      // Verify calculation restored
      const calcPermRestored = api.calculatePayroll(profAfterPerm.base_salary, profAfterPerm.allowances, 0, 0, profAfterPerm.contract_type);
      assert.strictEqual(calcPermRestored.ssnit, 154.00, "SSNIT restored");
      assert.strictEqual(calcPermRestored.paye, 342.65, "PAYE restored");
      assert.strictEqual(calcPermRestored.withholdingTax, 0.00, "WHT is 0.00");
      assert.strictEqual(calcPermRestored.netPay, 2303.35, "Permanent net payout restored");
      console.log("[PASS] 9. Toggled back to Permanent: SSNIT & PAYE restored, WHT 0");
      testsPassed++;

    } catch (e) {
      console.error("[FAIL] Toggle Staff Contract Type:", e);
      testsFailed++;
    }
  })();

  console.log("\n==================================================================");
  console.log(`TOTAL TESTS: ${testsPassed + testsFailed} | PASSED: ${testsPassed} | FAILED: ${testsFailed}`);
  console.log("==================================================================");

  if (testsFailed > 0) {
    process.exit(1);
  }
})();
