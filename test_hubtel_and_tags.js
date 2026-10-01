const assert = require("assert");

// 1. Ghanaian Phone Normalization tests
function normalizeGhanaPhone(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = "233" + digits.substring(1);
  } else if (digits.startsWith("233")) {
    // already 233
  } else if (digits.length === 9) {
    digits = "233" + digits;
  }
  return digits;
}

console.log("=== 1. Testing Phone Normalization ===");
assert.strictEqual(normalizeGhanaPhone("0244123456"), "233244123456");
assert.strictEqual(normalizeGhanaPhone("+233 24 412 3456"), "233244123456");
assert.strictEqual(normalizeGhanaPhone("244123456"), "233244123456");
assert.strictEqual(normalizeGhanaPhone("055-987-6543"), "233559876543");
assert.strictEqual(normalizeGhanaPhone("233201234567"), "233201234567");
console.log("✓ Phone normalization passed all cases!");

// 2. Tag Resolution Engine tests
function resolveBroadcastTags(template, context = {}) {
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
}

console.log("=== 2. Testing Tag Resolution & Aliases ===");
const sampleCtx = {
  parent_name: "Mr. Kwabena Mensah",
  student_name: "Kofi Mensah",
  fees_paid: "GH¢ 600.00",
  outstanding_fees: "GH¢ 150.00",
  days_absented: "1 day",
  uid: "P-1042"
};

const template1 = "Dear #parent_name#, your ward #student_name# (ID: #uid#) has paid #fees_paid# with #outstanding_fees# remaining. Absences this week: #days_absented#.";
const res1 = resolveBroadcastTags(template1, sampleCtx);
console.log("Result 1:", res1);
assert.strictEqual(
  res1,
  "Dear Mr. Kwabena Mensah, your ward Kofi Mensah (ID: P-1042) has paid GH¢ 600.00 with GH¢ 150.00 remaining. Absences this week: 1 day."
);

// Bracket syntax test
const template2 = "Dear {parent_name}, ward {student_name} owes {arrears}. Absences: {days_absent}.";
const res2 = resolveBroadcastTags(template2, sampleCtx);
console.log("Result 2:", res2);
assert.strictEqual(
  res2,
  "Dear Mr. Kwabena Mensah, ward Kofi Mensah owes GH¢ 150.00. Absences: 1 day."
);

// Case-insensitivity test
const template3 = "Notice for #PARENT_NAME#: Student #STUDENT_NAME# paid #FEES_PAID# and owes #FEES_OWED#.";
const res3 = resolveBroadcastTags(template3, sampleCtx);
console.log("Result 3:", res3);
assert.strictEqual(
  res3,
  "Notice for Mr. Kwabena Mensah: Student Kofi Mensah paid GH¢ 600.00 and owes GH¢ 150.00."
);

console.log("✓ Tag resolution passed all cases!");

// 3. Relational Matching Simulation
console.log("=== 3. Testing Relational Matching Simulation ===");
const mockUsers = [
  { user_id: "u-p1", uid: "P-101", first_name: "Kwame", last_name: "Mensah", role: "Parent", phone: "0244111222" },
  { user_id: "u-s1", uid: "S-201", first_name: "Kofi", last_name: "Mensah", role: "Student", phone: "0244111222" },
  { user_id: "u-p2", uid: "P-102", first_name: "Akua", last_name: "Agyeman", role: "Parent", phone: "0209998888" },
  { user_id: "u-s2", uid: "S-202", first_name: "Yaw", last_name: "Agyeman", role: "Student", phone: "0550001111" }
];

const mockParentProfiles = [
  { parent_id: "pp-102", first_name: "Akua", last_name: "Agyeman", phone: "0209998888" }
];

const mockParentRelations = [
  { parent_id: "pp-102", student_id: "u-s2", relation_type: "Mother" }
];

const mockProfiles = [
  { user_id: "u-s1", emergency_contact: { primary: { name: "Kwame Mensah", phone: "0244111222" } } }
];

// Verify parent 1 matches Kofi Mensah via emergency contact & phone
const p1 = mockUsers[0];
const normP1Phone = normalizeGhanaPhone(p1.phone);
const matchedS1 = mockUsers.find(u => u.role === "Student" && normalizeGhanaPhone(u.phone) === normP1Phone);
assert.strictEqual(matchedS1.first_name, "Kofi");

// Verify parent 2 matches Yaw Agyeman via parent_profiles & parent_student_relations
const p2 = mockUsers[2];
const normP2Phone = normalizeGhanaPhone(p2.phone);
const pp2 = mockParentProfiles.find(pp => normalizeGhanaPhone(pp.phone) === normP2Phone);
assert(pp2 !== undefined);
const rel2 = mockParentRelations.find(r => r.parent_id === pp2.parent_id);
assert(rel2 !== undefined);
const matchedS2 = mockUsers.find(u => u.user_id === rel2.student_id);
assert.strictEqual(matchedS2.first_name, "Yaw");
console.log("✓ Relational parent-student matching passed all scenarios!");

console.log("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!");
