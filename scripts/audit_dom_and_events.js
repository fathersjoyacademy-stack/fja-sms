// scripts/audit_dom_and_events.js
const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, '../portal/app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '../portal/index.html'), 'utf8');

// 1. Audit getElementById calls
const getElemRegex = /document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)/g;
let match;
const queriedIds = new Map(); // id -> array of line numbers
const lines = appJs.split('\n');

lines.forEach((line, lineIdx) => {
  let m;
  const re = /document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = re.exec(line)) !== null) {
    const id = m[1];
    if (!queriedIds.has(id)) queriedIds.set(id, []);
    queriedIds.get(id).push(lineIdx + 1);
  }
});

// 2. Find all IDs defined in HTML templates or index.html
const allHtmlText = indexHtml + '\n' + appJs;
const idDefRegex = /\bid\s*=\s*['"]([^'"]+)['"]/g;
const definedIds = new Set();
while ((match = idDefRegex.exec(allHtmlText)) !== null) {
  definedIds.add(match[1]);
}

const missing = [];
for (const [id, lineNums] of queriedIds.entries()) {
  if (!definedIds.has(id)) {
    // Check if it might be dynamically created with template string or prefix
    missing.push({ id, lines: lineNums });
  }
}

console.log('=== GETELEMENTBYID AUDIT ===');
console.log(`Queried IDs: ${queriedIds.size}, Defined IDs: ${definedIds.size}`);
console.log(`Potential missing IDs: ${missing.length}`);
missing.forEach(m => {
  console.log(`  - [Line ${m.lines.join(', ')}] id="${m.id}"`);
});

// 3. Check for .addEventListener or .onclick on elements that could be null without a null check
console.log('\n=== UNGUARDED EVENT LISTENER AUDIT ===');
const unguardedList = [];
lines.forEach((line, idx) => {
  // Pattern: document.getElementById("...").addEventListener or document.getElementById("...").onclick =
  const directCall = /document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)\s*\.(addEventListener|onclick)/.exec(line);
  if (directCall) {
    const id = directCall[1];
    if (!definedIds.has(id)) {
      unguardedList.push({ id, lineNum: idx + 1, code: line.trim() });
    }
  }
});

if (unguardedList.length === 0) {
  console.log('No direct unguarded listeners on missing IDs found.');
} else {
  unguardedList.forEach(u => {
    console.log(`  - [Line ${u.lineNum}] ${u.id}: ${u.code}`);
  });
}
