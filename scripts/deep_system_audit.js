// scripts/deep_system_audit.js
const fs = require('fs');
const path = require('path');

// Virtual DOM mock
class MockClassList {
  constructor() { this.classes = new Set(); }
  add(...args) { args.forEach(c => this.classes.add(c)); }
  remove(...args) { args.forEach(c => this.classes.delete(c)); }
  contains(c) { return this.classes.has(c); }
  toggle(c) { if (this.classes.has(c)) this.classes.delete(c); else this.classes.add(c); }
}

class MockElement {
  constructor(tag = 'div', id = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.className = '';
    this.classList = new MockClassList();
    this.style = {};
    this.attributes = {};
    this.dataset = {};
    this.children = [];
    this._innerHTML = '';
    this.value = '';
    this.checked = false;
    this.listeners = {};
    this.onclick = null;
    this.onsubmit = null;
    this.oninput = null;
    this.onchange = null;
    this.parentElement = null;
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; }
  hasAttribute(k) { return this.attributes[k] !== undefined; }
  removeAttribute(k) { delete this.attributes[k]; }
  addEventListener(evt, fn) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(fn);
  }
  removeEventListener(evt, fn) {
    if (this.listeners[evt]) {
      this.listeners[evt] = this.listeners[evt].filter(f => f !== fn);
    }
  }
  dispatchEvent(evt) {
    const type = evt.type || evt;
    if (this.listeners[type]) {
      this.listeners[type].forEach(fn => fn(evt));
    }
  }
  click() {
    const evt = { target: this, currentTarget: this, preventDefault: () => {}, stopPropagation: () => {} };
    if (this.onclick) this.onclick(evt);
    if (this.listeners['click']) {
      this.listeners['click'].forEach(fn => fn(evt));
    }
  }
  submit() {
    const evt = { target: this, currentTarget: this, preventDefault: () => {}, stopPropagation: () => {} };
    if (this.onsubmit) this.onsubmit(evt);
    if (this.listeners['submit']) {
      this.listeners['submit'].forEach(fn => fn(evt));
    }
  }
  trigger(evtName, extra = {}) {
    const evt = { target: this, currentTarget: this, preventDefault: () => {}, stopPropagation: () => {}, ...extra };
    const handlerName = 'on' + evtName;
    if (this[handlerName]) this[handlerName](evt);
    if (this.listeners[evtName]) {
      this.listeners[evtName].forEach(fn => fn(evt));
    }
  }
  closest(sel) {
    return this;
  }
  querySelector(sel) {
    return new MockElement('div');
  }
  querySelectorAll(sel) {
    return [new MockElement('div')];
  }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
  }
  removeChild(child) {
    this.children = this.children.filter(c => c !== child);
  }
  remove() {
    if (this.parentElement) this.parentElement.removeChild(this);
  }
  cloneNode(deep = true) {
    const clone = new MockElement(this.tagName.toLowerCase(), this.id);
    clone.className = this.className;
    clone.classList = new MockClassList();
    this.classList.classes.forEach(c => clone.classList.add(c));
    clone._innerHTML = this._innerHTML;
    clone.style = { ...this.style };
    clone.attributes = { ...this.attributes };
    return clone;
  }
  focus() {}
  blur() {}
  reset() {}
  set innerHTML(val) {
    this._innerHTML = val;
    this.children = [];
    // Extract elements with id
    if (typeof val === 'string') {
      const re = /<([a-zA-Z0-9\-]+)([^>]*)>/g;
      let m;
      while ((m = re.exec(val)) !== null) {
        const tag = m[1];
        const attrs = m[2];
        const idMatch = /\bid=['"]([^'"]+)['"]/.exec(attrs);
        const classMatch = /\bclass=['"]([^'"]+)['"]/.exec(attrs);
        const el = global.document.createElement(tag);
        if (idMatch) {
          el.id = idMatch[1];
          global.document.elementsMap[el.id] = el;
        }
        if (classMatch) {
          el.className = classMatch[1];
          classMatch[1].split(/\s+/).forEach(c => el.classList.add(c));
        }
        this.children.push(el);
      }
    }
  }
  get innerHTML() {
    return this._innerHTML;
  }
  get textContent() {
    return this._innerHTML.replace(/<[^>]+>/g, '');
  }
  set textContent(v) {
    this._innerHTML = String(v);
  }
}

const elementsMap = {};
// Load index.html elements into elementsMap
const indexHtmlContent = fs.readFileSync(path.join(__dirname, '../portal/index.html'), 'utf8');
const idRe = /\bid=['"]([^'"]+)['"]/g;
let idMatch;
while ((idMatch = idRe.exec(indexHtmlContent)) !== null) {
  const el = new MockElement('div', idMatch[1]);
  elementsMap[idMatch[1]] = el;
}

// Global browser context
global.window = global;
global.window.elementsMap = {};
global.document = {
  elementsMap: {},
  getElementById(id) {
    if (!this.elementsMap[id]) {
      this.elementsMap[id] = new MockElement('div', id);
    }
    return this.elementsMap[id];
  },
  createElement(tag) {
    return new MockElement(tag);
  },
  querySelector(sel) {
    return new MockElement('div');
  },
  querySelectorAll(sel) {
    return [new MockElement('div'), new MockElement('button'), new MockElement('input')];
  },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  body: new MockElement('body'),
  head: new MockElement('head'),
  getElementsByTagName(tag) { return [new MockElement(tag)]; },
  documentElement: new MockElement('html'),
  activeElement: null
};

global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
global.window.dispatchEvent = () => {};
global.window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
global.window.location = { hash: '', reload: () => {}, href: 'http://localhost' };
global.window.scrollTo = () => {};
global.window.getComputedStyle = () => ({ display: 'block', visibility: 'visible', getPropertyValue: () => '' });
global.getComputedStyle = global.window.getComputedStyle;
global.window.print = () => {};
global.print = global.window.print;
global.window.open = () => ({ document: { write: () => {}, close: () => {} }, print: () => {}, close: () => {} });
global.Chart = class { constructor() {} destroy() {} update() {} };
global.window.Chart = global.Chart;
global.navigator = { onLine: true };
global.confirm = () => true;
global.alert = () => {};
global.prompt = () => "Sample Input";

global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};
global.window.localStorage = global.localStorage;

// Realistic mock database containing all school operational collections
const mockDb = {
  users: [
    { user_id: 'u-proprietor-1', role: 'Proprietor', first_name: 'Nana', last_name: 'Proprietor', uid: 'PRP-001', status: 'ACTIVE' },
    { user_id: 'u-admin-1', role: 'Admin', first_name: 'Kofi', last_name: 'Admin', uid: 'ADM-001', status: 'ACTIVE' },
    { user_id: 'u-teacher-1', role: 'Teacher', first_name: 'Kwame', last_name: 'Teacher', uid: 'TCH-001', status: 'ACTIVE' },
    { user_id: 'u-finance-1', role: 'Finance', first_name: 'Ama', last_name: 'Finance', uid: 'ACC-001', status: 'ACTIVE' },
    { user_id: 'u-student-1', role: 'Student', first_name: 'Emmanuel', last_name: 'Mensah', uid: 'STU-001', status: 'ACTIVE' },
    { user_id: 'u-parent-1', role: 'Parent', first_name: 'Mr.', last_name: 'Mensah', uid: 'PAR-001', status: 'ACTIVE' }
  ],
  profiles: [
    { profile_id: 'p-1', user_id: 'u-student-1', guardian_name: 'Mr. Mensah', guardian_phone: '0241234567', seeking_class: 'Class 1', base_salary: 0, allowances: 0 },
    { profile_id: 'p-2', user_id: 'u-teacher-1', base_salary: 2500, allowances: 300 }
  ],
  classes: [
    { class_id: 'c-1', class_name: 'Class 1', class_teacher_id: 'u-teacher-1', monthly_fee: 300, term_fee: 900 }
  ],
  enrolments: [
    { enrolment_id: 'enr-1', user_id: 'u-student-1', class_id: 'c-1', academic_year: '2025/2026', status: 'ACTIVE' }
  ],
  subjects: [
    { subject_id: 'sub-math', subject_name: 'Core Mathematics' },
    { subject_id: 'sub-eng', subject_name: 'English Language' }
  ],
  student_scores: [
    { score_id: 'sc-1', student_id: 'u-student-1', subject_id: 'sub-math', class_score: 45, exam_score: 48, total_score: 93, term: 'Term 1' }
  ],
  financial_transactions: [
    { transaction_id: 'tx-1', type: 'BILLING', student_id: 'u-student-1', amount: 900, description: 'Term 1 Tuition Bill', date: '2026-10-25' },
    { transaction_id: 'tx-2', type: 'FEE_PAYMENT', student_id: 'u-student-1', amount: 500, description: 'Bank Transfer Payment', date: '2026-10-26' },
    { transaction_id: 'tx-3', type: 'OTHER_EXPENSE', amount: 150, category: 'Utilities', description: 'Electricity Bill', date: '2026-10-26' }
  ],
  payroll: [
    { payroll_id: 'pr-1', employee_id: 'u-teacher-1', base_pay: 2500, allowances: 300, net_pay: 2800, month: 'October 2026', status: 'PROCESSED' }
  ],
  cms_content: [
    { content_key: 'school_info', school_name: "Father's Joy Academy", motto: "Excellence & Faith" }
  ],
  notifications: [],
  sms_logs: [],
  attendance: []
};

global.window.db = {
  getAll: async (store) => mockDb[store] || [],
  queryByIndex: async (store, idx, val) => (mockDb[store] || []).filter(x => x[idx] === val),
  getByIndex: async (store, idx, val) => (mockDb[store] || []).filter(x => x[idx] === val),
  get: async (store, id) => {
    const list = mockDb[store] || [];
    return list.find(x => (x.user_id || x.class_id || x.subject_id || x.transaction_id || x.enrolment_id || x.payroll_id || x.content_key) === id) || null;
  },
  put: async (store, item) => {
    if (!mockDb[store]) mockDb[store] = [];
    mockDb[store].push(item);
    return true;
  },
  delete: async (store, id) => {
    if (mockDb[store]) {
      mockDb[store] = mockDb[store].filter(x => (x.user_id || x.class_id || x.subject_id || x.transaction_id) !== id);
    }
    return true;
  }
};

global.window.api = {
  getClassRoster: async () => mockDb.users.filter(u => u.role === 'Student'),
  getCurrentTermName: () => 'Term 1',
  getGradeScale: (score) => ({ grade: score >= 80 ? 'A1' : 'B2', remarks: 'Good' }),
  saveStudentGrades: async () => ({ success: true, message: 'Saved' }),
  simulateSMS: () => true
};

global.showToast = (msg, type) => {};

// Load api.js then app.js
require('../portal/api.js');
require('../portal/app.js');

async function testAllViews() {
  console.log('==================================================');
  console.log('   STARTING DEEP AUDIT OF ALL VIEWS & FEATURES');
  console.log('==================================================\n');

  // List of all routed views
  const allViews = [
    "proprietor-dash",
    "proprietor-finance-overview",
    "proprietor-records-overview",
    "proprietor-academic-overview",
    "headteacher-dash",
    "records-dashboard",
    "academic-calendar",
    "notifications-portal",
    "portal-messages",
    "questionnaires-portal",
    "sectional-head-dash",
    "finance-dash",
    "account-provisioning",
    "website-cms",
    "broadcast-panel",
    "admissions-intake",
    "fee-ledger",
    "payroll-engine",
    "finance-p-l",
    "financial-audit",
    "teacher-payslip",
    "teacher-dash",
    "teacher-attendance",
    "class-wall",
    "lesson-note-upload",
    "lesson-approvals",
    "teacher-grading",
    "assignment-builder",
    "student-quizzes",
    "student-dash",
    "student-library",
    "elibrary-manager",
    "student-learning-notes",
    "academic-quality",
    "teacher-supervision",
    "attendance-tracker",
    "finance-accounts",
    "records-management",
    "prospectus-manager",
    "broadcast-requests",
    "parent-dash"
  ];

  const results = { passed: [], failed: [] };
  const container = document.getElementById("dashboard-subview-container");

  // Test with appropriate roles
  const rolesToTest = {
    'Proprietor': mockDb.users[0],
    'Admin': mockDb.users[1],
    'Teacher': mockDb.users[2],
    'Finance': mockDb.users[3],
    'Student': mockDb.users[4],
    'Parent': mockDb.users[5],
    'HeadTeacher': { user_id: 'u-ht-1', role: 'HeadTeacher', first_name: 'Head', last_name: 'Teacher', uid: 'HT-001' }
  };

  for (const viewId of allViews) {
    let viewSuccess = true;
    let viewError = null;

    let targetRole = 'Proprietor';
    if (viewId.startsWith("teacher-") || ["assignment-builder", "class-wall", "lesson-note-upload"].includes(viewId)) targetRole = 'Teacher';
    else if (viewId.startsWith("finance-") || ["fee-ledger", "payroll-engine", "financial-audit"].includes(viewId)) targetRole = 'Finance';
    else if (viewId.startsWith("student-")) targetRole = 'Student';
    else if (viewId.startsWith("parent-")) targetRole = 'Parent';
    else if (viewId.includes("headteacher") || viewId === "lesson-approvals" || viewId === "teacher-supervision" || viewId === "academic-quality") targetRole = 'HeadTeacher';
    else if (["records-dashboard", "admissions-intake", "records-management", "account-provisioning", "prospectus-manager", "website-cms", "broadcast-panel"].includes(viewId)) targetRole = 'Admin';

    const u = rolesToTest[targetRole] || mockDb.users[0];
    global.currentUser = u;
    global.window.currentUser = u;

    try {
      container.innerHTML = "";
      if (typeof window.loadDashboardSubview === 'function') {
        await window.loadDashboardSubview(viewId, false);
        await new Promise(r => setTimeout(r, 80));
      } else {
        throw new Error('window.loadDashboardSubview function not defined');
      }

      // Check if container received HTML content
      if (!container.innerHTML || container.innerHTML.trim().length === 0) {
        throw new Error(`View "${viewId}" rendered empty content.`);
      }

      // Test clicking all buttons rendered inside the view
      const buttons = container.children.filter(c => c.tagName === 'BUTTON' || (c.className && c.className.includes('btn')));
      for (const btn of buttons) {
        try {
          btn.click();
        } catch (btnErr) {
          throw new Error(`Button "${btn.id || btn.className}" threw error on click: ${btnErr.message}`);
        }
      }

    } catch (err) {
      viewSuccess = false;
      viewError = err;
    }

    if (viewSuccess) {
      results.passed.push(viewId);
      console.log(`[PASS] View: "${viewId}" (Role: ${targetRole})`);
    } else {
      results.failed.push({ viewId, role: targetRole, error: viewError.message, stack: viewError.stack });
      console.error(`[FAIL] View: "${viewId}" (Role: ${targetRole}) -> ${viewError.message}`);
    }
  }

  console.log('\n==================================================');
  console.log(`AUDIT RESULTS: ${results.passed.length} PASSED, ${results.failed.length} FAILED`);
  console.log('==================================================');

  if (results.failed.length > 0) {
    console.log('\nFAILED VIEWS DETAILS:');
    results.failed.forEach(f => {
      console.log(`- ${f.viewId}: ${f.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n>>> ZERO FAILURES: All views and buttons rendered and clicked cleanly without errors! <<<');
    process.exit(0);
  }
}

testAllViews().catch(err => {
  console.error("FATAL AUDIT ERROR:", err);
  process.exit(1);
});
