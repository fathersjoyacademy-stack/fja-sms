const fs = require("fs");
const path = require("path");

const appJsPath = path.join(__dirname, "../portal/app.js");
let content = fs.readFileSync(appJsPath, "utf8");

// Detect newline convention
const isCRLF = content.includes("\r\n");
const eol = isCRLF ? "\r\n" : "\n";

console.log("Read app.js, length:", content.length, "CRLF:", isCRLF);

let replacements = 0;

function safeReplace(target, replacement, desc) {
  const normTarget = target.replace(/\r?\n/g, eol);
  const normReplacement = replacement.replace(/\r?\n/g, eol);
  if (!content.includes(normTarget)) {
    console.error("FAILED to find target for: " + desc);
    console.error("Snippet:", normTarget.substring(0, 100));
    process.exit(1);
  }
  content = content.replace(normTarget, normReplacement);
  replacements++;
  console.log("Successfully replaced: " + desc);
}

// 1. Staff Creation Form: Add Contract / Employment Option
safeReplace(
`              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Base Salary (GHS)</label>
                  <input type="number" id="staff-salary" class="form-control" value="0" style="background:var(--bg-primary); border-color:var(--border-color); color:var(--text-primary);">
                </div>
                <div class="form-group">
                  <label class="form-label">Monthly Allowance (GHS)</label>
                  <input type="number" id="staff-allowance" class="form-control" value="0" style="background:var(--bg-primary); border-color:var(--border-color); color:var(--text-primary);">
                </div>
              </div>`,
`              <div class="grid-3">
                <div class="form-group">
                  <label class="form-label">Base Salary (GHS)</label>
                  <input type="number" id="staff-salary" class="form-control" value="0" style="background:var(--bg-primary); border-color:var(--border-color); color:var(--text-primary);">
                </div>
                <div class="form-group">
                  <label class="form-label">Monthly Allowance (GHS)</label>
                  <input type="number" id="staff-allowance" class="form-control" value="0" style="background:var(--bg-primary); border-color:var(--border-color); color:var(--text-primary);">
                </div>
                <div class="form-group">
                  <label class="form-label">Contract / Employment Option</label>
                  <select id="staff-contract-type" class="form-control" style="background:var(--bg-primary); border-color:var(--border-color); color:var(--text-primary);">
                    <option value="permanent" selected>Permanent Staff (SSNIT 5.5% & PAYE)</option>
                    <option value="casual">Casual / Contract (10% Withholding Tax)</option>
                  </select>
                </div>
              </div>`,
"1. Staff Creation Form HTML"
);

// 2. Staff CSV Template Header Info
safeReplace(
`            <!-- Staff CSV template instructions -->
            <div id="bulk-template-staff-info" class="portal-hidden" style="margin-bottom:1.5rem;">
              <strong style="font-size:0.85rem; color:var(--accent-secondary);">Staff Template Headers:</strong>
              <div style="font-size:0.8rem; background:var(--bg-secondary); border:1px solid var(--border-color); padding:0.5rem; border-radius:4px; margin-top:0.25rem; word-break:break-all; font-family:monospace;">
                first_name,other_name,last_name,gender,phone,email,role,dob,base_salary,allowances,address,class_name,additional_role
              </div>
            </div>`,
`            <!-- Staff CSV template instructions -->
            <div id="bulk-template-staff-info" class="portal-hidden" style="margin-bottom:1.5rem;">
              <strong style="font-size:0.85rem; color:var(--accent-secondary);">Staff Template Headers:</strong>
              <div style="font-size:0.8rem; background:var(--bg-secondary); border:1px solid var(--border-color); padding:0.5rem; border-radius:4px; margin-top:0.25rem; word-break:break-all; font-family:monospace;">
                first_name,other_name,last_name,gender,phone,email,role,dob,base_salary,allowances,address,class_name,additional_role,contract_type
              </div>
            </div>`,
"2. Staff CSV Template Header Info"
);

// 3. Staff Directory Table Header
safeReplace(
`        <!-- Staff Section -->
        <div id="dir-staff-section" class="portal-hidden">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>UID</th>
                  <th>Full Name</th>
                  <th>Gender</th>
                  <th>Staff Role</th>
                  <th>Phone</th>
                  <th>Section</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="dir-staff-table-body">`,
`        <!-- Staff Section -->
        <div id="dir-staff-section" class="portal-hidden">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>UID</th>
                  <th>Full Name</th>
                  <th>Gender</th>
                  <th>Staff Role</th>
                  <th>Contract</th>
                  <th>Phone</th>
                  <th>Section</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="dir-staff-table-body">`,
"3. Staff Directory Table Header"
);

// 4. Staff Directory Row Rendering
safeReplace(
`    // Render Staff list
    if (pagedStaff.totalItems === 0) {
      listBodyStaff.innerHTML = \`<tr><td colspan="8" style="text-align:center; color:var(--text-muted)">No staff members found matching filters.</td></tr>\`;
    } else {
      listBodyStaff.innerHTML = pagedStaff.items.map(u => {
        const prof = profiles.find(p => p.user_id === u.user_id);
        const section = getStaffSection(u, prof, classes);

        return \`
          <tr>
            <td><strong>\${u.uid}</strong></td>
            <td>\${formatFullName(u)}</td>
            <td>\${u.gender || 'Male'}</td>
            <td><span class="badge badge-info">\${u.role}</span></td>
            <td>\${u.phone}</td>
            <td>\${section}</td>
            <td><span class="badge \${u.status === 'ACTIVE' ? 'badge-success' : u.status === 'PENDING_PASSWORD' ? 'badge-warning' : 'badge-danger'}">\${u.status}</span></td>
            <td>
              <button class="btn btn-secondary btn-edit-staff-role" data-id="\${u.user_id}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem; border-color:var(--accent-primary); color:var(--accent-primary);">Edit Role</button>
              <button class="btn btn-secondary btn-reset-user" data-id="\${u.user_id}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem;">Reset Pass</button>
              <button class="btn btn-secondary btn-archive-user" data-id="\${u.user_id}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem; background:rgba(239,68,68,0.1); border-color:var(--accent-danger); color:var(--accent-danger);">Archive</button>
            </td>
          </tr>
        \`;
      }).join("");
    }`,
`    // Render Staff list
    if (pagedStaff.totalItems === 0) {
      listBodyStaff.innerHTML = \`<tr><td colspan="9" style="text-align:center; color:var(--text-muted)">No staff members found matching filters.</td></tr>\`;
    } else {
      listBodyStaff.innerHTML = pagedStaff.items.map(u => {
        const prof = profiles.find(p => p.user_id === u.user_id);
        const section = getStaffSection(u, prof, classes);
        const isCasual = (u.contract_type === "casual" || (prof && prof.contract_type === "casual"));

        return \`
          <tr>
            <td><strong>\${u.uid}</strong></td>
            <td>\${formatFullName(u)}</td>
            <td>\${u.gender || 'Male'}</td>
            <td><span class="badge badge-info">\${u.role}</span></td>
            <td>
              <span class="badge" style="background:\${isCasual ? '#d97706' : '#2563eb'}; color:#fff; font-size:0.75rem;">
                \${isCasual ? 'Casual (10% WHT)' : 'Permanent'}
              </span>
            </td>
            <td>\${u.phone}</td>
            <td>\${section}</td>
            <td><span class="badge \${u.status === 'ACTIVE' ? 'badge-success' : u.status === 'PENDING_PASSWORD' ? 'badge-warning' : 'badge-danger'}">\${u.status}</span></td>
            <td>
              <button class="btn btn-secondary btn-toggle-staff-contract" data-id="\${u.user_id}" data-current="\${isCasual ? 'casual' : 'permanent'}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem;" title="Switch between Permanent and Casual contract">\${isCasual ? '⇄ Make Permanent' : '⇄ Make Casual'}</button>
              <button class="btn btn-secondary btn-edit-staff-role" data-id="\${u.user_id}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem; border-color:var(--accent-primary); color:var(--accent-primary);">Edit Role</button>
              <button class="btn btn-secondary btn-reset-user" data-id="\${u.user_id}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem;">Reset Pass</button>
              <button class="btn btn-secondary btn-archive-user" data-id="\${u.user_id}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem; background:rgba(239,68,68,0.1); border-color:var(--accent-danger); color:var(--accent-danger);">Archive</button>
            </td>
          </tr>
        \`;
      }).join("");
    }`,
"4. Staff Directory Row Rendering"
);

// 5. Staff Directory Contract Toggle Event Binding
safeReplace(
`    // Bind edit role
    listBodyStaff.querySelectorAll(".btn-edit-staff-role").forEach(btn => {`,
`    // Bind contract toggle
    listBodyStaff.querySelectorAll(".btn-toggle-staff-contract").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const user = await window.db.get("users", id);
        if (!user) return;
        const current = btn.getAttribute("data-current") || "permanent";
        const target = current === "casual" ? "permanent" : "casual";
        const msg = target === "casual"
          ? \`Toggle \${formatFullName(user)} from Permanent to Casual contract?\\n\\n• Base salary & allowances will be kept intact\\n• SSNIT (5.5%) and PAYE will NOT be deducted (GH¢ 0.00)\\n• 10% Mandatory Withholding Tax will be deducted from payout.\`
          : \`Toggle \${formatFullName(user)} from Casual back to Permanent contract?\\n\\n• Standard SSNIT (5.5%) and graduated PAYE tax bands will apply.\`;

        if (!confirm(msg)) return;

        try {
          await window.api.toggleStaffContractType(id);
          showToast(\`\${formatFullName(user)} is now set to \${target.toUpperCase()} contract.\`, "success");
          loadUsers();
          if (typeof window._refreshPayrollEngine === "function") {
            window._refreshPayrollEngine();
          }
        } catch (err) {
          showToast("Failed to toggle contract: " + (err.message || err), "danger");
        }
      });
    });

    // Bind edit role
    listBodyStaff.querySelectorAll(".btn-edit-staff-role").forEach(btn => {`,
"5. Staff Directory Contract Toggle Event Binding"
);

// 6. Staff Form Submit Handler - save contract_type
safeReplace(
`      const photo_url = document.getElementById("staff-photo-base64").value || "";
      const userPayload = { first_name: first, other_name: other, last_name: last, gender, phone, email, role: roleToSave, date_of_birth: dob };
      const profilePayload = { address, base_salary: salary, allowances: allowance, emergency_contact, section, photo_url };`,
`      const photo_url = document.getElementById("staff-photo-base64").value || "";
      const contract_type = (document.getElementById("staff-contract-type") && document.getElementById("staff-contract-type").value) || "permanent";
      const userPayload = { first_name: first, other_name: other, last_name: last, gender, phone, email, role: roleToSave, date_of_birth: dob, contract_type };
      const profilePayload = { address, base_salary: salary, allowances: allowance, contract_type, emergency_contact, section, photo_url };`,
"6. Staff Form Submit Handler"
);

// 7. Bulk Staff CSV Import Handler - parse contract_type
safeReplace(
`            const userPayload = {
              first_name: row.first_name || "Bulk",
              other_name: row.other_name || "",
              last_name: row.last_name || "Staff",
              gender: genderVal,
              phone: row.phone || "0000000000",
              email: row.email || null,
              role: finalRole,
              date_of_birth: row.dob || "1990-01-01"
            };

            const profilePayload = {
              address: row.address || "Bulk Import Setup",
              base_salary: parseFloat(row.base_salary) || 0.00,
              allowances: parseFloat(row.allowances) || 0.00,
              section: section,
              emergency_contact: { name: "Direct Bulk Import", phone: row.phone }
            };`,
`            const contractTypeVal = (row.contract_type && row.contract_type.trim().toLowerCase() === "casual") ? "casual" : "permanent";
            const userPayload = {
              first_name: row.first_name || "Bulk",
              other_name: row.other_name || "",
              last_name: row.last_name || "Staff",
              gender: genderVal,
              phone: row.phone || "0000000000",
              email: row.email || null,
              role: finalRole,
              date_of_birth: row.dob || "1990-01-01",
              contract_type: contractTypeVal
            };

            const profilePayload = {
              address: row.address || "Bulk Import Setup",
              base_salary: parseFloat(row.base_salary) || 0.00,
              allowances: parseFloat(row.allowances) || 0.00,
              contract_type: contractTypeVal,
              section: section,
              emergency_contact: { name: "Direct Bulk Import", phone: row.phone }
            };`,
"7. Bulk Staff CSV Import Handler"
);

// 8. Payroll Engine: Active Table Header
safeReplace(
`              <thead>
                <tr>
                  <th>Staff UID</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Base (GHS)</th>
                  <th>Allowances</th>
                  <th>Adjustments</th>
                  <th>Gross Pay</th>
                  <th>SSNIT (5.5%)</th>
                  <th>PAYE Tax</th>
                  <th>Net Payout</th>
                  <th>Action</th>
                </tr>
              </thead>`,
`              <thead>
                <tr>
                  <th>Staff UID</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Contract</th>
                  <th>Base (GHS)</th>
                  <th>Allowances</th>
                  <th>Adjustments</th>
                  <th>Gross Pay</th>
                  <th>SSNIT (5.5%)</th>
                  <th>PAYE Tax</th>
                  <th>WHT (10%)</th>
                  <th>Net Payout</th>
                  <th>Action</th>
                </tr>
              </thead>`,
"8. Payroll Engine: Active Table Header"
);

// 9. Payroll Engine: History Table Header
safeReplace(
`          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Staff UID</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Base (GHS)</th>
                  <th>Allowances</th>
                  <th>Gross Pay</th>
                  <th>SSNIT (5.5%)</th>
                  <th>PAYE Tax</th>
                  <th>Net Payout</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="payroll-history-roster-rows">`,
`          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Staff UID</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Contract</th>
                  <th>Base (GHS)</th>
                  <th>Allowances</th>
                  <th>Gross Pay</th>
                  <th>SSNIT (5.5%)</th>
                  <th>PAYE Tax</th>
                  <th>WHT (10%)</th>
                  <th>Net Payout</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="payroll-history-roster-rows">`,
"9. Payroll Engine: History Table Header"
);

// 10. Adjust Salary Modal: Add Contract Option
safeReplace(
`              <div class="horizontal-paired-form">
                <div class="form-group">
                  <label class="form-label">Base Pay / Salary (GHS) <span style="color:var(--accent-primary);">*</span></label>
                  <input type="number" id="adj-base-salary" class="form-control" placeholder="e.g. 2500.00" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Duty Allowances (GHS)</label>
                  <input type="number" id="adj-allowance" class="form-control" placeholder="e.g. 0.00" step="0.01" min="0">
                </div>
              </div>`,
`              <div class="horizontal-paired-form">
                <div class="form-group">
                  <label class="form-label">Base Pay / Salary (GHS) <span style="color:var(--accent-primary);">*</span></label>
                  <input type="number" id="adj-base-salary" class="form-control" placeholder="e.g. 2500.00" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Duty Allowances (GHS)</label>
                  <input type="number" id="adj-allowance" class="form-control" placeholder="e.g. 0.00" step="0.01" min="0">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Contract / Employment Option</label>
                <select id="adj-contract-type" class="form-control" style="background:var(--bg-primary); border-color:var(--border-color); color:var(--text-primary);">
                  <option value="permanent">Permanent Staff (SSNIT 5.5% & PAYE)</option>
                  <option value="casual">Casual / Contract Staff (10% Withholding Tax, No SSNIT/PAYE)</option>
                </select>
              </div>`,
"10. Adjust Salary Modal: Add Contract Option"
);

// 11. Payroll Engine: loadActivePayroll row rendering
safeReplace(
`        rosterBody.innerHTML = staff.map(member => {
          const matchingTx = processedTxs.find(t => t.reference_no && t.reference_no.includes(member.uid));
          const profile = profiles.find(p => p.user_id === member.user_id) || { base_salary: 0, allowances: 0 };
          const paidAmount = matchingTx ? matchingTx.amount : 0;
          const basePayroll = window.api.calculatePayroll(profile.base_salary, profile.allowances);

          const tClasses = classes.filter(c => c.class_teacher_id === member.user_id);
          const prof = profiles.find(p => p.user_id === member.user_id) || {};
          const sec = getStaffSection(member, prof, classes);
          const classDesc = tClasses.length > 0 ? tClasses.map(c => c.class_name).join(", ") : sec;

          return \`
            <tr>
              <td><strong>\${member.uid}</strong></td>
              <td>\${formatFullName(member)}</td>
              <td><span class="badge badge-info">\${member.role}</span><br><small style="color:var(--text-secondary); font-size:0.75rem;">\${classDesc}</small></td>
              <td>GH¢ \${profile.base_salary.toFixed(2)}</td>
              <td>GH¢ \${profile.allowances.toFixed(2)}</td>
              <td><em style="color:var(--text-muted);">Processed Logs</em></td>
              <td><strong>GH¢ \${basePayroll.gross.toFixed(2)}</strong></td>
              <td>GH¢ \${basePayroll.ssnit.toFixed(2)}</td>
              <td>GH¢ \${basePayroll.paye.toFixed(2)}</td>
              <td><strong style="color:var(--accent-success)">GH¢ \${paidAmount.toFixed(2)}</strong></td>
              <td>
                <span class="badge" style="background:#065f46; color:#fff; padding:0.25rem 0.5rem; font-size:0.7rem;">Finalized</span>
                <button class="btn btn-secondary btn-view-payslip" data-id="\${member.user_id}" data-processed-amt="\${paidAmount}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem; margin-left:0.5rem;">View Slip</button>
              </td>
            </tr>
  \`;
        }).join("");
      } else {
        processBtn.disabled = false;
        processBtn.innerText = \`Process \${activeMonthLabel} Payroll\`;
        processBtn.style.opacity = "1";

        rosterBody.innerHTML = staff.map(member => {
          const profile = profiles.find(p => p.user_id === member.user_id) || { base_salary: 0, allowances: 0 };
          const periodAdjustments = (window.payrollAdjustments && window.payrollAdjustments[activePeriod]) || {};
          const adj = periodAdjustments[member.user_id] || (window.payrollAdjustments && window.payrollAdjustments[member.user_id]) || { bonus: 0, advance: 0, narration: "" };
          const effBase = (adj.base_salary !== undefined && adj.base_salary !== null) ? adj.base_salary : profile.base_salary;
          const effAllowance = (adj.allowances !== undefined && adj.allowances !== null) ? adj.allowances : profile.allowances;
          const payroll = window.api.calculatePayroll(effBase, effAllowance, adj.bonus, adj.advance);

          const tClasses = classes.filter(c => c.class_teacher_id === member.user_id);
          const prof = profiles.find(p => p.user_id === member.user_id) || {};
          const sec = getStaffSection(member, prof, classes);
          const classDesc = tClasses.length > 0 ? tClasses.map(c => c.class_name).join(", ") : sec;

          return \`
            <tr>
              <td><strong>\${member.uid}</strong></td>
              <td>\${formatFullName(member)}</td>
              <td><span class="badge badge-info">\${member.role}</span><br><small style="color:var(--text-secondary); font-size:0.75rem;">\${classDesc}</small></td>
              <td>GH¢ \${effBase.toFixed(2)}</td>
              <td>GH¢ \${effAllowance.toFixed(2)}</td>
              <td>
                <div style="font-size:0.75rem; color:var(--text-secondary); line-height:1.4;">
                  Add: <span style="color:var(--accent-success);">+GH¢ \${adj.bonus.toFixed(2)}</span><br>
                  Sub: <span style="color:var(--accent-danger);">-GH¢ \${adj.advance.toFixed(2)}</span>
                </div>
              </td>
              <td><strong>GH¢ \${payroll.gross.toFixed(2)}</strong></td>
              <td>GH¢ \${payroll.ssnit.toFixed(2)}</td>
              <td>GH¢ \${payroll.paye.toFixed(2)}</td>
              <td><strong style="color:var(--accent-success)">GH¢ \${payroll.netPay.toFixed(2)}</strong></td>
              <td>
                <button class="btn btn-secondary btn-adjust-salary" data-id="\${member.user_id}" data-name="\${formatFullName(member)}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem;">Adjust Pay</button>
                <button class="btn btn-secondary btn-view-payslip" data-id="\${member.user_id}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem; margin-left:0.25rem;">View Slip</button>
              </td>
            </tr>
          \`;
        }).join("");`,
`        rosterBody.innerHTML = staff.map(member => {
          const matchingTx = processedTxs.find(t => t.reference_no && t.reference_no.includes(member.uid));
          const profile = profiles.find(p => p.user_id === member.user_id) || { base_salary: 0, allowances: 0 };
          const paidAmount = matchingTx ? matchingTx.amount : 0;
          const contractType = (matchingTx && matchingTx.contract_type) || profile.contract_type || member.contract_type || "permanent";
          const isCasual = (contractType === "casual");
          const basePayroll = window.api.calculatePayroll(profile.base_salary, profile.allowances, 0, 0, contractType);

          const tClasses = classes.filter(c => c.class_teacher_id === member.user_id);
          const prof = profiles.find(p => p.user_id === member.user_id) || {};
          const sec = getStaffSection(member, prof, classes);
          const classDesc = tClasses.length > 0 ? tClasses.map(c => c.class_name).join(", ") : sec;
          const ssnitVal = matchingTx && matchingTx.ssnit !== undefined ? matchingTx.ssnit : basePayroll.ssnit;
          const payeVal = matchingTx && matchingTx.paye !== undefined ? matchingTx.paye : basePayroll.paye;
          const whtVal = matchingTx && matchingTx.withholding_tax !== undefined ? matchingTx.withholding_tax : basePayroll.withholdingTax;

          return \`
            <tr>
              <td><strong>\${member.uid}</strong></td>
              <td>\${formatFullName(member)}</td>
              <td><span class="badge badge-info">\${member.role}</span><br><small style="color:var(--text-secondary); font-size:0.75rem;">\${classDesc}</small></td>
              <td>
                <span class="badge" style="background:\${isCasual ? '#d97706' : '#2563eb'}; color:#fff; font-size:0.7rem;">
                  \${isCasual ? 'Casual' : 'Permanent'}
                </span>
              </td>
              <td>GH¢ \${profile.base_salary.toFixed(2)}</td>
              <td>GH¢ \${profile.allowances.toFixed(2)}</td>
              <td><em style="color:var(--text-muted);">Processed Logs</em></td>
              <td><strong>GH¢ \${(matchingTx && matchingTx.gross ? matchingTx.gross : basePayroll.gross).toFixed(2)}</strong></td>
              <td>\${isCasual ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${ssnitVal.toFixed(2)}\`}</td>
              <td>\${isCasual ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${payeVal.toFixed(2)}\`}</td>
              <td>\${isCasual ? \`<span style="color:#ef4444; font-weight:600;">GH¢ \${whtVal.toFixed(2)}</span>\` : '<span style="color:var(--text-muted);">-</span>'}</td>
              <td><strong style="color:var(--accent-success)">GH¢ \${paidAmount.toFixed(2)}</strong></td>
              <td>
                <span class="badge" style="background:#065f46; color:#fff; padding:0.25rem 0.5rem; font-size:0.7rem;">Finalized</span>
                <button class="btn btn-secondary btn-view-payslip" data-id="\${member.user_id}" data-processed-amt="\${paidAmount}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem; margin-left:0.5rem;">View Slip</button>
              </td>
            </tr>
  \`;
        }).join("");
      } else {
        processBtn.disabled = false;
        processBtn.innerText = \`Process \${activeMonthLabel} Payroll\`;
        processBtn.style.opacity = "1";

        rosterBody.innerHTML = staff.map(member => {
          const profile = profiles.find(p => p.user_id === member.user_id) || { base_salary: 0, allowances: 0 };
          const periodAdjustments = (window.payrollAdjustments && window.payrollAdjustments[activePeriod]) || {};
          const adj = periodAdjustments[member.user_id] || (window.payrollAdjustments && window.payrollAdjustments[member.user_id]) || { bonus: 0, advance: 0, narration: "" };
          const effBase = (adj.base_salary !== undefined && adj.base_salary !== null) ? adj.base_salary : profile.base_salary;
          const effAllowance = (adj.allowances !== undefined && adj.allowances !== null) ? adj.allowances : profile.allowances;
          const contractType = adj.contract_type || profile.contract_type || member.contract_type || "permanent";
          const isCasual = (contractType === "casual");
          const payroll = window.api.calculatePayroll(effBase, effAllowance, adj.bonus, adj.advance, contractType);

          const tClasses = classes.filter(c => c.class_teacher_id === member.user_id);
          const prof = profiles.find(p => p.user_id === member.user_id) || {};
          const sec = getStaffSection(member, prof, classes);
          const classDesc = tClasses.length > 0 ? tClasses.map(c => c.class_name).join(", ") : sec;

          return \`
            <tr>
              <td><strong>\${member.uid}</strong></td>
              <td>\${formatFullName(member)}</td>
              <td><span class="badge badge-info">\${member.role}</span><br><small style="color:var(--text-secondary); font-size:0.75rem;">\${classDesc}</small></td>
              <td>
                <span class="badge" style="background:\${isCasual ? '#d97706' : '#2563eb'}; color:#fff; font-size:0.7rem;">
                  \${isCasual ? 'Casual' : 'Permanent'}
                </span>
              </td>
              <td>GH¢ \${effBase.toFixed(2)}</td>
              <td>GH¢ \${effAllowance.toFixed(2)}</td>
              <td>
                <div style="font-size:0.75rem; color:var(--text-secondary); line-height:1.4;">
                  Add: <span style="color:var(--accent-success);">+GH¢ \${adj.bonus.toFixed(2)}</span><br>
                  Sub: <span style="color:var(--accent-danger);">-GH¢ \${adj.advance.toFixed(2)}</span>
                </div>
              </td>
              <td><strong>GH¢ \${payroll.gross.toFixed(2)}</strong></td>
              <td>\${isCasual ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${payroll.ssnit.toFixed(2)}\`}</td>
              <td>\${isCasual ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${payroll.paye.toFixed(2)}\`}</td>
              <td>\${isCasual ? \`<span style="color:#ef4444; font-weight:600;">GH¢ \${payroll.withholdingTax.toFixed(2)}</span>\` : '<span style="color:var(--text-muted);">-</span>'}</td>
              <td><strong style="color:var(--accent-success)">GH¢ \${payroll.netPay.toFixed(2)}</strong></td>
              <td>
                <button class="btn btn-secondary btn-quick-toggle-contract" data-id="\${member.user_id}" data-current="\${isCasual ? 'casual' : 'permanent'}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem;" title="Switch between Permanent and Casual contract">\${isCasual ? '⇄ Perm' : '⇄ Casual'}</button>
                <button class="btn btn-secondary btn-adjust-salary" data-id="\${member.user_id}" data-name="\${formatFullName(member)}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem; margin-left:0.25rem;">Adjust Pay</button>
                <button class="btn btn-secondary btn-view-payslip" data-id="\${member.user_id}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem; margin-left:0.25rem;">View Slip</button>
              </td>
            </tr>
          \`;
        }).join("");`,
"11. Payroll Engine: loadActivePayroll row rendering"
);

// 12. Adjust Pay Hook - populate contract option & bind quick toggle
safeReplace(
`            document.getElementById("adj-staff-id").value = staffId;
            document.getElementById("adj-staff-name").value = staffName;
            document.getElementById("adj-base-salary").value = (currentBase !== undefined && currentBase !== null) ? currentBase : "";
            document.getElementById("adj-allowance").value = (currentAllowance !== undefined && currentAllowance !== null) ? currentAllowance : "";
            document.getElementById("adj-bonus").value = adj.bonus || "";
            document.getElementById("adj-advance").value = adj.advance || "";
            document.getElementById("adj-narration").value = adj.narration || "";

            document.getElementById("adjust-salary-modal").classList.remove("portal-hidden");
          };
        });
      }`,
`            const currentContract = adj.contract_type || profile.contract_type || "permanent";
            document.getElementById("adj-staff-id").value = staffId;
            document.getElementById("adj-staff-name").value = staffName;
            document.getElementById("adj-base-salary").value = (currentBase !== undefined && currentBase !== null) ? currentBase : "";
            document.getElementById("adj-allowance").value = (currentAllowance !== undefined && currentAllowance !== null) ? currentAllowance : "";
            if (document.getElementById("adj-contract-type")) {
              document.getElementById("adj-contract-type").value = currentContract === "casual" ? "casual" : "permanent";
            }
            document.getElementById("adj-bonus").value = adj.bonus || "";
            document.getElementById("adj-advance").value = adj.advance || "";
            document.getElementById("adj-narration").value = adj.narration || "";

            document.getElementById("adjust-salary-modal").classList.remove("portal-hidden");
          };
        });

        // Quick Toggle Contract Option directly from active payroll row
        rosterBody.querySelectorAll(".btn-quick-toggle-contract").forEach(btn => {
          btn.onclick = async () => {
            const staffId = btn.getAttribute("data-id");
            const current = btn.getAttribute("data-current") || "permanent";
            const target = current === "casual" ? "permanent" : "casual";
            const memberObj = staff.find(s => s.user_id === staffId);
            const name = memberObj ? formatFullName(memberObj) : "staff member";

            const msg = target === "casual"
              ? \`Toggle \${name} to Casual contract?\\n\\n• Base salary & allowances will be kept intact\\n• SSNIT (5.5%) and PAYE will NOT be deducted (GH¢ 0.00)\\n• 10% Mandatory Withholding Tax will be deducted from payout.\`
              : \`Toggle \${name} back to Permanent contract?\\n\\n• Standard SSNIT (5.5%) and graduated PAYE tax bands will apply.\`;

            if (!confirm(msg)) return;

            try {
              await window.api.toggleStaffContractType(staffId);
              showToast(\`\${name} contract toggled to \${target.toUpperCase()}.\`, "success");
              loadActivePayroll();
            } catch (err) {
              showToast("Failed to toggle contract: " + (err.message || err), "danger");
            }
          };
        });
      }`,
"12. Adjust Pay Hook & Quick Toggle Binding"
);

// 13. Form adjust salary submission - save contract_type
safeReplace(
`      const baseSalary = parseFloat(document.getElementById("adj-base-salary").value) || 0;
      const allowance = parseFloat(document.getElementById("adj-allowance").value) || 0;
      const bonus = parseFloat(document.getElementById("adj-bonus").value) || 0;
      const advance = parseFloat(document.getElementById("adj-advance").value) || 0;
      const narration = document.getElementById("adj-narration").value || "";
      const activePeriod = activeMonthSelect ? activeMonthSelect.value : defaultActivePeriod;

      // Update profiles cache in memory, in IndexedDB and Firestore
      let prof = profiles.find(p => p.user_id === staffId);
      if (!prof) {
        prof = {
          profile_id: \`p-\${staffId}\`,
          user_id: staffId,
          base_salary: baseSalary,
          allowances: allowance,
          photo_url: "",
          address: "Ghana",
          created_at: new Date().toISOString()
        };
        profiles.push(prof);
      } else {
        prof.base_salary = baseSalary;
        prof.allowances = allowance;
      }`,
`      const baseSalary = parseFloat(document.getElementById("adj-base-salary").value) || 0;
      const allowance = parseFloat(document.getElementById("adj-allowance").value) || 0;
      const contractType = (document.getElementById("adj-contract-type") && document.getElementById("adj-contract-type").value) || "permanent";
      const bonus = parseFloat(document.getElementById("adj-bonus").value) || 0;
      const advance = parseFloat(document.getElementById("adj-advance").value) || 0;
      const narration = document.getElementById("adj-narration").value || "";
      const activePeriod = activeMonthSelect ? activeMonthSelect.value : defaultActivePeriod;

      // Update profiles cache in memory, in IndexedDB and Firestore
      let prof = profiles.find(p => p.user_id === staffId);
      if (!prof) {
        prof = {
          profile_id: \`p-\${staffId}\`,
          user_id: staffId,
          base_salary: baseSalary,
          allowances: allowance,
          contract_type: contractType,
          photo_url: "",
          address: "Ghana",
          created_at: new Date().toISOString()
        };
        profiles.push(prof);
      } else {
        prof.base_salary = baseSalary;
        prof.allowances = allowance;
        prof.contract_type = contractType;
      }`,
"13. Form adjust salary submission"
);

// 14. Adjust Salary Submit - update window.payrollAdjustments with contract_type
safeReplace(
`      if (!window.payrollAdjustments) window.payrollAdjustments = {};
      if (!window.payrollAdjustments[activePeriod]) window.payrollAdjustments[activePeriod] = {};
      window.payrollAdjustments[activePeriod][staffId] = { base_salary: baseSalary, allowances: allowance, bonus, advance, narration };
      window.payrollAdjustments[staffId] = { base_salary: baseSalary, allowances: allowance, bonus, advance, narration };`,
`      if (!window.payrollAdjustments) window.payrollAdjustments = {};
      if (!window.payrollAdjustments[activePeriod]) window.payrollAdjustments[activePeriod] = {};
      window.payrollAdjustments[activePeriod][staffId] = { base_salary: baseSalary, allowances: allowance, contract_type: contractType, bonus, advance, narration };
      window.payrollAdjustments[staffId] = { base_salary: baseSalary, allowances: allowance, contract_type: contractType, bonus, advance, narration };`,
"14. Adjust Salary Submit: adjustments object"
);

// 15. Payroll Engine: loadPayrollHistory rendering
safeReplace(
`      historyRosterBody.innerHTML = staff.map(member => {
        const matchingTx = historyTxs.find(t => t.reference_no && t.reference_no.includes(member.uid));
        const profile = profiles.find(p => p.user_id === member.user_id) || { base_salary: 0, allowances: 0 };
        const paidAmount = matchingTx ? matchingTx.amount : 0;
        const basePayroll = window.api.calculatePayroll(profile.base_salary, profile.allowances);

        return \`
          <tr>
            <td><strong>\${member.uid}</strong></td>
            <td>\${formatFullName(member)}</td>
            <td><span class="badge badge-info">\${member.role}</span></td>
            <td>GH¢ \${profile.base_salary.toFixed(2)}</td>
            <td>GH¢ \${profile.allowances.toFixed(2)}</td>
            <td><strong>GH¢ \${basePayroll.gross.toFixed(2)}</strong></td>
            <td>GH¢ \${basePayroll.ssnit.toFixed(2)}</td>
            <td>GH¢ \${basePayroll.paye.toFixed(2)}</td>
            <td><strong style="color:var(--accent-success)">GH¢ \${paidAmount.toFixed(2)}</strong></td>
            <td>
              <button class="btn btn-secondary btn-view-history-payslip" data-id="\${member.user_id}" data-processed-amt="\${paidAmount}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem;">View Slip</button>
            </td>
          </tr>
        \`;
      }).join("");`,
`      historyRosterBody.innerHTML = staff.map(member => {
        const matchingTx = historyTxs.find(t => t.reference_no && t.reference_no.includes(member.uid));
        const profile = profiles.find(p => p.user_id === member.user_id) || { base_salary: 0, allowances: 0 };
        const paidAmount = matchingTx ? matchingTx.amount : 0;
        const contractType = (matchingTx && matchingTx.contract_type) || profile.contract_type || member.contract_type || "permanent";
        const isCasual = (contractType === "casual");
        const basePayroll = window.api.calculatePayroll(profile.base_salary, profile.allowances, 0, 0, contractType);
        const ssnitVal = matchingTx && matchingTx.ssnit !== undefined ? matchingTx.ssnit : basePayroll.ssnit;
        const payeVal = matchingTx && matchingTx.paye !== undefined ? matchingTx.paye : basePayroll.paye;
        const whtVal = matchingTx && matchingTx.withholding_tax !== undefined ? matchingTx.withholding_tax : basePayroll.withholdingTax;

        return \`
          <tr>
            <td><strong>\${member.uid}</strong></td>
            <td>\${formatFullName(member)}</td>
            <td><span class="badge badge-info">\${member.role}</span></td>
            <td>
              <span class="badge" style="background:\${isCasual ? '#d97706' : '#2563eb'}; color:#fff; font-size:0.7rem;">
                \${isCasual ? 'Casual' : 'Permanent'}
              </span>
            </td>
            <td>GH¢ \${profile.base_salary.toFixed(2)}</td>
            <td>GH¢ \${profile.allowances.toFixed(2)}</td>
            <td><strong>GH¢ \${(matchingTx && matchingTx.gross ? matchingTx.gross : basePayroll.gross).toFixed(2)}</strong></td>
            <td>\${isCasual ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${ssnitVal.toFixed(2)}\`}</td>
            <td>\${isCasual ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${payeVal.toFixed(2)}\`}</td>
            <td>\${isCasual ? \`<span style="color:#ef4444; font-weight:600;">GH¢ \${whtVal.toFixed(2)}</span>\` : '<span style="color:var(--text-muted);">-</span>'}</td>
            <td><strong style="color:var(--accent-success)">GH¢ \${paidAmount.toFixed(2)}</strong></td>
            <td>
              <button class="btn btn-secondary btn-view-history-payslip" data-id="\${member.user_id}" data-processed-amt="\${paidAmount}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem;">View Slip</button>
            </td>
          </tr>
        \`;
      }).join("");`,
"15. Payroll Engine: loadPayrollHistory rendering"
);

// 16. Payroll Engine: showPayslipModal calculation
safeReplace(
`      const effBase = (adj.base_salary !== undefined && adj.base_salary !== null) ? adj.base_salary : profile.base_salary;
      const effAllowance = (adj.allowances !== undefined && adj.allowances !== null) ? adj.allowances : profile.allowances;

      if (historicalAmt !== null) {
        payroll = window.api.calculatePayroll(effBase, effAllowance);
        payroll.netPay = historicalAmt;
      } else {
        payroll = window.api.calculatePayroll(effBase, effAllowance, adj.bonus, adj.advance);
      }`,
`      const effBase = (adj.base_salary !== undefined && adj.base_salary !== null) ? adj.base_salary : profile.base_salary;
      const effAllowance = (adj.allowances !== undefined && adj.allowances !== null) ? adj.allowances : profile.allowances;
      const contractType = adj.contract_type || profile.contract_type || (member && member.contract_type) || "permanent";
      const isCasual = (contractType === "casual");

      if (historicalAmt !== null) {
        payroll = window.api.calculatePayroll(effBase, effAllowance, 0, 0, contractType);
        payroll.netPay = historicalAmt;
      } else {
        payroll = window.api.calculatePayroll(effBase, effAllowance, adj.bonus, adj.advance, contractType);
      }`,
"16. Payroll Engine: showPayslipModal calculation"
);

// 17. Payroll Engine: showPayslipModal Header
safeReplace(
`          <div>
            <div><strong>Staff Member:</strong> \${formatFullName(member)}</div>
            <div><strong>Roster UID:</strong> \${member.uid}</div>
            <div><strong>Role Scope:</strong> \${member.role}</div>
          </div>`,
`          <div>
            <div><strong>Staff Member:</strong> \${formatFullName(member)}</div>
            <div><strong>Roster UID:</strong> \${member.uid}</div>
            <div><strong>Role Scope:</strong> \${member.role}</div>
            <div><strong>Contract Option:</strong> <span class="badge" style="background:\${isCasual ? '#d97706' : '#2563eb'}; color:#fff; font-size:0.75rem;">\${isCasual ? 'Casual / Contract (10% WHT)' : 'Permanent Staff'}</span></div>
          </div>`,
"17. Payroll Engine: showPayslipModal Header"
);

// 18. Payroll Engine: showPayslipModal Breakdown Table
safeReplace(
`            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:0.5rem;">Pension SSNIT Deduction (5.5%)</td>
              <td></td>
              <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.ssnit.toFixed(2)}</td>
            </tr>
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:0.5rem;">Progressive Income Tax (PAYE)</td>
              <td></td>
              <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.paye.toFixed(2)}</td>
            </tr>
            \${adj.advance > 0 ? \`
            <tr style="border-bottom:1px solid #eee; color:#ef4444;">
              <td style="padding:0.5rem;">
                Special Deduction Subtraction
                \${adj.narration ? \`<br><span style="font-size:0.75rem; color:#666;">Note: \${adj.narration}</span>\` : ""}
              </td>
              <td></td>
              <td style="padding:0.5rem; text-align:right;">GH¢ \${adj.advance.toFixed(2)}</td>
            </tr>
            \` : ""}
            <tr style="border-bottom:2px solid #ddd; background:#fcfcfc; font-weight:bold;">
              <td style="padding:0.5rem;">Total Breakdown Summary</td>
              <td style="padding:0.5rem; text-align:right; color:#065f46;">GH¢ \${payroll.gross.toFixed(2)}</td>
              <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${(payroll.ssnit + payroll.paye + adj.advance).toFixed(2)}</td>
            </tr>`,
`            \${isCasual ? \`
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:0.5rem;">Mandatory Withholding Tax (10%)</td>
              <td></td>
              <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.withholdingTax.toFixed(2)}</td>
            </tr>
            <tr style="border-bottom:1px solid #eee; color:#666; font-size:0.8rem;">
              <td style="padding:0.5rem;">Statutory SSNIT & PAYE</td>
              <td></td>
              <td style="padding:0.5rem; text-align:right; color:var(--text-muted);">Exempt (GH¢ 0.00)</td>
            </tr>
            \` : \`
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:0.5rem;">Pension SSNIT Deduction (5.5%)</td>
              <td></td>
              <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.ssnit.toFixed(2)}</td>
            </tr>
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:0.5rem;">Progressive Income Tax (PAYE)</td>
              <td></td>
              <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.paye.toFixed(2)}</td>
            </tr>
            \`}
            \${adj.advance > 0 ? \`
            <tr style="border-bottom:1px solid #eee; color:#ef4444;">
              <td style="padding:0.5rem;">
                Special Deduction Subtraction
                \${adj.narration ? \`<br><span style="font-size:0.75rem; color:#666;">Note: \${adj.narration}</span>\` : ""}
              </td>
              <td></td>
              <td style="padding:0.5rem; text-align:right;">GH¢ \${adj.advance.toFixed(2)}</td>
            </tr>
            \` : ""}
            <tr style="border-bottom:2px solid #ddd; background:#fcfcfc; font-weight:bold;">
              <td style="padding:0.5rem;">Total Breakdown Summary</td>
              <td style="padding:0.5rem; text-align:right; color:#065f46;">GH¢ \${payroll.gross.toFixed(2)}</td>
              <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${(isCasual ? (payroll.withholdingTax + adj.advance) : (payroll.ssnit + payroll.paye + adj.advance)).toFixed(2)}</td>
            </tr>`,
"18. Payroll Engine: showPayslipModal Breakdown Table"
);

// 19. Payroll Batch Processing: Pass contractType and record withholding_tax
safeReplace(
`        for (const member of staff) {
          const profile = profiles.find(p => p.user_id === member.user_id) || { base_salary: 0, allowances: 0 };
          const periodAdjustments = (window.payrollAdjustments && window.payrollAdjustments[activePeriod]) || {};
          const adj = periodAdjustments[member.user_id] || (window.payrollAdjustments && window.payrollAdjustments[member.user_id]) || { bonus: 0, advance: 0, narration: "" };
          const effBase = (adj.base_salary !== undefined && adj.base_salary !== null) ? adj.base_salary : profile.base_salary;
          const effAllowance = (adj.allowances !== undefined && adj.allowances !== null) ? adj.allowances : profile.allowances;
          const payroll = window.api.calculatePayroll(effBase, effAllowance, adj.bonus, adj.advance);
          
          const txId = \`t-payroll-batch-\${member.user_id}-\${Date.now()}\`;
          const nowIso = new Date().toISOString();
          const record = {
            transaction_id: txId,
            student_id: null,
            type: "PAYROLL",
            amount: payroll.netPay,
            payment_method: "BANK_TRANSFER",
            reference_no: \`PAY-\${activePeriod}-\${member.uid}\`,
            pay_period: activePeriod,
            billing_description: \`Staff Payroll: \${activeMonthLabel}\`,
            recorded_by: currentUser.user_id,
            timestamp: nowIso
          };`,
`        for (const member of staff) {
          const profile = profiles.find(p => p.user_id === member.user_id) || { base_salary: 0, allowances: 0 };
          const periodAdjustments = (window.payrollAdjustments && window.payrollAdjustments[activePeriod]) || {};
          const adj = periodAdjustments[member.user_id] || (window.payrollAdjustments && window.payrollAdjustments[member.user_id]) || { bonus: 0, advance: 0, narration: "" };
          const effBase = (adj.base_salary !== undefined && adj.base_salary !== null) ? adj.base_salary : profile.base_salary;
          const effAllowance = (adj.allowances !== undefined && adj.allowances !== null) ? adj.allowances : profile.allowances;
          const contractType = adj.contract_type || profile.contract_type || member.contract_type || "permanent";
          const payroll = window.api.calculatePayroll(effBase, effAllowance, adj.bonus, adj.advance, contractType);
          
          const txId = \`t-payroll-batch-\${member.user_id}-\${Date.now()}\`;
          const nowIso = new Date().toISOString();
          const record = {
            transaction_id: txId,
            student_id: null,
            type: "PAYROLL",
            amount: payroll.netPay,
            payment_method: "BANK_TRANSFER",
            reference_no: \`PAY-\${activePeriod}-\${member.uid}\`,
            pay_period: activePeriod,
            billing_description: \`Staff Payroll (\${payroll.isCasual ? 'Casual' : 'Permanent'}): \${activeMonthLabel}\`,
            recorded_by: currentUser.user_id,
            timestamp: nowIso,
            contract_type: contractType,
            gross: payroll.gross,
            ssnit: payroll.ssnit,
            paye: payroll.paye,
            withholding_tax: payroll.withholdingTax || 0
          };`,
"19. Payroll Batch Processing Tx Record"
);

// 20. Proprietor Payroll History Header
safeReplace(
`          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Staff UID</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Base (GHS)</th>
                  <th>Allowances</th>
                  <th>Gross Pay</th>
                  <th>SSNIT (5.5%)</th>
                  <th>PAYE Tax</th>
                  <th>Net Payout</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="payroll-history-roster-rows">`,
`          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Staff UID</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Contract</th>
                  <th>Base (GHS)</th>
                  <th>Allowances</th>
                  <th>Gross Pay</th>
                  <th>SSNIT (5.5%)</th>
                  <th>PAYE Tax</th>
                  <th>WHT (10%)</th>
                  <th>Net Payout</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="payroll-history-roster-rows">`,
"20. Proprietor Payroll History Header"
);

// 21. Proprietor Payroll History Row Rendering
safeReplace(
`      historyRosterBody.innerHTML = staff.map(member => {
        const matchingTx = historyTxs.find(t => t.reference_no.includes(member.uid));
        const profile = profiles.find(p => p.user_id === member.user_id) || { base_salary: 0, allowances: 0 };
        const paidAmount = matchingTx ? matchingTx.amount : 0;
        const basePayroll = window.api.calculatePayroll(profile.base_salary, profile.allowances);

        return \`
          <tr>
            <td><strong>\${member.uid}</strong></td>
            <td>\${formatFullName(member)}</td>
            <td><span class="badge badge-info">\${member.role}</span></td>
            <td>GH¢ \${profile.base_salary.toFixed(2)}</td>
            <td>GH¢ \${profile.allowances.toFixed(2)}</td>
            <td><strong>GH¢ \${basePayroll.gross.toFixed(2)}</strong></td>
            <td>GH¢ \${basePayroll.ssnit.toFixed(2)}</td>
            <td>GH¢ \${basePayroll.paye.toFixed(2)}</td>
            <td><strong style="color:var(--accent-success)">GH¢ \${paidAmount.toFixed(2)}</strong></td>
            <td>
              <button class="btn btn-secondary btn-view-history-payslip" data-id="\${member.user_id}" data-processed-amt="\${paidAmount}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem;">View Slip</button>
            </td>
          </tr>
        \`;
      }).join("");`,
`      historyRosterBody.innerHTML = staff.map(member => {
        const matchingTx = historyTxs.find(t => t.reference_no.includes(member.uid));
        const profile = profiles.find(p => p.user_id === member.user_id) || { base_salary: 0, allowances: 0 };
        const paidAmount = matchingTx ? matchingTx.amount : 0;
        const contractType = (matchingTx && matchingTx.contract_type) || profile.contract_type || member.contract_type || "permanent";
        const isCasual = (contractType === "casual");
        const basePayroll = window.api.calculatePayroll(profile.base_salary, profile.allowances, 0, 0, contractType);
        const ssnitVal = matchingTx && matchingTx.ssnit !== undefined ? matchingTx.ssnit : basePayroll.ssnit;
        const payeVal = matchingTx && matchingTx.paye !== undefined ? matchingTx.paye : basePayroll.paye;
        const whtVal = matchingTx && matchingTx.withholding_tax !== undefined ? matchingTx.withholding_tax : basePayroll.withholdingTax;

        return \`
          <tr>
            <td><strong>\${member.uid}</strong></td>
            <td>\${formatFullName(member)}</td>
            <td><span class="badge badge-info">\${member.role}</span></td>
            <td>
              <span class="badge" style="background:\${isCasual ? '#d97706' : '#2563eb'}; color:#fff; font-size:0.7rem;">
                \${isCasual ? 'Casual' : 'Permanent'}
              </span>
            </td>
            <td>GH¢ \${profile.base_salary.toFixed(2)}</td>
            <td>GH¢ \${profile.allowances.toFixed(2)}</td>
            <td><strong>GH¢ \${(matchingTx && matchingTx.gross ? matchingTx.gross : basePayroll.gross).toFixed(2)}</strong></td>
            <td>\${isCasual ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${ssnitVal.toFixed(2)}\`}</td>
            <td>\${isCasual ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${payeVal.toFixed(2)}\`}</td>
            <td>\${isCasual ? \`<span style="color:#ef4444; font-weight:600;">GH¢ \${whtVal.toFixed(2)}</span>\` : '<span style="color:var(--text-muted);">-</span>'}</td>
            <td><strong style="color:var(--accent-success)">GH¢ \${paidAmount.toFixed(2)}</strong></td>
            <td>
              <button class="btn btn-secondary btn-view-history-payslip" data-id="\${member.user_id}" data-processed-amt="\${paidAmount}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem;">View Slip</button>
            </td>
          </tr>
        \`;
      }).join("");`,
"21. Proprietor Payroll History Row Rendering"
);

// 22. Proprietor showPayslipModal calculation
safeReplace(
`      if (historicalAmt !== null) {
        payroll = window.api.calculatePayroll(profile.base_salary, profile.allowances);
        payroll.netPay = historicalAmt;
      } else {
        adj = (window.payrollAdjustments && window.payrollAdjustments[userId]) || { bonus: 0, advance: 0, narration: "" };
        payroll = window.api.calculatePayroll(profile.base_salary, profile.allowances, adj.bonus, adj.advance);
      }`,
`      const contractType = (window.payrollAdjustments && window.payrollAdjustments[userId] && window.payrollAdjustments[userId].contract_type) || profile.contract_type || (member && member.contract_type) || "permanent";
      const isCasual = (contractType === "casual");

      if (historicalAmt !== null) {
        payroll = window.api.calculatePayroll(profile.base_salary, profile.allowances, 0, 0, contractType);
        payroll.netPay = historicalAmt;
      } else {
        adj = (window.payrollAdjustments && window.payrollAdjustments[userId]) || { bonus: 0, advance: 0, narration: "" };
        payroll = window.api.calculatePayroll(profile.base_salary, profile.allowances, adj.bonus, adj.advance, contractType);
      }`,
"22. Proprietor showPayslipModal calculation"
);

// 23. Proprietor showPayslipModal Breakdown Table
safeReplace(
`            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:0.5rem;">Pension SSNIT Deduction (5.5%)</td>
              <td></td>
              <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.ssnit.toFixed(2)}</td>
            </tr>
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:0.5rem;">Progressive Income Tax (PAYE)</td>
              <td></td>
              <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.paye.toFixed(2)}</td>
            </tr>
            \${adj.advance > 0 ? \`
            <tr style="border-bottom:1px solid #eee; color:#ef4444;">
              <td style="padding:0.5rem;">
                Special Deduction Subtraction
                \${adj.narration ? \`<br><span style="font-size:0.75rem; color:#666;">Note: \${adj.advance}</span>\` : ""}
              </td>
              <td></td>
              <td style="padding:0.5rem; text-align:right;">GH¢ \${adj.advance.toFixed(2)}</td>
            </tr>
            \` : ""}
            <tr style="border-bottom:2px solid #ddd; background:#fcfcfc; font-weight:bold;">
              <td style="padding:0.5rem;">Total Breakdown Summary</td>
              <td style="padding:0.5rem; text-align:right; color:#065f46;">GH¢ \${payroll.gross.toFixed(2)}</td>
              <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${(payroll.ssnit + payroll.paye + adj.advance).toFixed(2)}</td>
            </tr>`,
`            \${isCasual ? \`
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:0.5rem;">Mandatory Withholding Tax (10%)</td>
              <td></td>
              <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.withholdingTax.toFixed(2)}</td>
            </tr>
            <tr style="border-bottom:1px solid #eee; color:#666; font-size:0.8rem;">
              <td style="padding:0.5rem;">Statutory SSNIT & PAYE</td>
              <td></td>
              <td style="padding:0.5rem; text-align:right; color:var(--text-muted);">Exempt (GH¢ 0.00)</td>
            </tr>
            \` : \`
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:0.5rem;">Pension SSNIT Deduction (5.5%)</td>
              <td></td>
              <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.ssnit.toFixed(2)}</td>
            </tr>
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:0.5rem;">Progressive Income Tax (PAYE)</td>
              <td></td>
              <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.paye.toFixed(2)}</td>
            </tr>
            \`}
            \${adj.advance > 0 ? \`
            <tr style="border-bottom:1px solid #eee; color:#ef4444;">
              <td style="padding:0.5rem;">
                Special Deduction Subtraction
                \${adj.narration ? \`<br><span style="font-size:0.75rem; color:#666;">Note: \${adj.advance}</span>\` : ""}
              </td>
              <td></td>
              <td style="padding:0.5rem; text-align:right;">GH¢ \${adj.advance.toFixed(2)}</td>
            </tr>
            \` : ""}
            <tr style="border-bottom:2px solid #ddd; background:#fcfcfc; font-weight:bold;">
              <td style="padding:0.5rem;">Total Breakdown Summary</td>
              <td style="padding:0.5rem; text-align:right; color:#065f46;">GH¢ \${payroll.gross.toFixed(2)}</td>
              <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${(isCasual ? (payroll.withholdingTax + adj.advance) : (payroll.ssnit + payroll.paye + adj.advance)).toFixed(2)}</td>
            </tr>`,
"23. Proprietor showPayslipModal Breakdown Table"
);

// 24. Teacher Payslips: renderTeacherPayslips
safeReplace(
`    const payroll = window.api.calculatePayroll(profile.base_salary, profile.allowances);
    if (myTxs.length > 0 && myTxs[0].amount) {
      payroll.netPay = myTxs[0].amount;
    }`,
`    const contractType = profile.contract_type || (activeUser && activeUser.contract_type) || "permanent";
    const isCasual = (contractType === "casual");
    const payroll = window.api.calculatePayroll(profile.base_salary, profile.allowances, 0, 0, contractType);
    if (myTxs.length > 0 && myTxs[0].amount) {
      payroll.netPay = myTxs[0].amount;
    }`,
"24. renderTeacherPayslips calculation"
);

safeReplace(
`              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:0.5rem;">Statutory SSNIT (5.5%)</td>
                <td></td>
                <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.ssnit.toFixed(2)}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:0.5rem;">Progressive Income Tax (PAYE)</td>
                <td></td>
                <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.paye.toFixed(2)}</td>
              </tr>`,
`              \${isCasual ? \`
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:0.5rem;">Mandatory Withholding Tax (10%)</td>
                <td></td>
                <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.withholdingTax.toFixed(2)}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee; color:#666; font-size:0.8rem;">
                <td style="padding:0.5rem;">Statutory SSNIT & PAYE</td>
                <td></td>
                <td style="padding:0.5rem; text-align:right; color:var(--text-muted);">Exempt (GH¢ 0.00)</td>
              </tr>
              \` : \`
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:0.5rem;">Statutory SSNIT (5.5%)</td>
                <td></td>
                <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.ssnit.toFixed(2)}</td>
              </tr>
              <tr style="border-bottom:1px solid #eee;">
                <td style="padding:0.5rem;">Progressive Income Tax (PAYE)</td>
                <td></td>
                <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.paye.toFixed(2)}</td>
              </tr>
              \`}`,
"25. renderTeacherPayslips Breakdown Table"
);

// 26. Records Management: Edit Record Modal HTML (add contract option)
safeReplace(
`              <div class="grid-2" style="gap:1rem; margin-top:0.75rem;">
                <div class="form-group">
                  <label class="form-label">Base Salary (GHS)</label>
                  <input type="number" id="edit-rec-staff-salary" class="form-control" step="0.01" style="background:var(--bg-primary); border-color:var(--border-color); color:var(--text-primary);">
                </div>
                <div class="form-group">
                  <label class="form-label">Monthly Allowance (GHS)</label>
                  <input type="number" id="edit-rec-staff-allowance" class="form-control" step="0.01" style="background:var(--bg-primary); border-color:var(--border-color); color:var(--text-primary);">
                </div>
              </div>`,
`              <div class="grid-3" style="gap:1rem; margin-top:0.75rem;">
                <div class="form-group">
                  <label class="form-label">Base Salary (GHS)</label>
                  <input type="number" id="edit-rec-staff-salary" class="form-control" step="0.01" style="background:var(--bg-primary); border-color:var(--border-color); color:var(--text-primary);">
                </div>
                <div class="form-group">
                  <label class="form-label">Monthly Allowance (GHS)</label>
                  <input type="number" id="edit-rec-staff-allowance" class="form-control" step="0.01" style="background:var(--bg-primary); border-color:var(--border-color); color:var(--text-primary);">
                </div>
                <div class="form-group">
                  <label class="form-label">Contract / Employment Option</label>
                  <select id="edit-rec-staff-contract-type" class="form-control" style="background:var(--bg-primary); border-color:var(--border-color); color:var(--text-primary);">
                    <option value="permanent">Permanent (SSNIT & PAYE)</option>
                    <option value="casual">Casual (10% Withholding Tax)</option>
                  </select>
                </div>
              </div>`,
"26. Records Management: Edit Record Modal HTML"
);

// 27. Records Management: Profile Right Panel Breakdown (show contract pill & WHT)
safeReplace(
`        const basic = (p.base_salary !== undefined && p.base_salary !== null && p.base_salary !== "") ? Number(p.base_salary) : 0;
        const allowance = (p.allowances !== undefined && p.allowances !== null && p.allowances !== "") ? Number(p.allowances) : 0;
        const payroll = window.api.calculatePayroll(basic, allowance);
        const gross = payroll.gross;
        const ssnit = payroll.ssnit;
        const paye = payroll.paye;
        const net = payroll.netPay;

        document.getElementById("profile-right-panel-content").innerHTML = \`
          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            <div class="profile-info-pill">
              <span class="pill-label">Basic Salary:</span>
              <span class="pill-value">GH¢ \${basic.toFixed(2)}</span>
            </div>
            <div class="profile-info-pill">
              <span class="pill-label">Allowances:</span>
              <span class="pill-value">GH¢ \${allowance.toFixed(2)}</span>
            </div>
            <div class="profile-info-pill">
              <span class="pill-label">Gross Pay:</span>
              <span class="pill-value">GH¢ \${gross.toFixed(2)}</span>
            </div>
            <div class="profile-info-pill">
              <span class="pill-label">SSNIT Deduction (5.5%):</span>
              <span class="pill-value" style="color:var(--accent-danger);">- GH¢ \${ssnit.toFixed(2)}</span>
            </div>
            <div class="profile-info-pill">
              <span class="pill-label">PAYE Income Tax:</span>
              <span class="pill-value" style="color:var(--accent-danger);">- GH¢ \${paye.toFixed(2)}</span>
            </div>
            <div class="profile-info-pill" style="border-color:var(--accent-success); background:rgba(16,185,129,0.06);">
              <span class="pill-label" style="font-weight:700; color:var(--accent-success);">Net Monthly Pay:</span>
              <span class="pill-value" style="color:var(--accent-success); font-size:0.95rem;">GH¢ \${net.toFixed(2)}</span>
            </div>
          </div>
        \`;`,
`        const basic = (p.base_salary !== undefined && p.base_salary !== null && p.base_salary !== "") ? Number(p.base_salary) : 0;
        const allowance = (p.allowances !== undefined && p.allowances !== null && p.allowances !== "") ? Number(p.allowances) : 0;
        const contractType = p.contract_type || u.contract_type || "permanent";
        const isCasual = (contractType === "casual");
        const payroll = window.api.calculatePayroll(basic, allowance, 0, 0, contractType);
        const gross = payroll.gross;
        const ssnit = payroll.ssnit;
        const paye = payroll.paye;
        const net = payroll.netPay;

        document.getElementById("profile-right-panel-content").innerHTML = \`
          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            <div class="profile-info-pill">
              <span class="pill-label">Contract Option:</span>
              <span class="pill-value">
                <span class="badge" style="background:\${isCasual ? '#d97706' : '#2563eb'}; color:#fff; font-size:0.75rem;">
                  \${isCasual ? 'Casual (10% Withholding Tax)' : 'Permanent Staff (SSNIT/PAYE)'}
                </span>
              </span>
            </div>
            <div class="profile-info-pill">
              <span class="pill-label">Basic Salary:</span>
              <span class="pill-value">GH¢ \${basic.toFixed(2)}</span>
            </div>
            <div class="profile-info-pill">
              <span class="pill-label">Allowances:</span>
              <span class="pill-value">GH¢ \${allowance.toFixed(2)}</span>
            </div>
            <div class="profile-info-pill">
              <span class="pill-label">Gross Pay:</span>
              <span class="pill-value">GH¢ \${gross.toFixed(2)}</span>
            </div>
            \${isCasual ? \`
            <div class="profile-info-pill">
              <span class="pill-label">SSNIT & PAYE:</span>
              <span class="pill-value" style="color:var(--text-secondary);">Exempt (GH¢ 0.00)</span>
            </div>
            <div class="profile-info-pill">
              <span class="pill-label">Withholding Tax (10%):</span>
              <span class="pill-value" style="color:var(--accent-danger);">- GH¢ \${payroll.withholdingTax.toFixed(2)}</span>
            </div>
            \` : \`
            <div class="profile-info-pill">
              <span class="pill-label">SSNIT Deduction (5.5%):</span>
              <span class="pill-value" style="color:var(--accent-danger);">- GH¢ \${ssnit.toFixed(2)}</span>
            </div>
            <div class="profile-info-pill">
              <span class="pill-label">PAYE Income Tax:</span>
              <span class="pill-value" style="color:var(--accent-danger);">- GH¢ \${paye.toFixed(2)}</span>
            </div>
            \`}
            <div class="profile-info-pill" style="border-color:var(--accent-success); background:rgba(16,185,129,0.06);">
              <span class="pill-label" style="font-weight:700; color:var(--accent-success);">Net Monthly Pay:</span>
              <span class="pill-value" style="color:var(--accent-success); font-size:0.95rem;">GH¢ \${net.toFixed(2)}</span>
            </div>
          </div>
        \`;`,
"27. Records Management: Profile Right Panel Breakdown"
);

// 28. openAdminEditRecordModal - populate contract_type
safeReplace(
`        document.getElementById("edit-rec-staff-salary").value = (p.base_salary !== undefined && p.base_salary !== null) ? p.base_salary : 0;
        document.getElementById("edit-rec-staff-allowance").value = (p.allowances !== undefined && p.allowances !== null) ? p.allowances : 0;`,
`        document.getElementById("edit-rec-staff-salary").value = (p.base_salary !== undefined && p.base_salary !== null) ? p.base_salary : 0;
        document.getElementById("edit-rec-staff-allowance").value = (p.allowances !== undefined && p.allowances !== null) ? p.allowances : 0;
        if (document.getElementById("edit-rec-staff-contract-type")) {
          document.getElementById("edit-rec-staff-contract-type").value = (p.contract_type || u.contract_type || "permanent") === "casual" ? "casual" : "permanent";
        }`,
"28. openAdminEditRecordModal populate contract_type"
);

// 29. Admin Edit Record Modal Submit - save contract_type
safeReplace(
`          p.base_salary = parseFloat(document.getElementById("edit-rec-staff-salary").value) || 0;
          p.allowances = parseFloat(document.getElementById("edit-rec-staff-allowance").value) || 0;
          p.section = document.getElementById("edit-rec-staff-section").value;
          p.appointment_date = document.getElementById("edit-rec-staff-app-date").value || p.appointment_date || new Date().toISOString().split("T")[0];`,
`          p.base_salary = parseFloat(document.getElementById("edit-rec-staff-salary").value) || 0;
          p.allowances = parseFloat(document.getElementById("edit-rec-staff-allowance").value) || 0;
          const editContract = (document.getElementById("edit-rec-staff-contract-type") && document.getElementById("edit-rec-staff-contract-type").value) || "permanent";
          p.contract_type = editContract;
          u.contract_type = editContract;
          p.section = document.getElementById("edit-rec-staff-section").value;
          p.appointment_date = document.getElementById("edit-rec-staff-app-date").value || p.appointment_date || new Date().toISOString().split("T")[0];`,
"29. Admin Edit Record Modal Submit save contract_type"
);

// 30. showPayslipModalForSelf
safeReplace(
`  const payroll = window.api.calculatePayroll(profile.base_salary, profile.allowances);
  if (historicalAmt !== null) {
    payroll.netPay = historicalAmt;
  }`,
`  const contractType = profile.contract_type || (member && member.contract_type) || "permanent";
  const isCasual = (contractType === "casual");
  const payroll = window.api.calculatePayroll(profile.base_salary, profile.allowances, 0, 0, contractType);
  if (historicalAmt !== null) {
    payroll.netPay = historicalAmt;
  }`,
"30. showPayslipModalForSelf calculation"
);

safeReplace(
`        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:0.5rem;">Pension SSNIT Deduction (5.5%)</td>
          <td></td>
          <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.ssnit.toFixed(2)}</td>
        </tr>
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:0.5rem;">Progressive Income Tax (PAYE)</td>
          <td></td>
          <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.paye.toFixed(2)}</td>
        </tr>
        <tr style="border-bottom:2px solid #ddd; background:#fcfcfc; font-weight:bold;">
          <td style="padding:0.5rem;">Total Breakdown Summary</td>
          <td style="padding:0.5rem; text-align:right; color:#065f46;">GH¢ \${payroll.gross.toFixed(2)}</td>
          <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${(payroll.ssnit + payroll.paye).toFixed(2)}</td>
        </tr>`,
`        \${isCasual ? \`
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:0.5rem;">Mandatory Withholding Tax (10%)</td>
          <td></td>
          <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.withholdingTax.toFixed(2)}</td>
        </tr>
        <tr style="border-bottom:1px solid #eee; color:#666; font-size:0.8rem;">
          <td style="padding:0.5rem;">Statutory SSNIT & PAYE</td>
          <td></td>
          <td style="padding:0.5rem; text-align:right; color:var(--text-muted);">Exempt (GH¢ 0.00)</td>
        </tr>
        <tr style="border-bottom:2px solid #ddd; background:#fcfcfc; font-weight:bold;">
          <td style="padding:0.5rem;">Total Breakdown Summary</td>
          <td style="padding:0.5rem; text-align:right; color:#065f46;">GH¢ \${payroll.gross.toFixed(2)}</td>
          <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.withholdingTax.toFixed(2)}</td>
        </tr>
        \` : \`
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:0.5rem;">Pension SSNIT Deduction (5.5%)</td>
          <td></td>
          <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.ssnit.toFixed(2)}</td>
        </tr>
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:0.5rem;">Progressive Income Tax (PAYE)</td>
          <td></td>
          <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${payroll.paye.toFixed(2)}</td>
        </tr>
        <tr style="border-bottom:2px solid #ddd; background:#fcfcfc; font-weight:bold;">
          <td style="padding:0.5rem;">Total Breakdown Summary</td>
          <td style="padding:0.5rem; text-align:right; color:#065f46;">GH¢ \${payroll.gross.toFixed(2)}</td>
          <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${(payroll.ssnit + payroll.paye).toFixed(2)}</td>
        </tr>
        \`}`,
"31. showPayslipModalForSelf Breakdown Table"
);

fs.writeFileSync(appJsPath, content, "utf8");
console.log(`\nALL DONE! Successfully performed ${replacements} replacements in portal/app.js`);
