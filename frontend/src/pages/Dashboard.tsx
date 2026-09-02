import { useEffect, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { PeriodPicker } from "@/components/PeriodPicker";
import { ApiError } from "@/services/api";
import {
  type DashboardSummary,
  getDashboardSummary,
} from "@/services/dashboard";
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  FileText,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  BarChart2,
  Package,
  Printer,
  Wallet,
} from "lucide-react";

const fmt = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtNum = (value: number) => value.toLocaleString("pt-BR");

const formatMonth = (value: string) => {
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
};

const KpiCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "neutral",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: "neutral" | "green" | "red" | "orange" | "blue";
}) => {
  const iconBg = {
    neutral: "bg-secondary text-muted-foreground",
    green: "bg-green-500/15 text-green-500",
    red: "bg-destructive/15 text-destructive",
    orange: "bg-orange-500/15 text-orange-500",
    blue: "bg-blue-500/15 text-blue-400",
  }[color];

  const valColor = {
    neutral: "",
    green: "text-green-500",
    red: "text-destructive",
    orange: "text-orange-500",
    blue: "text-blue-400",
  }[color];

  return (
    <div className="border border-border rounded-lg p-4 bg-card flex items-center gap-4">
      <div className={`p-2.5 rounded-lg shrink-0 ${iconBg}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider truncate">
          {title}
        </p>
        <p className={`text-lg font-bold leading-tight ${valColor}`}>{value}</p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

const RevenueChart = ({
  data,
}: {
  data: DashboardSummary["revenueByMonth"];
}) => {
  const max = Math.max(...data.map((d) => Math.max(d.revenue, d.cost)), 1);
  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-primary" />
        Faturamento vs. Custo — Últimos 6 Meses
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados para exibir.</p>
      ) : (
        <div className="flex items-end gap-4 h-44 overflow-x-auto pb-1">
          {data.map((d) => {
            const revPct = (d.revenue / max) * 100;
            const costPct = (d.cost / max) * 100;
            return (
              <div
                key={d.month}
                className="flex flex-col items-center gap-1 min-w-[72px]"
              >
                <div className="flex items-end gap-1 h-36">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] text-muted-foreground font-mono rotate-[-60deg] origin-bottom-left translate-y-[-4px] translate-x-2 whitespace-nowrap">
                      {fmt(d.revenue)}
                    </span>
                    <div
                      className="w-7 bg-primary rounded-t transition-all"
                      style={{
                        height: `${Math.max(4, (revPct / 100) * 120)}px`,
                      }}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] text-destructive font-mono rotate-[-60deg] origin-bottom-left translate-y-[-4px] translate-x-2 whitespace-nowrap">
                      {fmt(d.cost)}
                    </span>
                    <div
                      className="w-7 bg-destructive/60 rounded-t transition-all"
                      style={{
                        height: `${Math.max(4, (costPct / 100) * 120)}px`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground text-center">
                  {formatMonth(d.month)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-4 mt-3">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-primary inline-block" />{" "}
          Faturamento
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-destructive/60 inline-block" />{" "}
          Custo
        </span>
      </div>
    </div>
  );
};

const BudgetFunnel = ({ summary }: { summary: DashboardSummary }) => {
  const total =
    summary.budgetsDraftCount +
    summary.budgetsPendingCount +
    summary.budgetsApprovedCount;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        Funil de Orçamentos
      </h3>
      <div className="space-y-3">
        {[
          {
            label: "Rascunho",
            count: summary.budgetsDraftCount,
            color: "bg-muted-foreground/30",
          },
          {
            label: "Pendente",
            count: summary.budgetsPendingCount,
            color: "bg-blue-500/40",
          },
          {
            label: "Aprovado",
            count: summary.budgetsApprovedCount,
            color: "bg-green-500/50",
          },
        ].map(({ label, count, color }) => (
          <div key={label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-bold">{count}</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${color}`}
                style={{ width: `${pct(count)}%` }}
              />
            </div>
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground text-right pt-1">
          Total: {fmtNum(total)} orçamentos ativos
        </p>
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<{
    startDate?: string;
    endDate?: string;
  }>({});

  const loadData = async (overridePeriod = period) => {
    setIsLoading(true);
    setError("");
    try {
      const data = await getDashboardSummary(overridePeriod);
      setSummary(data);
      setPeriod({ startDate: data.periodStart, endDate: data.periodEnd });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar o dashboard.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyPeriod = (startDate: string, endDate: string) => {
    void loadData({ startDate, endDate });
  };

  const growthPct =
    summary && summary.revenueLastMonth > 0
      ? ((summary.revenueThisMonth - summary.revenueLastMonth) /
          summary.revenueLastMonth) *
        100
      : null;

  return (
    <DashboardLayout
      title="Dashboard Financeiro"
      action={
        <div className="flex items-center gap-2">
          {summary && (
            <PeriodPicker
              startDate={summary.periodStart}
              endDate={summary.periodEnd}
              onApply={handleApplyPeriod}
            />
          )}
          <button
            onClick={() => void loadData()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border border-border hover:bg-secondary transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </button>
        </div>
      }
    >
      <div className="animate-fade-in space-y-6">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Carregando dados...
          </div>
        )}

        {error && (
          <div className="border border-destructive/30 bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
            {error}
          </div>
        )}

        {summary && (
          <>
            {/* KPI cards */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Visão Geral
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                  title="Faturamento do Mês"
                  value={fmt(summary.revenueThisMonth)}
                  subtitle={`Mês anterior: ${fmt(summary.revenueLastMonth)}`}
                  icon={DollarSign}
                  color={
                    summary.revenueThisMonth >= summary.revenueLastMonth
                      ? "green"
                      : "red"
                  }
                />
                <KpiCard
                  title="Crescimento"
                  value={
                    growthPct !== null
                      ? `${growthPct >= 0 ? "+" : ""}${growthPct.toFixed(1)}%`
                      : "—"
                  }
                  subtitle="vs. mês anterior"
                  icon={
                    growthPct !== null && growthPct >= 0
                      ? TrendingUp
                      : TrendingDown
                  }
                  color={
                    growthPct === null
                      ? "neutral"
                      : growthPct >= 0
                        ? "green"
                        : "red"
                  }
                />
                <KpiCard
                  title="Pedidos em Aberto"
                  value={fmtNum(summary.openOrdersCount)}
                  subtitle={`${fmtNum(summary.ordersThisMonth)} neste mês`}
                  icon={ShoppingCart}
                  color="blue"
                />
                <KpiCard
                  title="Orçamentos (mês)"
                  value={fmtNum(summary.budgetsThisMonth)}
                  subtitle={`${fmtNum(summary.budgetsApprovedCount)} aprovados ativos`}
                  icon={FileText}
                  color="orange"
                />
              </div>
            </div>

            {/* Lucro líquido do período selecionado */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Lucro do Período (
                {new Date(`${summary.periodStart}T00:00:00`).toLocaleDateString(
                  "pt-BR",
                )}{" "}
                a{" "}
                {new Date(`${summary.periodEnd}T00:00:00`).toLocaleDateString(
                  "pt-BR",
                )}
                )
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <KpiCard
                  title="Receita do Período"
                  value={fmt(summary.periodRevenue)}
                  subtitle="Preço dos produtos vendidos"
                  icon={DollarSign}
                  color="blue"
                />
                <KpiCard
                  title="Custo do Período"
                  value={fmt(summary.periodCost)}
                  subtitle="Custo dos produtos vendidos"
                  icon={TrendingDown}
                  color="orange"
                />
                <KpiCard
                  title="Lucro Líquido"
                  value={fmt(summary.netProfit)}
                  subtitle="Receita − custo do período"
                  icon={Wallet}
                  color={summary.netProfit >= 0 ? "green" : "red"}
                />
              </div>
            </div>

            {/* Fluxo de caixa */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Fluxo de Caixa
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                  title="A Receber"
                  value={fmt(summary.receivablePending)}
                  subtitle="Contas a receber pendentes"
                  icon={TrendingUp}
                  color="green"
                />
                <KpiCard
                  title="Receber Vencido"
                  value={fmt(summary.receivableOverdue)}
                  subtitle="Em atraso"
                  icon={AlertTriangle}
                  color={summary.receivableOverdue > 0 ? "red" : "neutral"}
                />
                <KpiCard
                  title="A Pagar"
                  value={fmt(summary.payablePending + summary.payableOverdue)}
                  subtitle={`${fmt(summary.payableOverdue)} vencido`}
                  icon={TrendingDown}
                  color={summary.payableOverdue > 0 ? "red" : "neutral"}
                />
                <KpiCard
                  title="Saldo Projetado"
                  value={fmt(summary.projectedBalance)}
                  subtitle="Receber pendente − A pagar"
                  icon={DollarSign}
                  color={summary.projectedBalance >= 0 ? "green" : "red"}
                />
              </div>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <RevenueChart data={summary.revenueByMonth} />
              </div>
              <BudgetFunnel summary={summary} />
            </div>

            {/* Alerts */}
            {(summary.lowStockCount > 0 || summary.unpaidClichesTotal > 0) && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Alertas
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {summary.lowStockCount > 0 && (
                    <KpiCard
                      title="Produtos com Estoque Baixo"
                      value={fmtNum(summary.lowStockCount)}
                      subtitle="Verificar estoque"
                      icon={Package}
                      color="red"
                    />
                  )}
                  {summary.unpaidClichesTotal > 0 && (
                    <KpiCard
                      title="Clichês Não Pagos"
                      value={fmt(summary.unpaidClichesTotal)}
                      subtitle="Total pendente de pagamento"
                      icon={Printer}
                      color="orange"
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
