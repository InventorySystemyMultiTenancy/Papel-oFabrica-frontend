import { useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout, EmbeddedContext } from "@/layouts/DashboardLayout";
import FinancialPage from "./Financial";
import AccountsPayablePage from "./AccountsPayable";

type Tab = "receber" | "pagar";

const TABS: { id: Tab; label: string }[] = [
  { id: "receber", label: "A Receber" },
  { id: "pagar", label: "Contas a Pagar" },
];

export default function FinancialHub() {
  const [activeTab, setActiveTab] = useState<Tab>("receber");

  return (
    <DashboardLayout title="Financeiro" subtitle="A Receber e Contas a Pagar">
      <div className="space-y-4">
        <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 via-white to-blue-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-500">
                Financeiro Principal
              </p>
              <h2 className="text-2xl font-bold text-slate-900">
                Faça seu orçamento, rápido e fácil
              </h2>
              <p className="text-sm text-slate-600">
                Acesse rapidamente os lançamentos financeiros e o dashboard analítico.
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

        {/* Tab bar */}
        <div className="flex gap-0 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content — EmbeddedContext strips DashboardLayout from sub-pages */}
        <EmbeddedContext.Provider value={true}>
          {activeTab === "receber" && <FinancialPage />}
          {activeTab === "pagar" && <AccountsPayablePage />}
        </EmbeddedContext.Provider>
      </div>
    </DashboardLayout>
  );
}
