// LocalStorage layer
const Storage = (() => {
  const KEYS = { loans: 'll_loans', payments: 'll_payments', theme: 'll_theme' };

  const read = (k, fallback) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  return {
    getLoans: () => read(KEYS.loans, []),
    saveLoans: (arr) => write(KEYS.loans, arr),
    getPayments: () => read(KEYS.payments, []),
    savePayments: (arr) => write(KEYS.payments, arr),
    getTheme: () => localStorage.getItem(KEYS.theme) || 'light',
    setTheme: (t) => localStorage.setItem(KEYS.theme, t),

    addLoan(loan) {
      const loans = this.getLoans();
      loan.id = loan.id || ('L' + Date.now() + Math.floor(Math.random() * 999));
      loan.createdAt = loan.createdAt || new Date().toISOString();
      loans.push(loan);
      this.saveLoans(loans);
      return loan;
    },
    updateLoan(id, patch) {
      const loans = this.getLoans().map(l => l.id === id ? { ...l, ...patch } : l);
      this.saveLoans(loans);
    },
    deleteLoan(id) {
      this.saveLoans(this.getLoans().filter(l => l.id !== id));
      this.savePayments(this.getPayments().filter(p => p.loanId !== id));
    },
    addPayment(payment) {
      const arr = this.getPayments();
      payment.id = 'P' + Date.now() + Math.floor(Math.random() * 999);
      payment.date = payment.date || new Date().toISOString();
      arr.push(payment);
      this.savePayments(arr);
      return payment;
    },
    paymentsFor(loanId) {
      return this.getPayments().filter(p => p.loanId === loanId).sort((a,b) => new Date(a.date) - new Date(b.date));
    },
  };
})();