const fs = require("fs");
const path = require("path");

const apiJsPath = path.join(__dirname, "../portal/api.js");
const appJsPath = path.join(__dirname, "../portal/app.js");
const swJsPath = path.join(__dirname, "../portal/sw.js");

// 1. Update portal/api.js
let apiContent = fs.readFileSync(apiJsPath, "utf8");
const apiCRLF = apiContent.includes("\r\n");
const apiEol = apiCRLF ? "\r\n" : "\n";

function safeReplaceInApi(target, replacement, desc) {
  const normTarget = target.replace(/\r?\n/g, apiEol);
  const normReplacement = replacement.replace(/\r?\n/g, apiEol);
  if (!apiContent.includes(normTarget)) {
    console.error("FAILED to find in api.js: " + desc);
    process.exit(1);
  }
  apiContent = apiContent.replace(normTarget, normReplacement);
  console.log("Updated api.js: " + desc);
}

safeReplaceInApi(
`    const gross = (parseFloat(baseSalary) || 0) + (parseFloat(allowances) || 0) + (parseFloat(bonus) || 0);
    const isCasual = (typeof contractType === "string" && contractType.trim().toLowerCase() === "casual");

    if (isCasual) {
      // Casual / Contract Staff:
      // Keeps base and allowances, does NOT deduct SSNIT or PAYE, but deducts 10% mandatory withholding tax.
      const withholdingTax = parseFloat((gross * 0.10).toFixed(2));
      const preNet = gross - withholdingTax;
      const netPay = parseFloat((preNet - (parseFloat(advance) || 0)).toFixed(2));
      return {
        gross: parseFloat(gross.toFixed(2)),
        ssnit: 0.00,
        paye: 0.00,
        withholdingTax: withholdingTax,
        withholding_tax: withholdingTax,
        isCasual: true,
        contractType: "casual",
        contract_type: "casual",
        netPay: netPay
      };
    }`,
`    const gross = (parseFloat(baseSalary) || 0) + (parseFloat(allowances) || 0) + (parseFloat(bonus) || 0);
    const normalizedType = typeof contractType === "string" ? contractType.trim().toLowerCase() : "";
    const isContract = (normalizedType === "contract" || normalizedType === "casual");

    if (isContract) {
      // Contract Staff:
      // Keeps base and allowances, does NOT deduct SSNIT or PAYE, but deducts 10% mandatory withholding tax.
      const withholdingTax = parseFloat((gross * 0.10).toFixed(2));
      const preNet = gross - withholdingTax;
      const netPay = parseFloat((preNet - (parseFloat(advance) || 0)).toFixed(2));
      return {
        gross: parseFloat(gross.toFixed(2)),
        ssnit: 0.00,
        paye: 0.00,
        withholdingTax: withholdingTax,
        withholding_tax: withholdingTax,
        isContract: true,
        isCasual: true,
        contractType: "contract",
        contract_type: "contract",
        netPay: netPay
      };
    }`,
"calculatePayroll support contract/casual"
);

safeReplaceInApi(
`    const currentContract = (prof && prof.contract_type) || user.contract_type || "permanent";
    const nextContract = currentContract === "casual" ? "permanent" : "casual";`,
`    const currentContract = (prof && prof.contract_type) || user.contract_type || "permanent";
    const isCurrentlyContract = (currentContract === "contract" || currentContract === "casual");
    const nextContract = isCurrentlyContract ? "permanent" : "contract";`,
"toggleStaffContractType support contract/casual"
);

fs.writeFileSync(apiJsPath, apiContent, "utf8");

// 2. Update portal/app.js
let appContent = fs.readFileSync(appJsPath, "utf8");
const appCRLF = appContent.includes("\r\n");
const appEol = appCRLF ? "\r\n" : "\n";

function safeReplaceInApp(target, replacement, desc) {
  const normTarget = target.replace(/\r?\n/g, appEol);
  const normReplacement = replacement.replace(/\r?\n/g, appEol);
  if (!appContent.includes(normTarget)) {
    console.error("FAILED to find in app.js: " + desc);
    console.error("Snippet:", normTarget.substring(0, 100));
    process.exit(1);
  }
  appContent = appContent.replace(normTarget, normReplacement);
  console.log("Updated app.js: " + desc);
}

// 1. Staff creation form option
safeReplaceInApp(
`                  <select id="staff-contract-type" class="form-control" style="background:var(--bg-primary); border-color:var(--border-color); color:var(--text-primary);">
                    <option value="permanent" selected>Permanent Staff (SSNIT 5.5% & PAYE)</option>
                    <option value="casual">Casual / Contract (10% Withholding Tax)</option>
                  </select>`,
`                  <select id="staff-contract-type" class="form-control" style="background:var(--bg-primary); border-color:var(--border-color); color:var(--text-primary);">
                    <option value="permanent" selected>Permanent Staff (SSNIT 5.5% & PAYE)</option>
                    <option value="contract">Contract (10% Withholding Tax)</option>
                  </select>`,
"Staff creation option"
);

// 2. Staff directory row rendering
safeReplaceInApp(
`        const isCasual = (u.contract_type === "casual" || (prof && prof.contract_type === "casual"));

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
              <button class="btn btn-secondary btn-toggle-staff-contract" data-id="\${u.user_id}" data-current="\${isCasual ? 'casual' : 'permanent'}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem;" title="Switch between Permanent and Casual contract">\${isCasual ? '⇄ Make Permanent' : '⇄ Make Casual'}</button>`,
`        const isContract = (u.contract_type === "contract" || u.contract_type === "casual" || (prof && (prof.contract_type === "contract" || prof.contract_type === "casual")));

        return \`
          <tr>
            <td><strong>\${u.uid}</strong></td>
            <td>\${formatFullName(u)}</td>
            <td>\${u.gender || 'Male'}</td>
            <td><span class="badge badge-info">\${u.role}</span></td>
            <td>
              <span class="badge" style="background:\${isContract ? '#d97706' : '#2563eb'}; color:#fff; font-size:0.75rem;">
                \${isContract ? 'Contract (10% WHT)' : 'Permanent'}
              </span>
            </td>
            <td>\${u.phone}</td>
            <td>\${section}</td>
            <td><span class="badge \${u.status === 'ACTIVE' ? 'badge-success' : u.status === 'PENDING_PASSWORD' ? 'badge-warning' : 'badge-danger'}">\${u.status}</span></td>
            <td>
              <button class="btn btn-secondary btn-toggle-staff-contract" data-id="\${u.user_id}" data-current="\${isContract ? 'contract' : 'permanent'}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem;" title="Switch between Permanent and Contract">\${isContract ? '⇄ Make Permanent' : '⇄ Make Contract'}</button>`,
"Staff directory row badge and button"
);

// 3. Staff directory toggle click event
safeReplaceInApp(
`        const current = btn.getAttribute("data-current") || "permanent";
        const target = current === "casual" ? "permanent" : "casual";
        const msg = target === "casual"
          ? \`Toggle \${formatFullName(user)} from Permanent to Casual contract?\\n\\n• Base salary & allowances will be kept intact\\n• SSNIT (5.5%) and PAYE will NOT be deducted (GH¢ 0.00)\\n• 10% Mandatory Withholding Tax will be deducted from payout.\`
          : \`Toggle \${formatFullName(user)} from Casual back to Permanent contract?\\n\\n• Standard SSNIT (5.5%) and graduated PAYE tax bands will apply.\`;`,
`        const current = btn.getAttribute("data-current") || "permanent";
        const isCurrentlyContract = (current === "contract" || current === "casual");
        const target = isCurrentlyContract ? "permanent" : "contract";
        const msg = target === "contract"
          ? \`Toggle \${formatFullName(user)} from Permanent to Contract?\\n\\n• Base salary & allowances will be kept intact\\n• SSNIT (5.5%) and PAYE will NOT be deducted (GH¢ 0.00)\\n• 10% Mandatory Withholding Tax will be deducted from payout.\`
          : \`Toggle \${formatFullName(user)} from Contract back to Permanent?\\n\\n• Standard SSNIT (5.5%) and graduated PAYE tax bands will apply.\`;`,
"Staff directory toggle click confirmation"
);

// 4. Staff CSV import
safeReplaceInApp(
`const contractTypeVal = (row.contract_type && row.contract_type.trim().toLowerCase() === "casual") ? "casual" : "permanent";`,
`const contractTypeVal = (row.contract_type && (row.contract_type.trim().toLowerCase() === "contract" || row.contract_type.trim().toLowerCase() === "casual")) ? "contract" : "permanent";`,
"Staff CSV bulk import"
);

// 5. Adjust salary modal option
safeReplaceInApp(
`                <select id="adj-contract-type" class="form-control" style="background:var(--bg-primary); border-color:var(--border-color); color:var(--text-primary);">
                  <option value="permanent">Permanent Staff (SSNIT 5.5% & PAYE)</option>
                  <option value="casual">Casual / Contract Staff (10% Withholding Tax, No SSNIT/PAYE)</option>
                </select>`,
`                <select id="adj-contract-type" class="form-control" style="background:var(--bg-primary); border-color:var(--border-color); color:var(--text-primary);">
                  <option value="permanent">Permanent Staff (SSNIT 5.5% & PAYE)</option>
                  <option value="contract">Contract Staff (10% Withholding Tax, No SSNIT/PAYE)</option>
                </select>`,
"Adjust salary modal option"
);

// 6. Active payroll processed rows
safeReplaceInApp(
`          const contractType = (matchingTx && matchingTx.contract_type) || profile.contract_type || member.contract_type || "permanent";
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
              </td>`,
`          const contractType = (matchingTx && matchingTx.contract_type) || profile.contract_type || member.contract_type || "permanent";
          const isContract = (contractType === "contract" || contractType === "casual");
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
                <span class="badge" style="background:\${isContract ? '#d97706' : '#2563eb'}; color:#fff; font-size:0.7rem;">
                  \${isContract ? 'Contract' : 'Permanent'}
                </span>
              </td>`,
"Active payroll processed rows"
);

// 6b. Active payroll processed rows deductions
safeReplaceInApp(
`              <td>\${isCasual ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${ssnitVal.toFixed(2)}\`}</td>
              <td>\${isCasual ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${payeVal.toFixed(2)}\`}</td>
              <td>\${isCasual ? \`<span style="color:#ef4444; font-weight:600;">GH¢ \${whtVal.toFixed(2)}</span>\` : '<span style="color:var(--text-muted);">-</span>'}</td>`,
`              <td>\${isContract ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${ssnitVal.toFixed(2)}\`}</td>
              <td>\${isContract ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${payeVal.toFixed(2)}\`}</td>
              <td>\${isContract ? \`<span style="color:#ef4444; font-weight:600;">GH¢ \${whtVal.toFixed(2)}</span>\` : '<span style="color:var(--text-muted);">-</span>'}</td>`,
"Active payroll processed rows deductions"
);

// 7. Active payroll unprocessed rows
safeReplaceInApp(
`          const contractType = adj.contract_type || profile.contract_type || member.contract_type || "permanent";
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
                <button class="btn btn-secondary btn-quick-toggle-contract" data-id="\${member.user_id}" data-current="\${isCasual ? 'casual' : 'permanent'}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem;" title="Switch between Permanent and Casual contract">\${isCasual ? '⇄ Perm' : '⇄ Casual'}</button>`,
`          const contractType = adj.contract_type || profile.contract_type || member.contract_type || "permanent";
          const isContract = (contractType === "contract" || contractType === "casual");
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
                <span class="badge" style="background:\${isContract ? '#d97706' : '#2563eb'}; color:#fff; font-size:0.7rem;">
                  \${isContract ? 'Contract' : 'Permanent'}
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
              <td>\${isContract ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${payroll.ssnit.toFixed(2)}\`}</td>
              <td>\${isContract ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${payroll.paye.toFixed(2)}\`}</td>
              <td>\${isContract ? \`<span style="color:#ef4444; font-weight:600;">GH¢ \${payroll.withholdingTax.toFixed(2)}</span>\` : '<span style="color:var(--text-muted);">-</span>'}</td>
              <td><strong style="color:var(--accent-success)">GH¢ \${payroll.netPay.toFixed(2)}</strong></td>
              <td>
                <button class="btn btn-secondary btn-quick-toggle-contract" data-id="\${member.user_id}" data-current="\${isContract ? 'contract' : 'permanent'}" style="min-height:28px; padding:0 0.5rem; font-size:0.75rem;" title="Switch between Permanent and Contract">\${isContract ? '⇄ Perm' : '⇄ Contract'}</button>`,
"Active payroll unprocessed rows"
);

// 8. Adjust salary modal populate
safeReplaceInApp(
`            const currentContract = adj.contract_type || profile.contract_type || "permanent";
            document.getElementById("adj-staff-id").value = staffId;
            document.getElementById("adj-staff-name").value = staffName;
            document.getElementById("adj-base-salary").value = (currentBase !== undefined && currentBase !== null) ? currentBase : "";
            document.getElementById("adj-allowance").value = (currentAllowance !== undefined && currentAllowance !== null) ? currentAllowance : "";
            if (document.getElementById("adj-contract-type")) {
              document.getElementById("adj-contract-type").value = currentContract === "casual" ? "casual" : "permanent";
            }`,
`            const currentContract = adj.contract_type || profile.contract_type || "permanent";
            document.getElementById("adj-staff-id").value = staffId;
            document.getElementById("adj-staff-name").value = staffName;
            document.getElementById("adj-base-salary").value = (currentBase !== undefined && currentBase !== null) ? currentBase : "";
            document.getElementById("adj-allowance").value = (currentAllowance !== undefined && currentAllowance !== null) ? currentAllowance : "";
            if (document.getElementById("adj-contract-type")) {
              document.getElementById("adj-contract-type").value = (currentContract === "contract" || currentContract === "casual") ? "contract" : "permanent";
            }`,
"Adjust salary modal populate"
);

// 9. Quick toggle contract directly from active payroll row
safeReplaceInApp(
`        rosterBody.querySelectorAll(".btn-quick-toggle-contract").forEach(btn => {
          btn.onclick = async () => {
            const staffId = btn.getAttribute("data-id");
            const current = btn.getAttribute("data-current") || "permanent";
            const target = current === "casual" ? "permanent" : "casual";
            const memberObj = staff.find(s => s.user_id === staffId);
            const name = memberObj ? formatFullName(memberObj) : "staff member";

            const msg = target === "casual"
              ? \`Toggle \${name} to Casual contract?\\n\\n• Base salary & allowances will be kept intact\\n• SSNIT (5.5%) and PAYE will NOT be deducted (GH¢ 0.00)\\n• 10% Mandatory Withholding Tax will be deducted from payout.\`
              : \`Toggle \${name} back to Permanent contract?\\n\\n• Standard SSNIT (5.5%) and graduated PAYE tax bands will apply.\`;`,
`        rosterBody.querySelectorAll(".btn-quick-toggle-contract").forEach(btn => {
          btn.onclick = async () => {
            const staffId = btn.getAttribute("data-id");
            const current = btn.getAttribute("data-current") || "permanent";
            const isCurrentlyContract = (current === "contract" || current === "casual");
            const target = isCurrentlyContract ? "permanent" : "contract";
            const memberObj = staff.find(s => s.user_id === staffId);
            const name = memberObj ? formatFullName(memberObj) : "staff member";

            const msg = target === "contract"
              ? \`Toggle \${name} to Contract?\\n\\n• Base salary & allowances will be kept intact\\n• SSNIT (5.5%) and PAYE will NOT be deducted (GH¢ 0.00)\\n• 10% Mandatory Withholding Tax will be deducted from payout.\`
              : \`Toggle \${name} back to Permanent?\\n\\n• Standard SSNIT (5.5%) and graduated PAYE tax bands will apply.\`;`,
"Quick toggle in active payroll row"
);

// 10. History table in renderPayrollEngine
safeReplaceInApp(
`        const contractType = (matchingTx && matchingTx.contract_type) || profile.contract_type || member.contract_type || "permanent";
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
            <td>\${isCasual ? \`<span style="color:#ef4444; font-weight:600;">GH¢ \${whtVal.toFixed(2)}</span>\` : '<span style="color:var(--text-muted);">-</span>'}</td>`,
`        const contractType = (matchingTx && matchingTx.contract_type) || profile.contract_type || member.contract_type || "permanent";
        const isContract = (contractType === "contract" || contractType === "casual");
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
              <span class="badge" style="background:\${isContract ? '#d97706' : '#2563eb'}; color:#fff; font-size:0.7rem;">
                \${isContract ? 'Contract' : 'Permanent'}
              </span>
            </td>
            <td>GH¢ \${profile.base_salary.toFixed(2)}</td>
            <td>GH¢ \${profile.allowances.toFixed(2)}</td>
            <td><strong>GH¢ \${(matchingTx && matchingTx.gross ? matchingTx.gross : basePayroll.gross).toFixed(2)}</strong></td>
            <td>\${isContract ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${ssnitVal.toFixed(2)}\`}</td>
            <td>\${isContract ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${payeVal.toFixed(2)}\`}</td>
            <td>\${isContract ? \`<span style="color:#ef4444; font-weight:600;">GH¢ \${whtVal.toFixed(2)}</span>\` : '<span style="color:var(--text-muted);">-</span>'}</td>`,
"History table in renderPayrollEngine"
);

// 11. Payslip in renderPayrollEngine
safeReplaceInApp(
`      const contractType = adj.contract_type || profile.contract_type || (member && member.contract_type) || "permanent";
      const isCasual = (contractType === "casual");`,
`      const contractType = adj.contract_type || profile.contract_type || (member && member.contract_type) || "permanent";
      const isContract = (contractType === "contract" || contractType === "casual");`,
"Payslip in renderPayrollEngine isContract check"
);

safeReplaceInApp(
`<div><strong>Contract Option:</strong> <span class="badge" style="background:\${isCasual ? '#d97706' : '#2563eb'}; color:#fff; font-size:0.75rem;">\${isCasual ? 'Casual / Contract (10% WHT)' : 'Permanent Staff'}</span></div>`,
`<div><strong>Contract Option:</strong> <span class="badge" style="background:\${isContract ? '#d97706' : '#2563eb'}; color:#fff; font-size:0.75rem;">\${isContract ? 'Contract (10% WHT)' : 'Permanent Staff'}</span></div>`,
"Payslip header in renderPayrollEngine"
);

safeReplaceInApp(
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
`            \${isContract ? \`
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
              <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${(isContract ? (payroll.withholdingTax + adj.advance) : (payroll.ssnit + payroll.paye + adj.advance)).toFixed(2)}</td>
            </tr>`,
"Payslip breakdown in renderPayrollEngine"
);

// 12. Batch processing record
safeReplaceInApp(
`billing_description: \`Staff Payroll (\${payroll.isCasual ? 'Casual' : 'Permanent'}): \${activeMonthLabel}\`,`,
`billing_description: \`Staff Payroll (\${payroll.isContract ? 'Contract' : 'Permanent'}): \${activeMonthLabel}\`,`,
"Batch processing billing_description"
);

// 13. Proprietor payroll history
safeReplaceInApp(
`        const contractType = (matchingTx && matchingTx.contract_type) || profile.contract_type || member.contract_type || "permanent";
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
            <td>\${isCasual ? \`<span style="color:#ef4444; font-weight:600;">GH¢ \${whtVal.toFixed(2)}</span>\` : '<span style="color:var(--text-muted);">-</span>'}</td>`,
`        const contractType = (matchingTx && matchingTx.contract_type) || profile.contract_type || member.contract_type || "permanent";
        const isContract = (contractType === "contract" || contractType === "casual");
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
              <span class="badge" style="background:\${isContract ? '#d97706' : '#2563eb'}; color:#fff; font-size:0.7rem;">
                \${isContract ? 'Contract' : 'Permanent'}
              </span>
            </td>
            <td>GH¢ \${profile.base_salary.toFixed(2)}</td>
            <td>GH¢ \${profile.allowances.toFixed(2)}</td>
            <td><strong>GH¢ \${(matchingTx && matchingTx.gross ? matchingTx.gross : basePayroll.gross).toFixed(2)}</strong></td>
            <td>\${isContract ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${ssnitVal.toFixed(2)}\`}</td>
            <td>\${isContract ? '<span style="color:var(--text-muted);">0.00</span>' : \`GH¢ \${payeVal.toFixed(2)}\`}</td>
            <td>\${isContract ? \`<span style="color:#ef4444; font-weight:600;">GH¢ \${whtVal.toFixed(2)}</span>\` : '<span style="color:var(--text-muted);">-</span>'}</td>`,
"Proprietor payroll history table"
);

// 14. Proprietor showPayslipModal
safeReplaceInApp(
`      const contractType = (window.payrollAdjustments && window.payrollAdjustments[userId] && window.payrollAdjustments[userId].contract_type) || profile.contract_type || (member && member.contract_type) || "permanent";
      const isCasual = (contractType === "casual");`,
`      const contractType = (window.payrollAdjustments && window.payrollAdjustments[userId] && window.payrollAdjustments[userId].contract_type) || profile.contract_type || (member && member.contract_type) || "permanent";
      const isContract = (contractType === "contract" || contractType === "casual");`,
"Proprietor showPayslipModal isContract check"
);

safeReplaceInApp(
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
`            \${isContract ? \`
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
              <td style="padding:0.5rem; text-align:right; color:#ef4444;">GH¢ \${(isContract ? (payroll.withholdingTax + adj.advance) : (payroll.ssnit + payroll.paye + adj.advance)).toFixed(2)}</td>
            </tr>`,
"Proprietor showPayslipModal breakdown"
);

// 15. renderTeacherPayslips
safeReplaceInApp(
`    const contractType = profile.contract_type || (activeUser && activeUser.contract_type) || "permanent";
    const isCasual = (contractType === "casual");`,
`    const contractType = profile.contract_type || (activeUser && activeUser.contract_type) || "permanent";
    const isContract = (contractType === "contract" || contractType === "casual");`,
"renderTeacherPayslips isContract check"
);

safeReplaceInApp(
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
`              \${isContract ? \`
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
"renderTeacherPayslips breakdown"
);

// 16. Records management edit record modal option
safeReplaceInApp(
`                <div class="form-group">
                  <label class="form-label">Contract / Employment Option</label>
                  <select id="edit-rec-staff-contract-type" class="form-control" style="background:var(--bg-primary); border-color:var(--border-color); color:var(--text-primary);">
                    <option value="permanent">Permanent (SSNIT & PAYE)</option>
                    <option value="casual">Casual (10% Withholding Tax)</option>
                  </select>
                </div>`,
`                <div class="form-group">
                  <label class="form-label">Contract / Employment Option</label>
                  <select id="edit-rec-staff-contract-type" class="form-control" style="background:var(--bg-primary); border-color:var(--border-color); color:var(--text-primary);">
                    <option value="permanent">Permanent (SSNIT & PAYE)</option>
                    <option value="contract">Contract (10% Withholding Tax)</option>
                  </select>
                </div>`,
"Records management edit record modal option"
);

// 17. Records management profile right panel
safeReplaceInApp(
`        const contractType = p.contract_type || u.contract_type || "permanent";
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
`        const contractType = p.contract_type || u.contract_type || "permanent";
        const isContract = (contractType === "contract" || contractType === "casual");
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
                <span class="badge" style="background:\${isContract ? '#d97706' : '#2563eb'}; color:#fff; font-size:0.75rem;">
                  \${isContract ? 'Contract (10% Withholding Tax)' : 'Permanent Staff (SSNIT/PAYE)'}
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
            \${isContract ? \`
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
"Records management profile right panel"
);

// 18. openAdminEditRecordModal populate contract_type
safeReplaceInApp(
`        if (document.getElementById("edit-rec-staff-contract-type")) {
          document.getElementById("edit-rec-staff-contract-type").value = (p.contract_type || u.contract_type || "permanent") === "casual" ? "casual" : "permanent";
        }`,
`        if (document.getElementById("edit-rec-staff-contract-type")) {
          const cType = p.contract_type || u.contract_type || "permanent";
          document.getElementById("edit-rec-staff-contract-type").value = (cType === "contract" || cType === "casual") ? "contract" : "permanent";
        }`,
"openAdminEditRecordModal populate"
);

// 19. showPayslipModalForSelf
safeReplaceInApp(
`  const contractType = profile.contract_type || (member && member.contract_type) || "permanent";
  const isCasual = (contractType === "casual");`,
`  const contractType = profile.contract_type || (member && member.contract_type) || "permanent";
  const isContract = (contractType === "contract" || contractType === "casual");`,
"showPayslipModalForSelf isContract check"
);

safeReplaceInApp(
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
`        \${isContract ? \`
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
"showPayslipModalForSelf breakdown"
);

fs.writeFileSync(appJsPath, appContent, "utf8");

// 3. Bump sw.js to v81
let swContent = fs.readFileSync(swJsPath, "utf8");
swContent = swContent.replace('CACHE_NAME = "school-mgt-v80"', 'CACHE_NAME = "school-mgt-v81"');
fs.writeFileSync(swJsPath, swContent, "utf8");

console.log("\nALL WORDING UPDATED SUCCESSFULLY & BUMPED SW TO v81!");
