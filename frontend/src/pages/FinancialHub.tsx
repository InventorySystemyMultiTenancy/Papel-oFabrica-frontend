import { useState } from "react";
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
