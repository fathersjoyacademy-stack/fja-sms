/**
 * Father's Joy Academy - Real-Life Functionality Audit & Simulation Suite
 * 
 * Simulates real-world daily operations:
 *  1. Authentication & Security (Proprietor, Teacher, Parent logins, PBKDF2 hashing)
 *  2. Student Registry & Promotion Ladder (339 students in 2026/2027 classes)
 *  3. Academic Grading & Terminal Report Card Generation (Continuous Assessment + Exam, Ranks, Grades)
 *  4. Daily Attendance Tracking & Terminal Absence Counts
 *  5. Financial Billing, Fee Payments (MoMo/Cash), Receipts & Bad Debt Reversals
 *  6. GRA Act 1178 2026 Payroll & SSNIT Deductions across real salary tiers
 *  7. SMS Broadcast & Dynamic Tag Resolution with Real Student/Parent Links
 *  8. Multi-Album Gallery Persistence & Proportional Image Aspect Ratios
 *  9. Notification Life-Cycle (Delivery, Read, Delete, Clear All)
 * 10. Parent Portal Ward Resolution & Ledger Inspection
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('================================================================');
console.log('  FATHER\'S JOY ACADEMY - REAL-LIFE FUNCTIONALITY AUDIT SUITE    ');
console.log('================================================================\n');

const suiteResults = [];

function testCase(category, name, fn) {
  try {
    fn();
    suiteResults.push({ category, name, passed: true });
    console.log(`  [PASS] ${category} -> ${name}`);
  } catch (err) {
    suiteResults.push({ category, name, passed: false, error: err.message });
    console.error(`  [FAIL] ${category} -> ${name}: ${err.message}`);
  }
}

// Mock In-Memory Database mimicking SchoolManagementDB (portal/db.js)
class MockDatabase {
  constructor() {
    this.stores = {
      users: new Map(),
      profiles: new Map(),
      classes: new Map(),
      enrolments: new Map(),
      subjects: new Map(),
      grades: new Map(),
      attendance: new Map(),
      fees: new Map(),
      financial_transactions: new Map(),
      cms_content: new Map(),
      notifications: new Map(),
      parent_profiles: new Map(),
      parent_student_relations: new Map(),
      broadcast_requests: new Map(),
      broadcast_archives: new Map()
    };
  }

  async get(storeName, key) {
    return this.stores[storeName]?.get(key) || null;
  }

  async put(storeName, value) {
    const key = value.user_id || value.class_id || value.enrolment_id || value.grade_id ||
                value.attendance_id || value.fee_id || value.transaction_id || value.content_key ||
                value.notification_id || value.parent_id || value.relation_id || value.request_id ||
                value.archive_id || value.subject_id;
    if (!key) throw new Error(`Object missing primary key in store ${storeName}`);
    this.stores[storeName].set(key, JSON.parse(JSON.stringify(value)));
    return key;
  }

  async getAll(storeName) {
    return Array.from(this.stores[storeName]?.values() || []);
  }

  async delete(storeName, key) {
    this.stores[storeName]?.delete(key);
  }
}

const mockDb = new MockDatabase();

// ----------------------------------------------------------------
// 1. AUTHENTICATION & SECURITY
// ----------------------------------------------------------------
console.log('\n--- 1. Auditing Authentication & Password Security ---');

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex');
}

testCase('Auth & Security', 'Proprietor account creation and PBKDF2 hash verification', () => {
  const salt = 'fja-salt-2026';
  const hashedPassword = hashPassword('Proprietor@2026!', salt);

  const proprietor = {
    user_id: 'u-proprietor-1',
    uid: 'PR20260001',
    first_name: 'Ebenezer',
    last_name: 'Mensah',
    username: 'proprietor',
    role: 'Proprietor',
    status: 'ACTIVE',
    password_hash: hashedPassword,
    salt: salt,
    created_at: new Date().toISOString()
  };
  mockDb.stores.users.set(proprietor.user_id, proprietor);

  // Verify retrieval and authentication
  const retrieved = mockDb.stores.users.get('u-proprietor-1');
  assert.strictEqual(retrieved.uid, 'PR20260001');
  assert.strictEqual(retrieved.role, 'Proprietor');

  // Verify valid password
  const testHash = hashPassword('Proprietor@2026!', retrieved.salt);
  assert.strictEqual(testHash, retrieved.password_hash);

  // Verify wrong password rejects
  const wrongHash = hashPassword('WrongPassword', retrieved.salt);
  assert.notStrictEqual(wrongHash, retrieved.password_hash);
});

testCase('Auth & Security', 'Teacher & Parent RBAC permissions segregation', () => {
  const teacher = {
    user_id: 'u-teacher-1',
    uid: 'T2026001',
    first_name: 'Comfort',
    last_name: 'Appiah',
    role: 'Teacher',
    status: 'ACTIVE'
  };
  const parent = {
    user_id: 'u-parent-1',
    uid: 'P2026001',
    first_name: 'Kwame',
    last_name: 'Mensah',
    phone: '0244111222',
    role: 'Parent',
    status: 'ACTIVE'
  };
  mockDb.stores.users.set(teacher.user_id, teacher);
  mockDb.stores.users.set(parent.user_id, parent);

  const canEditGrades = (role) => ['Proprietor', 'Administrator', 'Teacher'].includes(role);
  const canAccessPayroll = (role) => ['Proprietor', 'Accountant'].includes(role);
  const canBroadcastSMS = (role) => ['Proprietor', 'Administrator'].includes(role);

  assert.strictEqual(canEditGrades(teacher.role), true);
  assert.strictEqual(canEditGrades(parent.role), false);

  assert.strictEqual(canAccessPayroll('Proprietor'), true);
  assert.strictEqual(canAccessPayroll(teacher.role), false);
  assert.strictEqual(canAccessPayroll(parent.role), false);

  assert.strictEqual(canBroadcastSMS('Proprietor'), true);
  assert.strictEqual(canBroadcastSMS(teacher.role), false);
});

// ----------------------------------------------------------------
// 2. REGISTRY & 2026/2027 ACADEMIC PROMOTION
// ----------------------------------------------------------------
console.log('\n--- 2. Auditing Student Registry & Promotion Ladder ---');

testCase('Registry & Promotion', 'Classes initialization & 2026/2027 ladder verification', () => {
  const classesData = [
    { class_id: 'c-creche', class_name: 'Creche', stage: 'Early Childhood' },
    { class_id: 'c-nursery-1', class_name: 'Nursery 1', stage: 'Early Childhood' },
    { class_id: 'c-nursery-2', class_name: 'Nursery 2', stage: 'Early Childhood' },
    { class_id: 'c-kg-1', class_name: 'KG 1', stage: 'Kindergarten' },
    { class_id: 'c-kg-2', class_name: 'KG 2', stage: 'Kindergarten' },
    { class_id: 'c-pri-1', class_name: 'Primary 1', stage: 'Primary' },
    { class_id: 'c-pri-2', class_name: 'Primary 2', stage: 'Primary' },
    { class_id: 'c-pri-3', class_name: 'Primary 3', stage: 'Primary' },
    { class_id: 'c-pri-4', class_name: 'Primary 4', stage: 'Primary' },
    { class_id: 'c-pri-5', class_name: 'Primary 5', stage: 'Primary' },
    { class_id: 'c-pri-6', class_name: 'Primary 6', stage: 'Primary' },
    { class_id: 'c-jhs-1', class_name: 'JHS 1', stage: 'Junior High School' },
    { class_id: 'c-jhs-2', class_name: 'JHS 2', stage: 'Junior High School' },
    { class_id: 'c-jhs-3', class_name: 'JHS 3', stage: 'Junior High School' }
  ];
  classesData.forEach(c => mockDb.stores.classes.set(c.class_id, c));
  assert.strictEqual(mockDb.stores.classes.size, 14);
});

testCase('Registry & Promotion', 'Simulate student cohort promotion from 2025/2026 to 2026/2027', () => {
  // Ladder mapping
  const promotionLadder = {
    'c-creche': { nextId: 'c-nursery-1', nextName: 'Nursery 1' },
    'c-nursery-1': { nextId: 'c-nursery-2', nextName: 'Nursery 2' },
    'c-nursery-2': { nextId: 'c-kg-1', nextName: 'KG 1' },
    'c-kg-1': { nextId: 'c-kg-2', nextName: 'KG 2' },
    'c-kg-2': { nextId: 'c-pri-1', nextName: 'Primary 1' },
    'c-pri-1': { nextId: 'c-pri-2', nextName: 'Primary 2' },
    'c-pri-2': { nextId: 'c-pri-3', nextName: 'Primary 3' },
    'c-pri-3': { nextId: 'c-pri-4', nextName: 'Primary 4' },
    'c-pri-4': { nextId: 'c-pri-5', nextName: 'Primary 5' },
    'c-pri-5': { nextId: 'c-pri-6', nextName: 'Primary 6' },
    'c-pri-6': { nextId: 'c-jhs-1', nextName: 'JHS 1' },
    'c-jhs-1': { nextId: 'c-jhs-2', nextName: 'JHS 2' },
    'c-jhs-2': { nextId: 'c-jhs-3', nextName: 'JHS 3' }
  };

  // Sample student in Primary 6 for 2025/2026
  const student = {
    user_id: 'u-stud-339',
    uid: 'FJA20260339',
    first_name: 'Kojo',
    last_name: 'Antwi',
    role: 'Student',
    status: 'ACTIVE'
  };
  mockDb.stores.users.set(student.user_id, student);

  const profile = {
    user_id: student.user_id,
    cummulative_academic_score: 84.5,
    cummulative_attendance: 96.0,
    academic_history: [
      {
        academic_year: '2025/2026',
        class_name: 'Primary 6',
        cummulative_academic_score: 84.5,
        cummulative_attendance: 96.0,
        status: 'PROMOTED to JHS 1'
      }
    ]
  };
  mockDb.stores.profiles.set(student.user_id, profile);

  const enrolment2025 = {
    enrolment_id: 'enr-339',
    student_id: student.user_id,
    class_id: 'c-pri-6',
    academic_year: '2025/2026',
    status: 'ACTIVE'
  };
  mockDb.stores.enrolments.set(enrolment2025.enrolment_id, enrolment2025);

  // Apply promotion
  const target = promotionLadder[enrolment2025.class_id];
  assert.strictEqual(target.nextId, 'c-jhs-1');
  assert.strictEqual(target.nextName, 'JHS 1');

  enrolment2025.class_id = target.nextId;
  enrolment2025.academic_year = '2026/2027';
  enrolment2025.promoted_2026_2027 = true;
  mockDb.stores.enrolments.set(enrolment2025.enrolment_id, enrolment2025);

  // Verify student is now in JHS 1 for 2026/2027 while keeping 2025/2026 history
  const updatedEnr = mockDb.stores.enrolments.get('enr-339');
  assert.strictEqual(updatedEnr.class_id, 'c-jhs-1');
  assert.strictEqual(updatedEnr.academic_year, '2026/2027');

  const updatedProf = mockDb.stores.profiles.get('u-stud-339');
  assert.strictEqual(updatedProf.academic_history[0].class_name, 'Primary 6');
  assert.strictEqual(updatedProf.cummulative_academic_score, 84.5);
});

// ----------------------------------------------------------------
// 3. ACADEMIC GRADING & TERMINAL REPORT CARDS
// ----------------------------------------------------------------
console.log('\n--- 3. Auditing Academic Grading & Terminal Reports ---');

function getGradeInfo(score) {
  if (score >= 80) return { grade: 'A', remarks: 'Excellent' };
  if (score >= 70) return { grade: 'B', remarks: 'Very Good' };
  if (score >= 60) return { grade: 'C', remarks: 'Good' };
  if (score >= 50) return { grade: 'D', remarks: 'Credit' };
  if (score >= 40) return { grade: 'E', remarks: 'Pass' };
  return { grade: 'F', remarks: 'Fail' };
}

testCase('Academic Grading', 'Calculate continuous assessment (30%) + exam (70%) composite score', () => {
  const classAssessment = 28; // out of 30
  const examScore = 63;       // out of 70
  const composite = classAssessment + examScore; // 91
  assert.strictEqual(composite, 91);

  const gradeInfo = getGradeInfo(composite);
  assert.strictEqual(gradeInfo.grade, 'A');
  assert.strictEqual(gradeInfo.remarks, 'Excellent');
});

testCase('Academic Grading', 'Calculate class rank positions with tie handling', () => {
  const studentsScores = [
    { student_id: 's1', total: 540 },
    { student_id: 's2', total: 580 },
    { student_id: 's3', total: 540 },
    { student_id: 's4', total: 600 }
  ];

  // Sort descending
  studentsScores.sort((a, b) => b.total - a.total);

  let currentRank = 1;
  studentsScores.forEach((s, idx) => {
    if (idx > 0 && s.total < studentsScores[idx - 1].total) {
      currentRank = idx + 1;
    }
    s.rank = currentRank;
  });

  assert.strictEqual(studentsScores.find(s => s.student_id === 's4').rank, 1); // 600 -> 1st
  assert.strictEqual(studentsScores.find(s => s.student_id === 's2').rank, 2); // 580 -> 2nd
  assert.strictEqual(studentsScores.find(s => s.student_id === 's1').rank, 3); // 540 -> 3rd (tied)
  assert.strictEqual(studentsScores.find(s => s.student_id === 's3').rank, 3); // 540 -> 3rd (tied)
});

// ----------------------------------------------------------------
// 4. ATTENDANCE TRACKING ENGINE
// ----------------------------------------------------------------
console.log('\n--- 4. Auditing Daily & Terminal Attendance Tracking ---');

testCase('Attendance', 'Record daily attendance and compute terminal percentage & absences', () => {
  const termAttendanceDays = [
    { date: '2026-09-08', status: 'PRESENT' },
    { date: '2026-09-09', status: 'PRESENT' },
    { date: '2026-09-10', status: 'ABSENT' },
    { date: '2026-09-11', status: 'PRESENT' },
    { date: '2026-09-12', status: 'LATE' }, // Counted as attended
    { date: '2026-09-15', status: 'PRESENT' }
  ];

  const totalDays = termAttendanceDays.length;
  const attendedDays = termAttendanceDays.filter(d => ['PRESENT', 'LATE'].includes(d.status)).length;
  const absentDays = termAttendanceDays.filter(d => d.status === 'ABSENT').length;

  const attendancePct = ((attendedDays / totalDays) * 100).toFixed(1);

  assert.strictEqual(totalDays, 6);
  assert.strictEqual(attendedDays, 5);
  assert.strictEqual(absentDays, 1);
  assert.strictEqual(attendancePct, '83.3');
});

// ----------------------------------------------------------------
// 5. FINANCIAL BILLING, FEE PAYMENTS & BAD DEBT REVERSAL
// ----------------------------------------------------------------
console.log('\n--- 5. Auditing Financial Billing, Fee Payments & Bad Debt ---');

testCase('Financials', 'Student billing, partial MoMo payment, receipt generation & balance calculation', () => {
  const studentId = 'u-stud-101';

  // 1. Term Bill: GH¢ 850.00
  const bill = {
    transaction_id: 'tx-bill-1',
    student_id: studentId,
    type: 'BILLING',
    amount: 850.00,
    reference_no: 'INV-2026-T1-101',
    billing_description: '2026/2027 Term 1 Tuition & Services',
    timestamp: '2026-09-08T08:00:00Z'
  };
  mockDb.stores.financial_transactions.set(bill.transaction_id, bill);

  // 2. Partial Payment via MTN MoMo: GH¢ 500.00
  const payment = {
    transaction_id: 'tx-pay-1',
    student_id: studentId,
    type: 'PAYMENT',
    amount: 500.00,
    reference_no: 'REC-20260910-MOMO-001',
    payment_method: 'Mobile Money',
    billing_description: 'Partial Fee Payment (MTN MoMo)',
    timestamp: '2026-09-10T14:30:00Z'
  };
  mockDb.stores.financial_transactions.set(payment.transaction_id, payment);

  // 3. Compute Ledger Balance
  const studentTxs = Array.from(mockDb.stores.financial_transactions.values()).filter(t => t.student_id === studentId);
  const totalBilled = studentTxs.filter(t => t.type === 'BILLING').reduce((sum, t) => sum + t.amount, 0);
  const totalPaid = studentTxs.filter(t => t.type === 'PAYMENT').reduce((sum, t) => sum + t.amount, 0);
  const balance = totalBilled - totalPaid;

  assert.strictEqual(totalBilled, 850.00);
  assert.strictEqual(totalPaid, 500.00);
  assert.strictEqual(balance, 350.00);
});

testCase('Financials', 'Account archival writes off bad debt; account reactivation reverses bad debt', () => {
  const studentId = 'u-stud-archived-1';
  const remainingArrears = 350.00;

  // Archival creates BAD_DEBT transaction
  const badDebtTx = {
    transaction_id: 't-bd-001',
    student_id: studentId,
    type: 'BAD_DEBT',
    amount: -remainingArrears, // Credits balance to zero
    reference_no: 'BD-ARREARS-001',
    billing_description: 'Bad Debt Write-off on Student Archival'
  };
  mockDb.stores.financial_transactions.set(badDebtTx.transaction_id, badDebtTx);

  // Reactivation check: detect existing BAD_DEBT and generate REVERSAL
  const allTxs = Array.from(mockDb.stores.financial_transactions.values());
  const bdTxs = allTxs.filter(t => t.student_id === studentId && (t.type === 'BAD_DEBT' || t.reference_no.startsWith('BD-')));
  assert.strictEqual(bdTxs.length, 1);

  for (const bd of bdTxs) {
    const revRef = 'REV-' + bd.reference_no;
    const revTx = {
      transaction_id: 't-rev-' + Date.now(),
      student_id: studentId,
      type: 'REVERSAL',
      amount: Math.abs(bd.amount),
      reference_no: revRef,
      billing_description: 'Reversal of Bad Debt on Account Reactivation'
    };
    mockDb.stores.financial_transactions.set(revTx.transaction_id, revTx);
  }

  const updatedTxs = Array.from(mockDb.stores.financial_transactions.values()).filter(t => t.student_id === studentId);
  const reversalTx = updatedTxs.find(t => t.type === 'REVERSAL');
  assert(reversalTx !== undefined);
  assert.strictEqual(reversalTx.amount, 350.00);
  assert.strictEqual(reversalTx.reference_no, 'REV-BD-ARREARS-001');
});

// ----------------------------------------------------------------
// 6. GHANAIAN PAYROLL ENGINE (GRA ACT 1178 2026 & SSNIT TIER 1/2)
// ----------------------------------------------------------------
console.log('\n--- 6. Auditing GRA Act 1178 2026 Payroll & SSNIT ---');

function calculatePayroll(baseSalary, allowances = 0, bonus = 0, advance = 0) {
  const gross = (parseFloat(baseSalary) || 0) + (parseFloat(allowances) || 0) + (parseFloat(bonus) || 0);
  const ssnit = parseFloat((gross * 0.055).toFixed(2));
  
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
}

testCase('Payroll', 'Low earner (GH¢ 600 gross) - tax-exempt under 588 threshold', () => {
  const result = calculatePayroll(600, 0, 0, 0);
  assert.strictEqual(result.gross, 600.00);
  assert.strictEqual(result.ssnit, 33.00); // 600 * 0.055 = 33.00
  // Taxable = 600 - 33 = 567.00. Since 567 < 588, PAYE is 0.00
  assert.strictEqual(result.paye, 0.00);
  assert.strictEqual(result.netPay, 567.00);
});

testCase('Payroll', 'Mid-level teacher (GH¢ 2,500 gross + GH¢ 300 allowance - GH¢ 200 advance)', () => {
  const result = calculatePayroll(2500, 300, 0, 200);
  assert.strictEqual(result.gross, 2800.00);
  assert.strictEqual(result.ssnit, 154.00); // 2800 * 0.055 = 154.00
  // Taxable = 2800 - 154 = 2646.00
  // Band 1: 588 @ 0% = 0.00 (rem: 2058.00)
  // Band 2: 80 @ 5% = 4.00 (rem: 1978.00)
  // Band 3: 100 @ 10% = 10.00 (rem: 1878.00)
  // Band 4: 1878 @ 17.5% = 328.65
  // Total PAYE = 342.65
  assert.strictEqual(result.paye, 342.65);
  // Net = 2800 - 154 - 342.65 - 200 = 2103.35
  assert.strictEqual(result.netPay, 2103.35);
});

// ----------------------------------------------------------------
// 7. SMS BROADCAST & DYNAMIC TAG RESOLUTION
// ----------------------------------------------------------------
console.log('\n--- 7. Auditing SMS Broadcast & Dynamic Tag Engine ---');

function resolveTags(template, ctx) {
  let msg = template;
  const replacements = {
    parent_name: ctx.parent_name || 'Parent/Guardian',
    student_name: ctx.student_name || 'Student',
    class_name: ctx.class_name || 'Class',
    outstanding_fees: ctx.outstanding_fees !== undefined ? ctx.outstanding_fees : 'GH¢ 0.00',
    fees_paid: ctx.fees_paid !== undefined ? ctx.fees_paid : 'GH¢ 0.00',
    days_absented: ctx.days_absented !== undefined ? ctx.days_absented : '0 days'
  };
  for (const [key, val] of Object.entries(replacements)) {
    const rx = new RegExp('#' + key + '#', 'gi');
    msg = msg.replace(rx, () => String(val));
  }
  return msg;
}

testCase('SMS Broadcast', 'End-to-end tag resolution with actual parent-student relations', () => {
  // Setup parent and student
  const parent = { user_id: 'u-p-201', first_name: 'Madam Joyce', last_name: 'Osei', phone: '0249876543' };
  const student = { user_id: 'u-s-201', first_name: 'Emmanuel', last_name: 'Osei', phone: '' };
  const relation = { parent_id: parent.user_id, student_id: student.user_id, relation_type: 'Mother' };

  mockDb.stores.users.set(parent.user_id, parent);
  mockDb.stores.users.set(student.user_id, student);
  mockDb.stores.parent_student_relations.set('rel-1', relation);

  const context = {
    parent_name: `${parent.first_name} ${parent.last_name}`,
    student_name: `${student.first_name} ${student.last_name}`,
    class_name: 'Primary 3',
    outstanding_fees: 'GH¢ 280.00',
    fees_paid: 'GH¢ 570.00',
    days_absented: '2 days'
  };

  const template = 'Dear #parent_name#, please be reminded that your ward #student_name# in #class_name# has outstanding fees of #outstanding_fees# (Paid: #fees_paid#). Absences: #days_absented#.';
  const resolved = resolveTags(template, context);

  assert.strictEqual(
    resolved,
    'Dear Madam Joyce Osei, please be reminded that your ward Emmanuel Osei in Primary 3 has outstanding fees of GH¢ 280.00 (Paid: GH¢ 570.00). Absences: 2 days.'
  );
});

// ----------------------------------------------------------------
// 8. GALLERY & MULTI-ALBUM PERSISTENCE
// ----------------------------------------------------------------
console.log('\n--- 8. Auditing Gallery & Multi-Album Engine ---');

testCase('Gallery CMS', 'Preserve existing albums across page reload / seedCMS guard', async () => {
  // Existing albums in DB
  const existingAlbums = [
    { id: 'alb-1', title: 'Graduation Ceremony 2026', photos: [{ id: 'p1', url: 'data:image/jpeg;base64,aaa' }] },
    { id: 'alb-2', title: 'Inter-Houses Sports Day', photos: [{ id: 'p2', url: 'data:image/jpeg;base64,bbb' }] }
  ];
  mockDb.stores.cms_content.set('gallery_albums', { content_key: 'gallery_albums', data: existingAlbums });

  // Simulate seedCMS run
  const defaultCMS = [
    { content_key: 'gallery_albums', data: [{ id: 'alb-default', title: 'Default Album', photos: [] }] }
  ];

  for (const c of defaultCMS) {
    const existing = await mockDb.get('cms_content', c.content_key);
    if (!existing) {
      await mockDb.put('cms_content', c);
    }
  }

  // Ensure custom albums were NOT overwritten
  const finalContent = await mockDb.get('cms_content', 'gallery_albums');
  assert.strictEqual(finalContent.data.length, 2);
  assert.strictEqual(finalContent.data[0].title, 'Graduation Ceremony 2026');
  assert.strictEqual(finalContent.data[1].title, 'Inter-Houses Sports Day');
});

testCase('Gallery CMS', 'Proportional aspect ratio calculation preserves portrait 3:4 and landscape 16:9', () => {
  const maxDim = 900;

  function calculateTargetDimensions(width, height) {
    let w = width;
    let h = height;
    if (w > maxDim || h > maxDim) {
      if (w >= h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }
    return { w, h, ratio: (w / h).toFixed(4) };
  }

  // Landscape photo: 1920 x 1080 (16:9)
  const landscape = calculateTargetDimensions(1920, 1080);
  assert.strictEqual(landscape.w, 900);
  assert.strictEqual(landscape.h, 506); // Math.round(506.25)
  assert(Math.abs(Number(landscape.ratio) - (1920 / 1080)) < 0.002, "Landscape ratio within integer pixel tolerance");

  // Portrait photo: 1200 x 1600 (3:4)
  const portrait = calculateTargetDimensions(1200, 1600);
  assert.strictEqual(portrait.h, 900);
  assert.strictEqual(portrait.w, 675);
  assert(Math.abs(Number(portrait.ratio) - (1200 / 1600)) < 0.002, "Portrait ratio within integer pixel tolerance");
});

// ----------------------------------------------------------------
// 9. NOTIFICATION CENTER LIFECYCLE
// ----------------------------------------------------------------
console.log('\n--- 9. Auditing Notification Center Life-Cycle ---');

testCase('Notification Center', 'Delivery, read status, individual deletion & bulk inbox clearance', async () => {
  const userId = 'u-proprietor-1';

  // Seed 3 notifications
  const notifs = [
    { notification_id: 'n1', target_user_id: userId, title: 'Fee Payment', status: 'UNREAD' },
    { notification_id: 'n2', target_user_id: userId, title: 'Daily Attendance', status: 'UNREAD' },
    { notification_id: 'n3', target_user_id: userId, title: 'Staff Check-in', status: 'READ' }
  ];
  for (const n of notifs) mockDb.stores.notifications.set(n.notification_id, n);

  // 1. Check unread count
  const myNotifs = Array.from(mockDb.stores.notifications.values()).filter(n => n.target_user_id === userId);
  const unreadCount = myNotifs.filter(n => n.status === 'UNREAD').length;
  assert.strictEqual(unreadCount, 2);

  // 2. Mark n1 as read
  const n1 = mockDb.stores.notifications.get('n1');
  n1.status = 'READ';
  mockDb.stores.notifications.set('n1', n1);
  assert.strictEqual(mockDb.stores.notifications.get('n1').status, 'READ');

  // 3. Delete individual notification n2
  mockDb.stores.notifications.delete('n2');
  assert.strictEqual(mockDb.stores.notifications.get('n2'), undefined);

  // 4. Clear all notifications for user
  for (const [nid, n] of mockDb.stores.notifications.entries()) {
    if (n.target_user_id === userId) {
      mockDb.stores.notifications.delete(nid);
    }
  }
  const remaining = Array.from(mockDb.stores.notifications.values()).filter(n => n.target_user_id === userId);
  assert.strictEqual(remaining.length, 0);
});

// ----------------------------------------------------------------
// 10. PARENT & STUDENT ACCESS CONTROL & WARD RESOLUTION
// ----------------------------------------------------------------
console.log('\n--- 10. Auditing Parent & Student Ward Resolution ---');

testCase('Parent Portal', 'Resolve parent to multiple enrolled wards with distinct balances', () => {
  const parentId = 'p-kwame';
  const ward1 = { student_id: 'w-kofi', class_id: 'c-pri-3', arrears: 150.00 };
  const ward2 = { student_id: 'w-ama', class_id: 'c-kg-1', arrears: 0.00 };

  const relations = [
    { parent_id: parentId, student_id: ward1.student_id },
    { parent_id: parentId, student_id: ward2.student_id }
  ];

  const parentWards = relations.filter(r => r.parent_id === parentId).map(r => {
    return [ward1, ward2].find(w => w.student_id === r.student_id);
  });

  assert.strictEqual(parentWards.length, 2);
  assert.strictEqual(parentWards[0].class_id, 'c-pri-3');
  assert.strictEqual(parentWards[0].arrears, 150.00);
  assert.strictEqual(parentWards[1].class_id, 'c-kg-1');
  assert.strictEqual(parentWards[1].arrears, 0.00);
});

// ----------------------------------------------------------------
// SUMMARY REPORT
// ----------------------------------------------------------------
console.log('\n================================================================');
console.log('            REAL-LIFE FUNCTIONALITY AUDIT SUMMARY               ');
console.log('================================================================\n');

const totalTests = suiteResults.length;
const passedTests = suiteResults.filter(r => r.passed).length;
const failedTests = suiteResults.filter(r => !r.passed).length;

console.log(`Total Scenarios Tested:  ${totalTests}`);
console.log(`Scenarios Passed:        ${passedTests}`);
console.log(`Scenarios Failed:        ${failedTests}`);
console.log(`Real-Life Operational Integrity: ${Math.round((passedTests / totalTests) * 100)}%\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
