import { useState } from "react";
import { DashboardLayout, EmbeddedContext } from "@/layouts/DashboardLayout";
import ProductsPage from "./Products";
import StockPage from "./Stock";
import ConsignedStockPage from "./ConsignedStock";

type Tab = "produtos" | "movimentacoes" | "consignado";

const TABS: { id: Tab; label: string }[] = [
  { id: "produtos", label: "Produtos" },
  { id: "movimentacoes", label: "Movimentações" },
  { id: "consignado", label: "Consignado" },
];

export default function StockHub() {
  const [activeTab, setActiveTab] = useState<Tab>("produtos");

  return (
    <DashboardLayout
      title="Estoque"
      subtitle="Produtos, movimentações e estoque consignado"
    >
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
          {activeTab === "produtos" && <ProductsPage />}
          {activeTab === "movimentacoes" && <StockPage />}
          {activeTab === "consignado" && <ConsignedStockPage />}
        </EmbeddedContext.Provider>
      </div>
    </DashboardLayout>
  );
}
