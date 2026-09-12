import { DashboardShell } from "@/components/dashboard-shell";
import { FinanceActions } from "@/components/finance-actions";

export default function FinancePage() {
  return (
    <DashboardShell>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Finanze</p>
          <h1 className="text-3xl font-semibold">Panoramica finanziaria</h1>
        </div>
      </header>
      <FinanceActions />
    </DashboardShell>
  );
}
