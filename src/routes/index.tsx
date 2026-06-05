import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LoanLedger — Premium Loan Tracker & EMI Calculator" },
      { name: "description", content: "Track loans, calculate EMIs, monitor payments and progress with a premium fintech dashboard." },
      { property: "og:title", content: "LoanLedger — Loan Tracker & EMI Calculator" },
      { property: "og:description", content: "Premium loan & EMI tracking dashboard." },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    window.location.replace("/app.html");
  }, []);
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b1220", color: "#fff", fontFamily: "system-ui" }}>
      Loading LoanLedger…
    </div>
  );
}
