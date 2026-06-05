// EMI math helpers
const Calculator = {
  emi(principal, annualRate, months) {
    const P = Number(principal);
    const N = Number(months);
    const R = Number(annualRate) / 12 / 100;
    if (!P || !N) return 0;
    if (R === 0) return P / N;
    const x = Math.pow(1 + R, N);
    return (P * R * x) / (x - 1);
  },
  totals(principal, annualRate, months) {
    const emi = this.emi(principal, annualRate, months);
    const total = emi * months;
    const interest = total - Number(principal);
    return { emi, total, interest };
  },
};

const fmt = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });