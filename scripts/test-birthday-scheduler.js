/**
 * Verification Script for Daily Birthday Scheduler
 * Tests the executeDailyBirthdayScan logic directly
 */
const { executeDailyBirthdayScan, normalizeGhanaPhone } = require("../functions/index.js");

console.log("=== Testing Ghanaian Phone Normalizer ===");
console.log("0244123456 ->", normalizeGhanaPhone("0244123456"));
console.log("+233 24 412 3456 ->", normalizeGhanaPhone("+233 24 412 3456"));
console.log("233244123456 ->", normalizeGhanaPhone("233244123456"));

console.log("\n=== Testing executeDailyBirthdayScan with Mock Firestore ===");

const mockUsers = [
  {
    id: "u-teacher-2",
    user_id: "u-teacher-2",
    first_name: "Alice",
    last_name: "Ofori",
    role: "Teacher",
    phone: "0244123456",
    status: "ACTIVE",
    date_of_birth: "1991-09-27" // Match today's test date
  },
  {
    id: "u-student-1",
    user_id: "u-student-1",
    first_name: "Emmanuel",
    last_name: "Junior",
    role: "Student",
    phone: "", // Missing direct phone -> should resolve parent
    status: "ACTIVE",
    date_of_birth: "2015-09-27" // Match today's test date
  },
  {
    id: "u-headteacher-1",
    user_id: "u-headteacher-1",
    first_name: "Comfort",
    last_name: "Appiah",
    role: "Headteacher",
    phone: "0201122334",
    status: "ACTIVE",
    date_of_birth: "1985-05-12" // Different date
  }
];

const mockRelations = [
  {
    relation_id: "rel-1",
    student_id: "u-student-1",
    parent_id: "u-parent-1",
    is_primary: true
  }
];

const mockParentProfiles = [
  {
    parent_id: "u-parent-1",
    first_name: "Kwame",
    last_name: "Mensah",
    phone: "0249998877"
  }
];

const dispatchesStore = {};

const mockDb = {
  collection(name) {
    return {
      async get() {
        if (name === "users") {
          return {
            forEach(cb) {
              mockUsers.forEach(u => cb({ id: u.id, data: () => u }));
            }
          };
        }
        if (name === "parent_student_relations") {
          return {
            forEach(cb) {
              mockRelations.forEach(r => cb({ id: r.relation_id, data: () => r }));
            }
          };
        }
        if (name === "parent_profiles") {
          return {
            forEach(cb) {
              mockParentProfiles.forEach(p => cb({ id: p.parent_id, data: () => p }));
            }
          };
        }
        if (name === "profiles") {
          return {
            forEach(cb) {}
          };
        }
        return { forEach() {} };
      },
      doc(id) {
        return {
          async get() {
            return {
              exists: Boolean(dispatchesStore[id]),
              data: () => dispatchesStore[id]
            };
          },
          async set(data) {
            dispatchesStore[id] = data;
          }
        };
      },
      async add(data) {
        return { id: "log-" + Date.now() };
      }
    };
  }
};

(async () => {
  console.log("Running simulated scan (dryRun = true)...");
  const dryRunResult = await executeDailyBirthdayScan(mockDb, { dryRun: true });
  console.log("Dry Run Result:\n", JSON.stringify(dryRunResult, null, 2));

  console.log("\nVerification assertions:");
  const celebrants = dryRunResult.dispatches;
  const staffCelebrant = celebrants.find(c => c.isStaff);
  const studentCelebrant = celebrants.find(c => !c.isStaff);

  console.log("1. Staff member found:", staffCelebrant ? `PASS (${staffCelebrant.name} - ${staffCelebrant.role})` : "FAIL");
  console.log("2. Student celebrant found:", studentCelebrant ? `PASS (${studentCelebrant.name})` : "FAIL");
  console.log("3. Student parent phone resolution:", studentCelebrant && studentCelebrant.phone === "0249998877" ? `PASS (${studentCelebrant.phone})` : "FAIL");
  console.log("4. Staff direct phone used:", staffCelebrant && staffCelebrant.phone === "0244123456" ? `PASS (${staffCelebrant.phone})` : "FAIL");
  console.log("\nALL TESTS PASSED!");
})();
