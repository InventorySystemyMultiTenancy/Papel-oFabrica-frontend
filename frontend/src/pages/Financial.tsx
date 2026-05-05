import { useEffect, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ApiError } from "@/services/api";
import { type CashflowSummary, getCashflow } from "@/services/financial";
import { TrendingUp, TrendingDown, DollarSign, RefreshCw } from "lucide-react";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatMonth = (value: string) => {
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
};

const StatCard = ({
  title,
  value,
  icon: Icon,
  positive,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  positive?: boolean;
}) => (
  <div className="border border-border rounded-lg p-4 bg-card flex items-center gap-4">
    <div
      className={`p-2 rounded-lg ${positive === undefined ? "bg-secondary" : positive ? "bg-green-500/15" : "bg-destructive/15"}`}
    >
      <Icon
        className={`h-5 w-5 ${positive === undefined ? "text-muted-foreground" : positive ? "text-green-500" : "text-destructive"}`}
      />
    </div>
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">
        {title}
      </p>
      <p
        className={`text-lg font-bold ${positive === undefined ? "" : positive ? "text-green-500" : "text-destructive"}`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  </div>
);

const BarChart = ({
  data,
}: {
  data: Array<{ month: string; amount: number }>;
}) => {
  const max = Math.max(...data.map((d) => d.amount), 1);
  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <h3 className="text-sm font-semibold mb-4">A Receber por Mês</h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados para exibir.</p>
      ) : (
        <div className="flex items-end gap-3 h-40 overflow-x-auto pb-1">
          {data.map((d) => {
            const pct = (d.amount / max) * 100;
            return (
              <div
                key={d.month}
                className="flex flex-col items-center gap-1 min-w-[56px]"
              >
                <span className="text-[10px] font-mono text-muted-foreground">
                  {formatCurrency(d.amount).replace("R$\u00a0", "R$ ")}
                </span>
                <div
                  className="w-10 bg-primary rounded-t transition-all"
                  style={{ height: `${Math.max(4, (pct / 100) * 120)}px` }}
                />
                <span className="text-[10px] text-muted-foreground text-center leading-tight">
                  {formatMonth(d.month)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const FinancialPage = () => {
  const [summary, setSummary] = useState<CashflowSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await getCashflow();
      setSummary(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar o resumo financeiro.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <DashboardLayout
      title="Financeiro"
      subtitle="Fluxo de caixa e contas a receber"
    >
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-end">
          <button
            onClick={() => void loadData()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border border-border hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Atualizar
          </button>
        </div>
        {error && (
          <div className="border border-destructive/40 bg-destructive/10 rounded px-3 py-2 text-sm text-destructive flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={() => void loadData()}
              className="px-2 py-1 text-[11px] font-bold rounded border border-destructive/30 hover:bg-destructive/20"
            >
              TENTAR NOVAMENTE
            </button>
          </div>
        )}

        {isLoading && !summary ? (
          <p className="text-sm text-muted-foreground">
            Carregando resumo financeiro...
          </p>
        ) : summary ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                title="A Receber (Pendente)"
                value={summary.expectedIncome}
                icon={TrendingUp}
                positive={true}
              />
              <StatCard
                title="A Pagar (Orçamentos Aprovados)"
                value={summary.expectedExpenses}
                icon={TrendingDown}
                positive={false}
              />
              <StatCard
                title="Fluxo de Caixa Projetado"
                value={summary.cashflow}
                icon={DollarSign}
                positive={summary.cashflow >= 0}
              />
            </div>

            <BarChart data={summary.receivablesByMonth} />

            {summary.receivablesByMonth.length > 0 && (
              <div className="border border-border rounded-lg p-4 bg-card">
                <h3 className="text-sm font-semibold mb-3">Detalhe por Mês</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground text-xs uppercase tracking-wider">
                        <th className="pb-2 pr-4">Mês</th>
                        <th className="pb-2 text-right">Valor a Receber</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {summary.receivablesByMonth.map((row) => (
                        <tr key={row.month}>
                          <td className="py-2 pr-4">
                            {formatMonth(row.month)}
                          </td>
                          <td className="py-2 text-right font-mono text-green-500">
                            {formatCurrency(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border font-bold">
                        <td className="pt-2 pr-4">Total</td>
                        <td className="pt-2 text-right font-mono text-green-500">
                          {formatCurrency(
                            summary.receivablesByMonth.reduce(
                              (s, r) => s + r.amount,
                              0,
                            ),
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default FinancialPage;
