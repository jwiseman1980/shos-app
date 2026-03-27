import FinanceNav from "@/components/FinanceNav";

export default function FinanceLayout({ children }) {
  return (
    <div className="page-shell">
      <div className="page-header">
        <h1>Finance</h1>
        <p className="page-subtitle">Monthly financial operations, reporting &amp; obligation tracking</p>
      </div>
      <FinanceNav />
      {children}
    </div>
  );
}
