// App orchestration
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const esc = Dashboard.escapeHtml;

  // Theme
  const applyTheme = (t) => {
    document.documentElement.dataset.theme = t;
    Storage.setTheme(t);
    $('#themeToggle').textContent = t === 'dark' ? '☀️' : '🌙';
  };
  applyTheme(Storage.getTheme());
  $('#themeToggle').addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    if (currentView === 'reports') Dashboard.renderReports();
    if (currentView === 'calculator') runCalc();
  });

  // Floating labels: add placeholder=' ' to all field inputs
  $$('.field input, .field textarea').forEach(el => { if (!el.placeholder) el.placeholder = ' '; });
  $$('.field select').forEach(el => { el.addEventListener('change', () => updateLabel(el)); updateLabel(el); });
  function updateLabel(el){
    const lbl = el.parentElement.querySelector('label');
    if (!lbl) return;
    if (el.value && el.value !== '') lbl.classList.add('filled'); else lbl.classList.remove('filled');
  }

  // Navigation
  let currentView = 'dashboard';
  const setView = (v) => {
    currentView = v;
    $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    $('#sidebar').classList.remove('open');
    if (v === 'dashboard') Dashboard.renderDashboard();
    if (v === 'loans') renderLoansTable();
    if (v === 'emi') Dashboard.renderEmiTracker();
    if (v === 'history') Dashboard.renderHistory();
    if (v === 'reports') Dashboard.renderReports();
    if (v === 'calculator') runCalc();
    if (v === 'add') resetForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  $$('.nav-item').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  document.addEventListener('click', e => {
    const go = e.target.closest('[data-go]');
    if (go) setView(go.dataset.go);
  });

  $('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  // Toast
  const toast = (msg, type='success') => {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ'}</span><span>${esc(msg)}</span>`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.animation = 'slideIn .3s reverse'; setTimeout(() => el.remove(), 280); }, 2800);
  };

  // Confirm modal
  const confirmDialog = (title, text) => new Promise(resolve => {
    $('#confirmTitle').textContent = title;
    $('#confirmText').textContent = text;
    const modal = $('#confirmModal');
    modal.hidden = false;
    const ok = $('#confirmOk');
    const cleanup = (v) => { modal.hidden = true; ok.onclick = null; resolve(v); };
    ok.onclick = () => cleanup(true);
    modal.querySelectorAll('[data-close]').forEach(b => b.onclick = () => cleanup(false));
  });
  document.addEventListener('click', e => {
    if (e.target.matches('.modal')) e.target.hidden = true;
    if (e.target.matches('[data-close]')) e.target.closest('.modal').hidden = true;
  });

  // Loan form
  const form = $('#loanForm');
  const auto = () => {
    const amt = +$('#f_amount').value, rate = +$('#f_rate').value, ten = +$('#f_tenure').value;
    if (amt && rate >= 0 && ten) {
      const emi = Calculator.emi(amt, rate, ten);
      $('#f_emi').value = Math.round(emi);
      updateLabel($('#f_emi'));
    }
  };
  ['f_amount','f_rate','f_tenure'].forEach(id => $('#' + id).addEventListener('input', auto));
  $$('#loanForm input, #loanForm textarea, #loanForm select').forEach(el => el.addEventListener('input', () => { updateLabel(el); el.classList.remove('invalid'); }));

  function resetForm(loan){
    form.reset();
    $('#loanId').value = loan?.id || '';
    $('#addTitle').textContent = loan ? 'Edit Loan' : 'Add Loan';
    $('#saveBtn').textContent = loan ? 'Update Loan' : 'Save Loan';
    if (loan) {
      $('#f_name').value = loan.name; $('#f_type').value = loan.type;
      $('#f_bank').value = loan.bank; $('#f_amount').value = loan.amount;
      $('#f_rate').value = loan.rate; $('#f_tenure').value = loan.tenure;
      $('#f_emi').value = Math.round(loan.emi); $('#f_start').value = loan.start || '';
      $('#f_due').value = loan.dueDay || ''; $('#f_notes').value = loan.notes || '';
    }
    $$('#loanForm input, #loanForm textarea, #loanForm select').forEach(el => updateLabel(el));
  }

  $('#resetBtn').addEventListener('click', () => resetForm());

  form.addEventListener('submit', e => {
    e.preventDefault();
    const required = ['f_name','f_type','f_bank','f_amount','f_rate','f_tenure','f_start'];
    let ok = true;
    required.forEach(id => { const el = $('#' + id); if (!el.value) { el.classList.add('invalid'); ok = false; } });
    if (!ok) { toast('Please fill all required fields', 'error'); return; }
    const data = {
      name: $('#f_name').value.trim(),
      type: $('#f_type').value,
      bank: $('#f_bank').value.trim(),
      amount: +$('#f_amount').value,
      rate: +$('#f_rate').value,
      tenure: +$('#f_tenure').value,
      emi: +$('#f_emi').value || Calculator.emi(+$('#f_amount').value, +$('#f_rate').value, +$('#f_tenure').value),
      start: $('#f_start').value,
      dueDay: +$('#f_due').value || null,
      notes: $('#f_notes').value.trim(),
    };
    const id = $('#loanId').value;
    if (id) { Storage.updateLoan(id, data); toast('Loan updated'); }
    else { Storage.addLoan(data); toast('Loan added successfully'); }
    setView('loans');
  });

  // Loans table
  function renderLoansTable(){
    let loans = Storage.getLoans();
    const q = ($('#globalSearch').value || '').toLowerCase().trim();
    const status = $('#filterStatus').value;
    const sort = $('#sortBy').value;
    let rows = loans.map(l => ({ loan: l, stats: Dashboard.computeLoanStats(l) }));
    if (q) rows = rows.filter(r => [r.loan.name, r.loan.bank, r.loan.type].some(x => (x||'').toLowerCase().includes(q)));
    if (status === 'Active') rows = rows.filter(r => r.stats.pendingCount > 0);
    if (status === 'Completed') rows = rows.filter(r => r.stats.pendingCount === 0);
    if (sort === 'amount') rows.sort((a,b) => b.loan.amount - a.loan.amount);
    if (sort === 'remaining') rows.sort((a,b) => b.stats.remaining - a.stats.remaining);
    if (sort === 'name') rows.sort((a,b) => a.loan.name.localeCompare(b.loan.name));
    if (sort === 'recent') rows.sort((a,b) => new Date(b.loan.createdAt) - new Date(a.loan.createdAt));

    const tbody = $('#loansTable tbody');
    const empty = $('#loansEmpty');
    if (!rows.length) { tbody.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;
    tbody.innerHTML = rows.map(({loan, stats}) => `
      <tr>
        <td><strong>${esc(loan.name)}</strong><div class="muted" style="font-size:12px">${esc(loan.type)}</div></td>
        <td>${esc(loan.bank)}</td>
        <td>${fmt(loan.amount)}</td>
        <td>${fmt(loan.emi)}</td>
        <td>${stats.paidCount}</td>
        <td>${stats.pendingCount}</td>
        <td>${fmt(stats.remaining)}</td>
        <td>${stats.pendingCount === 0 ? '<span class="badge completed">Completed</span>' : '<span class="badge active">Active</span>'}</td>
        <td style="white-space:nowrap;text-align:right">
          <button class="row-btn" data-view-loan="${loan.id}" title="View">👁</button>
          <button class="row-btn" data-edit="${loan.id}" title="Edit">✎</button>
          <button class="row-btn" data-delete="${loan.id}" title="Delete">🗑</button>
        </td>
      </tr>`).join('');
  }
  ['filterStatus','sortBy','globalSearch'].forEach(id => $('#' + id).addEventListener('input', () => {
    if (currentView === 'loans') renderLoansTable();
  }));

  // Table actions
  document.addEventListener('click', async e => {
    const view = e.target.closest('[data-view-loan]') || e.target.closest('[data-detail]');
    if (view) { showDetails(view.dataset.viewLoan || view.dataset.detail); return; }
    const edit = e.target.closest('[data-edit]');
    if (edit) { const loan = Storage.getLoans().find(l => l.id === edit.dataset.edit); if (loan) { resetForm(loan); setView('add'); } return; }
    const del = e.target.closest('[data-delete]');
    if (del) {
      const ok = await confirmDialog('Delete loan?', 'This will remove the loan and its payment history.');
      if (ok) { Storage.deleteLoan(del.dataset.delete); toast('Loan deleted', 'info'); renderLoansTable(); }
      return;
    }
    const pay = e.target.closest('[data-pay]');
    if (pay) {
      const loan = Storage.getLoans().find(l => l.id === pay.dataset.pay);
      if (!loan) return;
      const s = Dashboard.computeLoanStats(loan);
      Storage.addPayment({ loanId: loan.id, amount: loan.emi, emiNumber: s.paidCount + 1 });
      toast('EMI marked as paid');
      Dashboard.renderEmiTracker();
      Dashboard.renderDashboard();
    }
  });

  // Details modal
  function showDetails(id){
    const loan = Storage.getLoans().find(l => l.id === id);
    if (!loan) return;
    const s = Dashboard.computeLoanStats(loan);
    const pct = Math.round(s.progress);
    const interest = Math.max(0, s.totalPayable - Number(loan.amount));
    const payments = Storage.paymentsFor(loan.id);
    $('#detailsBody').innerHTML = `
      <div class="detail-head">
        <div class="recent-ico" style="width:48px;height:48px;font-size:18px">${esc(loan.name.charAt(0).toUpperCase())}</div>
        <div><h2 style="font-size:22px">${esc(loan.name)}</h2><div class="muted">${esc(loan.bank)} • ${esc(loan.type)}</div></div>
        ${s.pendingCount === 0 ? '<span class="completion" style="margin-left:auto">★ Completed</span>' : ''}
      </div>
      <div class="detail-grid">
        <div class="result"><span>Loan Amount</span><strong>${fmt(loan.amount)}</strong></div>
        <div class="result"><span>Interest Rate</span><strong>${loan.rate}%</strong></div>
        <div class="result"><span>Tenure</span><strong>${loan.tenure} mo</strong></div>
        <div class="result"><span>EMI</span><strong>${fmt(loan.emi)}</strong></div>
        <div class="result"><span>Paid</span><strong>${fmt(s.paidAmount)}</strong></div>
        <div class="result"><span>Remaining</span><strong>${fmt(s.remaining)}</strong></div>
        <div class="result"><span>Total Interest</span><strong>${fmt(interest)}</strong></div>
        <div class="result"><span>Start Date</span><strong style="font-size:14px">${loan.start ? fmtDate(loan.start) : '—'}</strong></div>
      </div>
      <div style="margin:14px 0"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><strong>Payment Progress</strong><span class="muted">${pct}%</span></div><div class="bar"><span style="width:${pct}%"></span></div></div>
      <h3 style="margin-top:18px;margin-bottom:10px">EMI Timeline</h3>
      ${payments.length ? `<div class="timeline">${payments.map(p => `<div class="tl-item"><div class="tl-dot">#${p.emiNumber}</div><div class="tl-body"><strong>EMI #${p.emiNumber}</strong><small>${fmtDate(p.date)}</small></div><strong>${fmt(p.amount)}</strong></div>`).join('')}</div>` : '<p class="muted">No payments recorded yet.</p>'}
      ${loan.notes ? `<div style="margin-top:14px"><strong>Notes</strong><p class="muted" style="margin-top:4px">${esc(loan.notes)}</p></div>` : ''}
    `;
    $('#detailsModal').hidden = false;
  }

  // Calculator
  function runCalc(){
    const amt = +$('#c_amount').value, rate = +$('#c_rate').value, ten = +$('#c_tenure').value;
    const { emi, total, interest } = Calculator.totals(amt, rate, ten);
    $('#r_emi').textContent = fmt(emi);
    $('#r_int').textContent = fmt(interest);
    $('#r_total').textContent = fmt(total);
    if (window._calcChart) window._calcChart.destroy();
    const isDark = document.documentElement.dataset.theme === 'dark';
    Chart.defaults.color = isDark ? '#cbd5e1' : '#475569';
    window._calcChart = new Chart($('#calcChart'), {
      type: 'doughnut',
      data: { labels:['Principal','Interest'], datasets:[{ data:[amt, interest], backgroundColor:['#2563eb','#06b6d4'], borderWidth:0 }] },
      options: { cutout:'65%', plugins:{ legend:{ position:'bottom' } } },
    });
  }
  $('#calcForm').addEventListener('submit', e => { e.preventDefault(); runCalc(); });

  // Exports
  $('#exportPdf').addEventListener('click', () => {
    const loans = Storage.getLoans();
    if (!loans.length) return toast('No loans to export', 'error');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('LoanLedger - Loan Report', 14, 18);
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(new Date().toLocaleString(), 14, 25);
    const rows = loans.map(l => {
      const s = Dashboard.computeLoanStats(l);
      return [l.name, l.bank, l.type, l.amount, Math.round(l.emi), s.paidCount, s.pendingCount, Math.round(s.remaining)];
    });
    doc.autoTable({ head:[['Name','Bank','Type','Amount','EMI','Paid','Pending','Remaining']], body: rows, startY: 32, styles:{ fontSize: 9 }, headStyles:{ fillColor:[37,99,235] } });
    doc.save('loanledger-report.pdf');
    toast('PDF exported');
  });
  $('#exportXlsx').addEventListener('click', () => {
    const loans = Storage.getLoans();
    if (!loans.length) return toast('No loans to export', 'error');
    const data = loans.map(l => {
      const s = Dashboard.computeLoanStats(l);
      return { Name:l.name, Bank:l.bank, Type:l.type, Amount:l.amount, Rate:l.rate, Tenure:l.tenure, EMI: Math.round(l.emi), Paid:s.paidCount, Pending:s.pendingCount, Remaining: Math.round(s.remaining) };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Loans');
    XLSX.writeFile(wb, 'loanledger-report.xlsx');
    toast('Excel exported');
  });

  // Due alert on load
  const checkDue = () => {
    const today = new Date().getDate();
    const due = Storage.getLoans().filter(l => l.dueDay && Math.abs(l.dueDay - today) <= 2 && Dashboard.computeLoanStats(l).pendingCount > 0);
    if (due.length) setTimeout(() => toast(`${due.length} EMI${due.length>1?'s':''} due soon`, 'info'), 800);
  };

  // Seed sample data on first visit (so empty states aren't the first impression)
  if (!Storage.getLoans().length && !localStorage.getItem('ll_seen')) {
    localStorage.setItem('ll_seen', '1');
    const samples = [
      { name:'Home Loan', type:'Home Loan', bank:'HDFC Bank', amount:2500000, rate:8.5, tenure:240, start:'2023-06-01', dueDay:5, notes:'Primary residence' },
      { name:'Car Loan', type:'Car Loan', bank:'ICICI Bank', amount:800000, rate:9.2, tenure:60, start:'2024-03-15', dueDay:10, notes:'' },
    ];
    samples.forEach(s => Storage.addLoan({ ...s, emi: Calculator.emi(s.amount, s.rate, s.tenure) }));
    const loans = Storage.getLoans();
    [3, 1].forEach((cnt, i) => {
      for (let n=1; n<=cnt; n++) Storage.addPayment({ loanId: loans[i].id, amount: loans[i].emi, emiNumber: n, date: new Date(Date.now() - (cnt-n)*30*86400000).toISOString() });
    });
  }

  // Init
  setView('dashboard');
  checkDue();
})();