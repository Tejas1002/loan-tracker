// Dashboard, EMI tracker, history, reports rendering
const Dashboard = (() => {
  let charts = {};

  const computeLoanStats = (loan) => {
    const payments = Storage.paymentsFor(loan.id);
    const paidCount = payments.length;
    const pendingCount = Math.max(0, loan.tenure - paidCount);
    const paidAmount = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalPayable = loan.emi * loan.tenure;
    const remaining = Math.max(0, totalPayable - paidAmount);
    const progress = totalPayable ? (paidAmount / totalPayable) * 100 : 0;
    return { paidCount, pendingCount, paidAmount, totalPayable, remaining, progress };
  };

  const animateCounter = (el, target, isCurrency) => {
    const start = 0;
    const dur = 900;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = start + (target - start) * eased;
      el.textContent = isCurrency ? fmt(val) : Math.round(val).toLocaleString('en-IN');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const renderDashboard = () => {
    const loans = Storage.getLoans();
    let totalAmount = 0, totalPaid = 0, totalEmiPaid = 0, totalEmiPending = 0, totalPayable = 0;
    loans.forEach(l => {
      const s = computeLoanStats(l);
      totalAmount += Number(l.amount || 0);
      totalPaid += s.paidAmount;
      totalPayable += s.totalPayable;
      totalEmiPaid += s.paidCount;
      totalEmiPending += s.pendingCount;
    });
    const remaining = Math.max(0, totalPayable - totalPaid);

    animateCounter(document.getElementById('stTotalLoans'), loans.length, false);
    animateCounter(document.getElementById('stTotalAmount'), totalAmount, true);
    animateCounter(document.getElementById('stTotalPaid'), totalPaid, true);
    animateCounter(document.getElementById('stRemaining'), remaining, true);
    animateCounter(document.getElementById('stEmiPaid'), totalEmiPaid, false);
    animateCounter(document.getElementById('stEmiPending'), totalEmiPending, false);

    const paidPct = totalPayable ? (totalPaid / totalPayable) * 100 : 0;
    document.getElementById('barPaid').style.width = paidPct + '%';
    document.getElementById('barRemaining').style.width = (100 - paidPct) + '%';

    const c = 2 * Math.PI * 52;
    document.getElementById('circleFill').style.strokeDashoffset = c - (c * paidPct / 100);
    document.getElementById('circleLabel').textContent = Math.round(paidPct) + '%';
    document.getElementById('portfolioPct').textContent = Math.round(paidPct) + '% complete';

    const recent = document.getElementById('recentLoans');
    const last = [...loans].reverse().slice(0, 5);
    if (!last.length) {
      recent.innerHTML = '<p class="muted" style="padding:20px;text-align:center">No loans yet. Add one to get started.</p>';
    } else {
      recent.innerHTML = last.map(l => {
        const s = computeLoanStats(l);
        return `<div class="recent-item" data-detail="${l.id}">
          <div class="recent-ico">${(l.name||'?').charAt(0).toUpperCase()}</div>
          <div class="recent-meta"><strong>${escapeHtml(l.name)}</strong><small>${escapeHtml(l.bank)} • ${escapeHtml(l.type)}</small></div>
          <div class="recent-amt">${fmt(s.remaining)}</div>
        </div>`;
      }).join('');
    }
  };

  const renderEmiTracker = () => {
    const loans = Storage.getLoans();
    const wrap = document.getElementById('emiCards');
    const empty = document.getElementById('emiEmpty');
    if (!loans.length) { wrap.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;
    wrap.innerHTML = loans.map(l => {
      const s = computeLoanStats(l);
      const pct = Math.round(s.progress);
      const completed = s.pendingCount === 0;
      return `<div class="emi-card glass">
        <div class="emi-card-head">
          <div><strong>${escapeHtml(l.name)}</strong><div class="muted" style="font-size:12px;margin-top:2px">${escapeHtml(l.bank)}</div></div>
          ${completed ? '<span class="completion">★ Completed</span>' : '<span class="badge active">Active</span>'}
        </div>
        <div class="emi-meta">
          <div>Total<b>${l.tenure}</b></div>
          <div>Paid<b>${s.paidCount}</b></div>
          <div>Pending<b>${s.pendingCount}</b></div>
          <div>EMI<b>${fmt(l.emi)}</b></div>
        </div>
        <div class="bar"><span style="width:${pct}%"></span></div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="muted" style="font-size:12px">${pct}% paid</span>
          ${completed ? '' : `<button class="btn btn-primary" data-pay="${l.id}">Mark EMI Paid</button>`}
        </div>
      </div>`;
    }).join('');
  };

  const renderHistory = () => {
    const payments = [...Storage.getPayments()].sort((a,b) => new Date(b.date) - new Date(a.date));
    const wrap = document.getElementById('timeline');
    const empty = document.getElementById('historyEmpty');
    if (!payments.length) { wrap.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;
    const loansById = Object.fromEntries(Storage.getLoans().map(l => [l.id, l]));
    wrap.innerHTML = payments.map(p => {
      const loan = loansById[p.loanId];
      return `<div class="tl-item">
        <div class="tl-dot">#${p.emiNumber}</div>
        <div class="tl-body"><strong>${escapeHtml(loan?.name || 'Loan')}</strong><small>${fmtDate(p.date)} • EMI #${p.emiNumber}</small></div>
        <div style="text-align:right"><strong>${fmt(p.amount)}</strong><div><span class="badge active">Paid</span></div></div>
      </div>`;
    }).join('');
  };

  const renderReports = () => {
    const loans = Storage.getLoans();
    let borrowed=0, paid=0, payable=0, interest=0;
    loans.forEach(l => {
      const s = computeLoanStats(l);
      borrowed += Number(l.amount||0);
      paid += s.paidAmount;
      payable += s.totalPayable;
      interest += Math.max(0, s.totalPayable - Number(l.amount||0));
    });
    document.getElementById('rpBorrowed').textContent = fmt(borrowed);
    document.getElementById('rpPaid').textContent = fmt(paid);
    document.getElementById('rpRemaining').textContent = fmt(Math.max(0, payable - paid));

    const isDark = document.documentElement.dataset.theme === 'dark';
    const tickColor = isDark ? '#cbd5e1' : '#475569';
    Chart.defaults.color = tickColor;
    Chart.defaults.borderColor = isDark ? 'rgba(255,255,255,.08)' : 'rgba(15,23,42,.08)';

    const ctx1 = document.getElementById('chartProgress');
    charts.progress?.destroy();
    charts.progress = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: loans.map(l => l.name),
        datasets: [
          { label: 'Paid', data: loans.map(l => computeLoanStats(l).paidAmount), backgroundColor: '#2563eb', borderRadius: 6 },
          { label: 'Remaining', data: loans.map(l => computeLoanStats(l).remaining), backgroundColor: '#06b6d4', borderRadius: 6 },
        ],
      },
      options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true } } },
    });

    const months = {};
    Storage.getPayments().forEach(p => {
      const k = new Date(p.date).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      months[k] = (months[k] || 0) + Number(p.amount || 0);
    });
    const ctx2 = document.getElementById('chartPayments');
    charts.pay?.destroy();
    charts.pay = new Chart(ctx2, {
      type: 'line',
      data: { labels: Object.keys(months), datasets: [{ label:'Payments', data: Object.values(months), borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,.15)', tension:.4, fill:true, pointRadius:4 }] },
      options: { responsive: true },
    });

    const ctx3 = document.getElementById('chartIvP');
    charts.ivp?.destroy();
    charts.ivp = new Chart(ctx3, {
      type: 'doughnut',
      data: { labels:['Principal','Interest'], datasets:[{ data:[borrowed, interest], backgroundColor:['#2563eb','#06b6d4'], borderWidth:0 }] },
      options: { responsive: true, cutout: '65%' },
    });
  };

  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  return { renderDashboard, renderEmiTracker, renderHistory, renderReports, computeLoanStats, escapeHtml };
})();