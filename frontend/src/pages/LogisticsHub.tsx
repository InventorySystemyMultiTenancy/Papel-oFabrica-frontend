import { useEffect, useMemo, useState } from "react";
import { DashboardLayout, EmbeddedContext } from "@/layouts/DashboardLayout";
import { useRoleAccess } from "@/auth/AuthProvider";
import LogisticsPage from "./Logistics";
import DeliveryRoutesPage from "./DeliveryRoutes";

type Tab = "visao-geral" | "roteiros";

const TABS: { id: Tab; label: string }[] = [
  { id: "visao-geral", label: "Visão Geral" },
  { id: "roteiros", label: "Roteiros de Entrega" },
];

export default function LogisticsHub() {
  const { isEmployee } = useRoleAccess();
  const [activeTab, setActiveTab] = useState<Tab>("visao-geral");
  const visibleTabs = useMemo(
    () => (isEmployee ? TABS.filter((tab) => tab.id !== "roteiros") : TABS),
    [isEmployee],
  );

  useEffect(() => {
    if (isEmployee && activeTab === "roteiros") {
      setActiveTab("visao-geral");
    }
  }, [activeTab, isEmployee]);

  return (
    <DashboardLayout
      title="Logística"
      subtitle={isEmployee ? "Visão geral" : "Visão geral e roteiros de entrega"}
    >
      <div className="space-y-4">
        <div className="flex gap-0 border-b border-border">
          {visibleTabs.map((tab) => (
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

        <EmbeddedContext.Provider value={true}>
          {activeTab === "visao-geral" && <LogisticsPage />}
          {!isEmployee && activeTab === "roteiros" && <DeliveryRoutesPage />}
        </EmbeddedContext.Provider>
      </div>
    </DashboardLayout>
  );
}
