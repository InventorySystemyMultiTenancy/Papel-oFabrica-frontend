import { Link } from "react-router-dom";
import { DashboardLayout, EmbeddedContext } from "@/layouts/DashboardLayout";
import AccountsPayablePage from "./AccountsPayable";

export default function FinancialHub() {
  return (
    <DashboardLayout title="Financeiro" subtitle="Contas a Pagar">
      <div className="space-y-4">
        <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 via-white to-blue-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-500">
                Financeiro Principal
              </p>
              <h2 className="text-2xl font-bold text-slate-900">
                Contas a pagar
              </h2>
              <p className="text-sm text-slate-600">
                Acesse rapidamente as contas a pagar e o dashboard analítico.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                to="/budgets"
                className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                Ir para Orçamentos
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
              >
                Abrir Dashboard Financeiro
              </Link>
            </div>
          </div>
        </div>

        <EmbeddedContext.Provider value={true}>
          <AccountsPayablePage />
        </EmbeddedContext.Provider>
      </div>
    </DashboardLayout>
  );
}
