const assert = require("assert");

// Load api.js simulation environment
const mockDbData = {
  users: [
    { user_id: 'u-proprietor-1', uid: 'PR20260001', role: 'Proprietor', first_name: 'Ebenezer', last_name: 'Mensah', phone: '0551112233', password_hash: 'proprietor123', status: 'ACTIVE' },
    { user_id: 'u-headteacher-1', uid: 'HT20260001', role: 'HeadTeacher', first_name: 'Comfort', last_name: 'Appiah', phone: '0554445566', password_hash: 'headteacher123', status: 'ACTIVE' },
    { user_id: 'u-teacher-1', uid: 'FJT20260001', role: 'Teacher', first_name: 'Isaac', last_name: 'Boateng', phone: '0244112233', password_hash: 'teacher123', status: 'ACTIVE' },
    { user_id: 'u-teacher-2', uid: 'FJT20260002', role: 'Teacher', first_name: 'Alice', last_name: 'Ofori', phone: '0244998877', password_hash: 'teacher123', status: 'ACTIVE' },
    { user_id: 'u-student-1', uid: 'FJS20260001', role: 'Student', first_name: 'Emmanuel', last_name: 'Junior', phone: '0201234567', password_hash: 'student123', status: 'ACTIVE' },
    { user_id: 'u-student-2', uid: 'FJS20260002', role: 'Student', first_name: 'Priscilla', last_name: 'Mensah', phone: '0559876543', password_hash: 'student123', status: 'ACTIVE' }
  ],
  profiles: [
    { profile_id: 'p-1', user_id: 'u-student-1', emergency_contact: JSON.stringify({ primary: { first_name: 'Kwame', last_name: 'Boateng', phone: '0201234567', relation: 'Father' } }) },
    { profile_id: 'p-2', user_id: 'u-student-2', emergency_contact: JSON.stringify({ name: 'Grace Mensah', phone: '0559876543', relation: 'Mother' }) },
    { profile_id: 'p-ht', user_id: 'u-headteacher-1', additional_role: 'sectional head' }
  ],
  parent_profiles: [
    { parent_id: 'pp-boateng', first_name: 'Kwame', last_name: 'Boateng', phone: '0201234567' }
  ],
  parent_student_relations: [
    { relation_id: 'rel-1', parent_id: 'pp-boateng', student_id: 'u-student-1', relation_type: 'Father' }
  ],
  classes: [
    { class_id: 'c-nursery1', class_name: 'Nursery 1' },
    { class_id: 'c-primary5', class_name: 'Primary 5' },
    { class_id: 'c-jhs1', class_name: 'JHS 1' }
  ],
  enrolments: [
    { enrolment_id: 'e-1', student_id: 'u-student-1', class_id: 'c-primary5' },
    { enrolment_id: 'e-2', student_id: 'u-student-2', class_id: 'c-primary5' }
  ],
  financial_transactions: [
    { transaction_id: 't-1', student_id: 'u-student-1', type: 'INVOICE', amount: 1800, timestamp: '2026-05-01' },
    { transaction_id: 't-2', student_id: 'u-student-1', type: 'PAYMENT', amount: -1200, timestamp: '2026-05-02' } // owes 600
  ],
  attendance: [
    { attendance_id: 'att-1', user_id: 'u-student-1', date: '2026-09-15', status: 'ABSENT' }
  ]
};

// Browser mocks
global.CustomEvent = class CustomEvent {
  constructor(name, params) {
    this.name = name;
    this.detail = params ? params.detail : null;
  }
};

global.window = {
  location: { origin: 'https://fja-sms.web.app' },
  dispatchEvent: () => {},
  db: {
    getAll: async (store) => JSON.parse(JSON.stringify(mockDbData[store] || [])),
    put: async (store, record) => {
      mockDbData[store] = mockDbData[store] || [];
      const idx = mockDbData[store].findIndex(r => (r.user_id && r.user_id === record.user_id) || (r.profile_id && r.profile_id === record.profile_id));
      if (idx >= 0) mockDbData[store][idx] = record;
      else mockDbData[store].push(record);
      return record;
    }
  }
};

// Evaluate api.js in Node context
const fs = require('fs');
const apiCode = fs.readFileSync('portal/api.js', 'utf8');
eval(apiCode);

async function runTests() {
  console.log("=== TEST 1: ENROLLING WARD WITH EXISTING STAFF PHONE NUMBER ===");
  // Teacher Isaac Boateng has phone 0244112233. Now he enrolls his daughter "Abena Boateng" with HIS phone number!
  const newWardPayload = {
    first_name: "Abena",
    last_name: "Boateng",
    role: "Student",
    phone: "0244112233", // existing staff phone!
    gender: "Female",
    date_of_birth: "2018-04-10"
  };
  const newProfilePayload = {
    emergency_contact: {
      primary: {
        first_name: "Isaac",
        last_name: "Boateng",
        phone: "0244112233",
        relation: "Father (Staff)"
      }
    }
  };

  const createdWard = await window.api.createAccount(newWardPayload, newProfilePayload);
  assert(createdWard, "Student should be created successfully");
  assert.strictEqual(createdWard.phone, "0244112233");
  console.log("✓ Successfully added ward with existing staff phone number without error!");

  console.log("\n=== TEST 2: LOGIN WITH SHARED PHONE NUMBER ===");
  // Phone 0244112233 is shared between Isaac Boateng (password: teacher123) and Abena Boateng (password: student123)
  const teacherLogin = await window.api.login("0244112233", "teacher123");
  assert.strictEqual(teacherLogin.success, true);
  assert.strictEqual(teacherLogin.user.role, "Teacher");
  assert.strictEqual(teacherLogin.user.first_name, "Isaac");
  console.log("✓ Teacher logged in with phone number and teacher password successfully!");

  const studentLogin = await window.api.login("0244112233", "student123");
  assert.strictEqual(studentLogin.success, true);
  assert.strictEqual(studentLogin.user.role, "Student");
  assert.strictEqual(studentLogin.user.first_name, "Abena");
  console.log("✓ Student logged in with shared phone number and student password successfully!");

  console.log("\n=== TEST 3: BROADCAST TARGET RESOLUTION ===");
  // Test ALL_PARENTS
  const allParents = await window.api.getBroadcastRecipients("ALL_PARENTS");
  console.log("ALL_PARENTS count:", allParents.length);
  assert(allParents.length > 0, "ALL_PARENTS must not be empty");
  allParents.forEach(p => console.log("  -> Parent:", p.first_name, p.last_name, "| Phone:", p.phone));

  // Test ARREARS_PARENTS
  const arrearsParents = await window.api.getBroadcastRecipients("ARREARS_PARENTS");
  console.log("ARREARS_PARENTS count:", arrearsParents.length);
  assert(arrearsParents.length > 0, "ARREARS_PARENTS must match parents owing arrears");
  arrearsParents.forEach(p => console.log("  -> Arrears Parent:", p.first_name, p.last_name, "| Phone:", p.phone));

  // Test ABSENCE_ALERTS
  const absenceParents = await window.api.getBroadcastRecipients("ABSENCE_ALERTS");
  console.log("ABSENCE_ALERTS count:", absenceParents.length);
  assert(absenceParents.length > 0, "ABSENCE_ALERTS must match parents with absent students");

  // Test ALL_TEACHERS
  const teachers = await window.api.getBroadcastRecipients("ALL_TEACHERS");
  console.log("ALL_TEACHERS count:", teachers.length);
  assert(teachers.length >= 2, "ALL_TEACHERS must match teachers");

  // Test SECTIONAL_HEADS
  const sectionalHeads = await window.api.getBroadcastRecipients("SECTIONAL_HEADS");
  console.log("SECTIONAL_HEADS count:", sectionalHeads.length);
  assert(sectionalHeads.length > 0, "SECTIONAL_HEADS must match sectional leaders");

  // Test UPPER_PRIMARY (where u-student-1 and u-student-2 are enrolled in Primary 5)
  const upperPrimary = await window.api.getBroadcastRecipients("UPPER_PRIMARY");
  console.log("UPPER_PRIMARY count:", upperPrimary.length);
  assert(upperPrimary.length > 0, "UPPER_PRIMARY must match parents of enrolled students");

  // Test CLASS_c-primary5
  const p5Parents = await window.api.getBroadcastRecipients("CLASS_c-primary5");
  console.log("CLASS_c-primary5 count:", p5Parents.length);
  assert(p5Parents.length > 0, "CLASS_c-primary5 must match parents of Primary 5 students");

  console.log("\n==========================================");
  console.log("ALL TESTS PASSED WITH 100% SUCCESS!");
  console.log("==========================================");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
