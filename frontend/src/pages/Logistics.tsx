import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { DataTable } from "@/components/DataTable";
import { FormField } from "@/components/FormField";
import { StatusBadge } from "@/components/StatusBadge";
import { listBudgets, type Budget } from "@/services/budgets";
import { listProductions, EmployeeProduction } from "@/services/productions";
import { getDashboardSummary } from "@/services/dashboard";
import { listEmployees } from "@/services/employees";
import {
  listPurchaseOrders,
  type PurchaseOrder,
} from "@/services/purchase-orders";
import { listWasteRecords, type WasteRecord } from "@/services/waste";
import { useRoleAccess } from "@/auth/AuthProvider";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  DollarSign,
  Truck,
  UserCheck,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";

type DeliveryHealthStatus = "late" | "near_due" | "on_time";

interface LogisticsProductionRow extends EmployeeProduction {
  daysToDelivery: number | null;
  deliveryHealthStatus: DeliveryHealthStatus;
}

interface FinancialBudgetRow {
  id: string;
  clientName: string;
  referenceDate: string;
  linkedRevenue: number;
  generalCost: number;
  applicableCost: number;
  generalProfit: number;
}

interface FinancialMonthRow {
  monthKey: string;
  month: string;
  generalCost: number;
  linkedRevenue: number;
  generalProfit: number;
}

interface LogisticsProductionSummary {
  totalCount: number;
  activeCount: number;
  overdueCount: number;
  onTimeCount: number;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const financialByProductionChartConfig = {
  generalCost: {
    label: "Gastos",
    color: "#ef4444",
  },
  linkedRevenue: {
    label: "Receita",
    color: "#0ea5e9",
  },
  generalProfit: {
    label: "Lucro Geral",
    color: "#22c55e",
  },
} satisfies ChartConfig;

const financialByMonthChartConfig = {
  generalCost: {
    label: "Gastos",
    color: "#ef4444",
  },
  linkedRevenue: {
    label: "Receita",
    color: "#0ea5e9",
  },
  generalProfit: {
    label: "Lucro Geral",
    color: "#22c55e",
  },
} satisfies ChartConfig;

const isFinalizedProduction = (
  status: EmployeeProduction["productionStatus"],
) => status === "approved" || status === "delivered";

const healthStatusStyles: Record<DeliveryHealthStatus, string> = {
  late: "bg-destructive/20 text-destructive",
  near_due: "bg-amber-500/20 text-amber-300",
  on_time: "bg-success/20 text-success",
};

const healthStatusLabels: Record<DeliveryHealthStatus, string> = {
  late: "Atrasada",
  near_due: "Quase no Prazo",
  on_time: "Em Dia",
};

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatCurrencyAxis = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const normalizeDeliveryDate = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }

  return value.includes("T") ? value.split("T")[0] : value;
};

const parseDateAtMidnight = (value: string) => {
  const normalized = normalizeDeliveryDate(value);

  if (!normalized) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const getDaysToDelivery = (deliveryDate: string) => {
  const targetDate = parseDateAtMidnight(deliveryDate);

  if (!targetDate) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.floor((targetDate.getTime() - today.getTime()) / DAY_IN_MS);
};

const getDeliveryHealthStatus = (
  daysToDelivery: number | null,
): DeliveryHealthStatus => {
  if (daysToDelivery === null) {
    return "on_time";
  }

  if (daysToDelivery < 0) {
    return "late";
  }

  if (daysToDelivery <= 3) {
    return "near_due";
  }

  return "on_time";
};

const formatDaysToDelivery = (daysToDelivery: number | null) => {
  if (daysToDelivery === null) {
    return "Sem prazo";
  }

  if (daysToDelivery < 0) {
    return `${Math.abs(daysToDelivery)}d atraso`;
  }

  if (daysToDelivery === 0) {
    return "Hoje";
  }

  if (daysToDelivery === 1) {
    return "1 dia";
  }

  return `${daysToDelivery} dias`;
};

const formatDeliveryDate = (value: string) =>
  normalizeDeliveryDate(value) || "-";

const buildClientChartLabel = (clientName: string) => {
  const normalized = clientName.trim();

  if (!normalized) {
    return "Sem Cliente";
  }

  if (normalized.length <= 16) {
    return normalized;
  }

  return `${normalized.slice(0, 16)}...`;
};

const getApprovedReferenceDate = (budget: Budget) =>
  normalizeDeliveryDate(
    budget.approvedAt ||
      budget.updatedAt ||
      budget.createdAt ||
      budget.deliveryDate,
  );

const getPurchaseOrderReferenceDate = (purchaseOrder: PurchaseOrder) =>
  normalizeDeliveryDate(
    purchaseOrder.receivedAt ||
      purchaseOrder.sentAt ||
      purchaseOrder.createdAt ||
      purchaseOrder.expectedDeliveryDate,
  );

const getWasteSoldReferenceDate = (wasteRecord: WasteRecord) =>
  normalizeDeliveryDate(
    wasteRecord.soldAt || wasteRecord.recordDate || wasteRecord.updatedAt,
  );

const normalizeMarginValue = (value: number) => {
  if (!Number.isFinite(value)) {
    return null;
  }

  if (value > 1 && value <= 100) {
    return value / 100;
  }

  return value;
};

const getMonthReference = (deliveryDate: string) => {
  const normalized = normalizeDeliveryDate(deliveryDate);

  if (!normalized) {
    return { monthKey: "sem-data", month: "Sem data" };
  }

  const parsed = new Date(`${normalized}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return { monthKey: "sem-data", month: "Sem data" };
  }

  const month = String(parsed.getMonth() + 1).padStart(2, "0");

  return {
    monthKey: `${parsed.getFullYear()}-${month}`,
    month: parsed.toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit",
    }),
  };
};


const LogisticsPage = () => {
  const { isEmployee } = useRoleAccess();
  const [productions, setProductions] = useState<EmployeeProduction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [filterDateStart, setFilterDateStart] = useState("");
  const [filterDateEnd, setFilterDateEnd] = useState("");
  const [activeEmployeesCount, setActiveEmployeesCount] = useState<
    number | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requestError, setRequestError] = useState("");
  const [secondaryWarning, setSecondaryWarning] = useState("");
  const [receivablePaidTotal, setReceivablePaidTotal] = useState(0);
  const [employeeSummary, setEmployeeSummary] =
    useState<LogisticsProductionSummary | null>(null);

  const loadLogisticsData = async () => {
    setIsLoading(true);
    setRequestError("");
    setSecondaryWarning("");

    try {
      if (isEmployee) {
        const employeeProductions = await listProductions();
        const activeRows = employeeProductions
          .filter((item) => !isFinalizedProduction(item.productionStatus))
          .map((item) => {
            const daysToDelivery = getDaysToDelivery(item.deliveryDate);

            return {
              daysToDelivery,
              deliveryHealthStatus: getDeliveryHealthStatus(daysToDelivery),
            };
          });

        setEmployeeSummary({
          totalCount: employeeProductions.length,
          activeCount: activeRows.length,
          overdueCount: activeRows.filter(
            (item) => item.deliveryHealthStatus === "late",
          ).length,
          onTimeCount: activeRows.filter(
            (item) => item.deliveryHealthStatus === "on_time",
          ).length,
        });
        setProductions(employeeProductions);
        setBudgets([]);
        setPurchaseOrders([]);
        setWasteRecords([]);
        setActiveEmployeesCount(null);
        setReceivablePaidTotal(0);
        return;
      }

      setEmployeeSummary(null);

      const [
        productionsResult,
        employeesResult,
        budgetsResult,
        purchaseOrdersResult,
        wasteRecordsResult,
        dashboardSummaryResult,
      ] = await Promise.allSettled([
        listProductions({ active: true }),
        listEmployees(),
        listBudgets(),
        listPurchaseOrders(),
        listWasteRecords(),
        getDashboardSummary(),
      ]);

      if (productionsResult.status !== "fulfilled") {
        throw new Error(
          getErrorMessage(
            productionsResult.reason,
            "Falha ao carregar produções.",
          ),
        );
      }

      const nextProductions = productionsResult.value;

      setProductions(nextProductions);

      const warnings: string[] = [];

      if (budgetsResult.status === "fulfilled") {
        setBudgets(budgetsResult.value);
      } else {
        setBudgets([]);
        warnings.push(
          "Não foi possível obter orçamentos do banco para calcular lucro e receita na logística.",
        );
      }

      if (purchaseOrdersResult.status === "fulfilled") {
        setPurchaseOrders(purchaseOrdersResult.value);
      } else {
        setPurchaseOrders([]);
        warnings.push(
          "Não foi possível obter pedidos de compra do banco para compor custos ativos.",
        );
      }

      if (wasteRecordsResult.status === "fulfilled") {
        setWasteRecords(wasteRecordsResult.value);
      } else {
        setWasteRecords([]);
        warnings.push(
          "Não foi possível obter resíduos vendidos para compor receita vinculada.",
        );
      }

      if (dashboardSummaryResult.status === "fulfilled") {
        setReceivablePaidTotal(
          Math.max(0, Number(dashboardSummaryResult.value.receivablePaid) || 0),
        );
      } else {
        setReceivablePaidTotal(0);
        warnings.push(
          "Não foi possível obter contas a receber pagas para compor receita vinculada.",
        );
      }

      if (employeesResult.status === "fulfilled") {
        setActiveEmployeesCount(
          employeesResult.value.filter((employee) => employee.isActive).length,
        );
      } else {
        setActiveEmployeesCount(null);
        warnings.push(
          "Não foi possível obter o total de funcionários ativos do banco.",
        );
      }

      setSecondaryWarning(warnings.join(" "));
    } catch (error) {
      setEmployeeSummary(null);
      setProductions([]);
      setBudgets([]);
      setPurchaseOrders([]);
      setWasteRecords([]);
      setActiveEmployeesCount(null);
      setReceivablePaidTotal(0);
      setRequestError(
        `Não foi possível carregar dados de logística: ${getErrorMessage(error, "Erro inesperado.")}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadLogisticsData();
  }, [filterDateStart, filterDateEnd, isEmployee]);

  const parsedFilterStart = useMemo(
    () => parseDateAtMidnight(filterDateStart),
    [filterDateStart],
  );
  const parsedFilterEnd = useMemo(
    () => parseDateAtMidnight(filterDateEnd),
    [filterDateEnd],
  );

  const hasInvalidDateRange = Boolean(
    parsedFilterStart &&
    parsedFilterEnd &&
    parsedFilterStart.getTime() > parsedFilterEnd.getTime(),
  );

  const isDateInSelectedRange = (value: string | null | undefined) => {
    if (!parsedFilterStart && !parsedFilterEnd) {
      return true;
    }

    const parsedValue = parseDateAtMidnight(value || "");

    if (!parsedValue) {
      return false;
    }

    if (
      parsedFilterStart &&
      parsedValue.getTime() < parsedFilterStart.getTime()
    ) {
      return false;
    }

    if (parsedFilterEnd && parsedValue.getTime() > parsedFilterEnd.getTime()) {
      return false;
    }

    return true;
  };

  const filteredProductions = useMemo(
    () =>
      productions.filter((item) => {
        if (hasInvalidDateRange) {
          return false;
        }

        return isDateInSelectedRange(item.deliveryDate);
      }),
    [productions, hasInvalidDateRange, parsedFilterStart, parsedFilterEnd],
  );

  const activeProductions = useMemo(
    () =>
      filteredProductions.filter(
        (item) => !isFinalizedProduction(item.productionStatus),
      ),
    [filteredProductions],
  );

  const activeProductionRows = useMemo<LogisticsProductionRow[]>(
    () =>
      activeProductions.map((item) => {
        const daysToDelivery = getDaysToDelivery(item.deliveryDate);

        return {
          ...item,
          daysToDelivery,
          deliveryHealthStatus: getDeliveryHealthStatus(daysToDelivery),
        };
      }),
    [activeProductions],
  );

  const overdueProductions = useMemo(
    () =>
      activeProductionRows.filter(
        (item) => item.deliveryHealthStatus === "late",
      ),
    [activeProductionRows],
  );

  const nearDueProductions = useMemo(
    () =>
      activeProductionRows.filter(
        (item) => item.deliveryHealthStatus === "near_due",
      ),
    [activeProductionRows],
  );

  const onTimeProductions = useMemo(
    () =>
      activeProductionRows.filter(
        (item) => item.deliveryHealthStatus === "on_time",
      ),
    [activeProductionRows],
  );

  const approvedBudgets = useMemo(() => {
    if (hasInvalidDateRange) {
      return [] as Budget[];
    }

    return budgets.filter((budget) => {
      if (budget.status !== "approved") {
        return false;
      }

      return isDateInSelectedRange(getApprovedReferenceDate(budget));
    });
  }, [budgets, hasInvalidDateRange, parsedFilterStart, parsedFilterEnd]);

  const purchaseOrdersActiveCost = useMemo(() => {
    if (hasInvalidDateRange) {
      return 0;
    }

    return purchaseOrders
      .filter((purchaseOrder) => purchaseOrder.status !== "cancelled")
      .filter((purchaseOrder) =>
        isDateInSelectedRange(getPurchaseOrderReferenceDate(purchaseOrder)),
      )
      .reduce(
        (sum, purchaseOrder) =>
          sum + Math.max(0, Number(purchaseOrder.totalAmount) || 0),
        0,
      );
  }, [
    purchaseOrders,
    hasInvalidDateRange,
    parsedFilterStart,
    parsedFilterEnd,
  ]);

  const soldWasteRevenueTotal = useMemo(() => {
    if (hasInvalidDateRange) {
      return 0;
    }

    return wasteRecords
      .filter((wasteRecord) => wasteRecord.sold)
      .filter((wasteRecord) =>
        isDateInSelectedRange(getWasteSoldReferenceDate(wasteRecord)),
      )
      .reduce(
        (sum, wasteRecord) =>
          sum + Math.max(0, Number(wasteRecord.saleAmount) || 0),
        0,
      );
  }, [
    wasteRecords,
    hasInvalidDateRange,
    parsedFilterStart,
    parsedFilterEnd,
  ]);

  const financialRows = useMemo(() => {
    const rows: FinancialBudgetRow[] = [];

    approvedBudgets.forEach((budget) => {
      const materialTotal = (budget.materials || []).reduce(
        (sum, material) =>
          sum +
          (Number(material.quantity) || 0) * (Number(material.unitPrice) || 0),
        0,
      );
      const expenseDepartmentsFromSummary = Number(
        budget.financialSummary?.expenseDepartmentsCost ?? 0,
      );
      const expenseDepartmentsFromList = (budget.expenseDepartments || []).reduce(
        (sum, item) => sum + (Number(item.amount) || 0),
        0,
      );
      const expenseDepartmentsCost = Math.max(
        0,
        Number.isFinite(expenseDepartmentsFromSummary) &&
          expenseDepartmentsFromSummary > 0
          ? expenseDepartmentsFromSummary
          : expenseDepartmentsFromList,
      );
      const totalCostFromApi = Number(budget.totalCost);
      const applicableCostFromSummary = Number(
        budget.financialSummary?.costsApplicableValue ??
          budget.costsApplicableValue ??
          0,
      );
      const applicableCostFromList = (budget.applicableCosts || []).reduce(
        (sum, item) => sum + (Number(item.amount) || 0),
        0,
      );
      const applicableCost = Math.max(
        0,
        Number.isFinite(applicableCostFromSummary) &&
          applicableCostFromSummary > 0
          ? applicableCostFromSummary
          : applicableCostFromList,
      );
      const generalCost =
        Number.isFinite(totalCostFromApi) && totalCostFromApi > 0
          ? totalCostFromApi
          : materialTotal + expenseDepartmentsCost + applicableCost;
      const finalPriceFromApi = Number(budget.finalPrice ?? budget.totalPrice);
      const linkedRevenue =
        Number.isFinite(finalPriceFromApi) && finalPriceFromApi > 0
          ? finalPriceFromApi
          : materialTotal;
      const generalProfit = linkedRevenue - generalCost;

      rows.push({
        id: budget.id,
        clientName: budget.clientName,
        referenceDate: getApprovedReferenceDate(budget),
        linkedRevenue,
        generalCost,
        applicableCost,
        generalProfit,
      });
    });

    return rows;
  }, [approvedBudgets]);

  const financialTotals = useMemo(() => {
    const baseTotals = financialRows.reduce(
      (acc, item) => {
        acc.linkedRevenue += item.linkedRevenue;
        acc.generalCost += item.generalCost;
        acc.applicableCost += item.applicableCost;
        acc.generalProfit += item.generalProfit;
        return acc;
      },
      {
        linkedRevenue: 0,
        generalCost: 0,
        applicableCost: 0,
        generalProfit: 0,
      },
    );

    const adjustedRevenue =
      baseTotals.linkedRevenue + soldWasteRevenueTotal + receivablePaidTotal;
    const adjustedCost = baseTotals.generalCost + purchaseOrdersActiveCost;
    const adjustedProfit = adjustedRevenue - adjustedCost;

    return {
      ...baseTotals,
      generalCost: adjustedCost,
      linkedRevenue: adjustedRevenue,
      generalProfit: adjustedProfit,
    };
  }, [
    financialRows,
    purchaseOrdersActiveCost,
    soldWasteRevenueTotal,
    receivablePaidTotal,
  ]);

  const financialByBudgetRows = useMemo(
    () =>
      [...financialRows]
        .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate))
        .slice(0, 8)
        .map((item) => ({
          id: item.id,
          label: buildClientChartLabel(item.clientName),
          generalCost: item.generalCost,
          linkedRevenue: item.linkedRevenue,
          generalProfit: item.generalProfit,
        })),
    [financialRows],
  );

  const financialByMonthRows = useMemo<FinancialMonthRow[]>(() => {
    const map = new Map<string, FinancialMonthRow>();

    financialRows.forEach((item) => {
      const { monthKey, month } = getMonthReference(item.referenceDate);
      const current = map.get(monthKey);

      if (!current) {
        map.set(monthKey, {
          monthKey,
          month,
          generalCost: item.generalCost,
          linkedRevenue: item.linkedRevenue,
          generalProfit: item.generalProfit,
        });
        return;
      }

      current.generalCost += item.generalCost;
      current.linkedRevenue += item.linkedRevenue;
      current.generalProfit += item.generalProfit;
    });

    return Array.from(map.values()).sort((a, b) =>
      a.monthKey.localeCompare(b.monthKey),
    );
  }, [financialRows]);

  const productionColumns = [
    { key: "clientName", header: "Cliente" },
    { key: "description", header: "Descrição" },
    {
      key: "deliveryDate",
      header: "Entrega",
      mono: true,
      render: (item: LogisticsProductionRow) =>
        formatDeliveryDate(item.deliveryDate),
    },
    {
      key: "daysToDelivery",
      header: "Prazo",
      mono: true,
      render: (item: LogisticsProductionRow) =>
        formatDaysToDelivery(item.daysToDelivery),
    },
    {
      key: "deliveryHealthStatus",
      header: "Situação",
      render: (item: LogisticsProductionRow) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
            healthStatusStyles[item.deliveryHealthStatus]
          }`}
        >
          {healthStatusLabels[item.deliveryHealthStatus]}
        </span>
      ),
    },
    {
      key: "productionStatus",
      header: "Etapa",
      render: (item: LogisticsProductionRow) => (
        <StatusBadge status={item.productionStatus} />
      ),
    },
    { key: "installationTeam", header: "Equipe" },
  ];

  const activeEmployeesLabel =
    activeEmployeesCount === null ? "N/D" : activeEmployeesCount;

  if (isEmployee) {
    const summary = employeeSummary ?? {
      totalCount: 0,
      activeCount: 0,
      overdueCount: 0,
      onTimeCount: 0,
    };

    return (
      <DashboardLayout title="Logística" subtitle="Resumo de Produções">
        <div className="animate-fade-in space-y-6">
          {requestError && (
            <div className="border border-destructive/40 bg-destructive/10 rounded px-3 py-2 text-sm text-destructive flex items-center justify-between gap-3">
              <span>{requestError}</span>
              <button
                onClick={() => void loadLogisticsData()}
                className="px-2 py-1 text-[11px] font-bold rounded border border-destructive/30 hover:bg-destructive/20"
              >
                TENTAR NOVAMENTE
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title="Quantidade de Produções"
              value={isLoading ? "..." : summary.totalCount}
              icon={<Truck className="h-4 w-4" />}
            />
            <StatCard
              title="Produções Ativas"
              value={isLoading ? "..." : summary.activeCount}
              icon={<Clock3 className="h-4 w-4" />}
            />
            <StatCard
              title="Produções Atrasadas"
              value={isLoading ? "..." : summary.overdueCount}
              icon={<AlertTriangle className="h-4 w-4" />}
              highlight={summary.overdueCount > 0}
            />
            <StatCard
              title="Produções em Dia"
              value={isLoading ? "..." : summary.onTimeCount}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Logística" subtitle="Entregas e Instalação">
      <div className="animate-fade-in space-y-8">
        <div className="rounded border border-border bg-card p-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <FormField
              label="Data inicial"
              type="date"
              value={filterDateStart}
              onChange={(event) => setFilterDateStart(event.target.value)}
            />
            <FormField
              label="Data final"
              type="date"
              value={filterDateEnd}
              onChange={(event) => setFilterDateEnd(event.target.value)}
            />
            <button
              onClick={() => {
                setFilterDateStart("");
                setFilterDateEnd("");
              }}
              className="h-10 px-3 py-2 text-xs font-bold rounded border border-border hover:bg-secondary transition-colors text-foreground"
            >
              Limpar filtro de data
            </button>
          </div>

          {hasInvalidDateRange ? (
            <p className="mt-2 text-xs text-destructive">
              O período informado é inválido. A data inicial não pode ser maior
              que a data final.
            </p>
          ) : filterDateStart || filterDateEnd ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Filtro ativo para entregas e orçamentos aprovados no período
              selecionado.
            </p>
          ) : null}
        </div>

        {secondaryWarning && (
          <div className="border border-amber-300/40 bg-amber-50/70 rounded px-3 py-2 text-sm text-amber-900">
            {secondaryWarning}
          </div>
        )}

        {requestError && (
          <div className="border border-destructive/40 bg-destructive/10 rounded px-3 py-2 text-sm text-destructive flex items-center justify-between gap-3">
            <span>{requestError}</span>
            <button
              onClick={() => void loadLogisticsData()}
              className="px-2 py-1 text-[11px] font-bold rounded border border-destructive/30 hover:bg-destructive/20"
            >
              TENTAR NOVAMENTE
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4 gap-4">
          <StatCard
            title="Funcionários Ativos"
            value={activeEmployeesLabel}
            icon={<UserCheck className="h-4 w-4" />}
            subtitle={
              activeEmployeesCount === null
                ? "Sem acesso ao módulo de funcionários"
                : undefined
            }
          />
          <StatCard
            title="Produções Atrasadas"
            value={overdueProductions.length}
            icon={<AlertTriangle className="h-4 w-4" />}
            highlight={overdueProductions.length > 0}
          />
          <StatCard
            title="Quase no Prazo"
            value={nearDueProductions.length}
            icon={<Clock3 className="h-4 w-4" />}
            highlight={nearDueProductions.length > 0}
          />
          <StatCard
            title="Produções em Dia"
            value={onTimeProductions.length}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <StatCard
            title="Custo Geral Ativo"
            value={formatCurrency(financialTotals.generalCost)}
            icon={<DollarSign className="h-4 w-4" />}
            subtitle="Materiais + aplicáveis + despesas dos aprovados + pedidos de compra"
          />
          <StatCard
            title="Receita Vinculada"
            value={formatCurrency(financialTotals.linkedRevenue)}
            icon={<DollarSign className="h-4 w-4" />}
            subtitle="Orçamentos aprovados + resíduos vendidos + contas recebidas"
          />
          <StatCard
            title="Lucro Geral"
            value={formatCurrency(financialTotals.generalProfit)}
            icon={<DollarSign className="h-4 w-4" />}
            subtitle="Receita vinculada - custo geral ativo"
            highlight={financialTotals.generalProfit < 0}
          />

        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">
                Custos x Receita por Orçamento Aprovado
              </CardTitle>
              <CardDescription>
                Comparativo dos primeiros 8 orçamentos aprovados com custo,
                receita e lucro geral.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {financialByBudgetRows.length > 0 ? (
                <ChartContainer
                  config={financialByProductionChartConfig}
                  className="h-[280px] w-full aspect-auto"
                >
                  <BarChart data={financialByBudgetRows}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={24}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatCurrencyAxis}
                      width={110}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) =>
                            formatCurrency(Number(value) || 0)
                          }
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                      dataKey="generalCost"
                      fill="var(--color-generalCost)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="linkedRevenue"
                      fill="var(--color-linkedRevenue)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="generalProfit"
                      fill="var(--color-generalProfit)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-6">
                  Sem orçamentos aprovados para montar o gráfico comparativo.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">
                Evolução de Custos, Receita e Lucro Geral
              </CardTitle>
              <CardDescription>
                Valores por mês de aprovação, considerando receita vinculada e
                custo geral ativo.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {financialByMonthRows.length > 0 ? (
                <ChartContainer
                  config={financialByMonthChartConfig}
                  className="h-[280px] w-full aspect-auto"
                >
                  <LineChart data={financialByMonthRows}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatCurrencyAxis}
                      width={110}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) =>
                            formatCurrency(Number(value) || 0)
                          }
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      type="monotone"
                      dataKey="generalCost"
                      stroke="var(--color-generalCost)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="linkedRevenue"
                      stroke="var(--color-linkedRevenue)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="generalProfit"
                      stroke="var(--color-generalProfit)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-6">
                  Sem dados financeiros de orçamentos aprovados para montar a
                  evolução mensal.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-4">
            Produções Atrasadas
          </h2>
          <DataTable
            columns={productionColumns}
            data={overdueProductions}
            emptyMessage={
              isLoading
                ? "Carregando produções atrasadas..."
                : "Nenhuma produção ativa atrasada."
            }
          />
        </div>

        <div>
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-4">
            Produções Quase no Prazo
          </h2>
          <DataTable
            columns={productionColumns}
            data={nearDueProductions}
            emptyMessage={
              isLoading
                ? "Carregando produções próximas do prazo..."
                : "Nenhuma produção ativa quase no prazo."
            }
          />
        </div>

        <div>
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-4">
            Produções em Dia
          </h2>
          <DataTable
            columns={productionColumns}
            data={onTimeProductions}
            emptyMessage={
              isLoading
                ? "Carregando produções em dia..."
                : "Nenhuma produção ativa em dia no momento."
            }
          />
        </div>

        <div>
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-4">
            Resumo de Produções Ativas
          </h2>
          <div className="flex items-center gap-2 px-3 py-1.5 border border-border rounded bg-card text-sm w-fit">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Total ativo</span>
            <span className="font-mono text-xs text-foreground">
              {activeProductions.length}
            </span>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default LogisticsPage;
