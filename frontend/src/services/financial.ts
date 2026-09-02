import { parseCollection, request } from "@/services/api";

export type ReceivableStatus = "pending" | "paid" | "overdue";

export interface AccountReceivable {
  id: string;
  orderId: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  status: ReceivableStatus;
  installment: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CashflowSummary {
  expectedIncome: number;
  expectedExpenses: number;
  cashflow: number;
  projectedProfit: number;
  projectedProfitCashflow: number;
  receivablesByMonth: Array<{ month: string; amount: number }>;
  periodStart: string;
  periodEnd: string;
  periodRevenue: number;
  periodCost: number;
  netProfit: number;
}

export interface CashflowPeriod {
  startDate?: string;
  endDate?: string;
}

export interface GenerateInstallmentsInput {
  orderId: string;
  totalAmount: number;
  paymentType: "avista" | "parcelado";
  installmentDays: number[];
}

export interface UpdateReceivableInput {
  status?: ReceivableStatus;
  paidAt?: string | null;
  dueDate?: string;
  notes?: string | null;
}

const toRecord = (v: unknown): Record<string, unknown> | null => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
};

const toStr = (v: unknown, fallback = "") =>
  typeof v === "string" ? v : fallback;
const toNum = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeStatus = (v: unknown): ReceivableStatus => {
  if (v === "paid" || v === "overdue") return v;
  return "pending";
};

const normalizeReceivable = (raw: unknown): AccountReceivable | null => {
  const item = toRecord(raw);
  if (!item) return null;
  const id = toStr(item.id, "").trim();
  if (!id) return null;
  return {
    id,
    orderId: toStr(item.orderId),
    amount: toNum(item.amount),
    dueDate: toStr(item.dueDate),
    paidAt: typeof item.paidAt === "string" ? item.paidAt : null,
    status: normalizeStatus(item.status),
    installment: toNum(item.installment),
    notes: typeof item.notes === "string" ? item.notes : null,
    createdAt: toStr(item.createdAt),
    updatedAt: toStr(item.updatedAt),
  };
};

const normalizeCashflow = (raw: unknown): CashflowSummary | null => {
  const item = toRecord(raw);
  if (!item) return null;
  const byMonth = Array.isArray(item.receivablesByMonth)
    ? (item.receivablesByMonth as unknown[])
        .map((entry) => {
          const r = toRecord(entry);
          if (!r) return null;
          return { month: toStr(r.month), amount: toNum(r.amount) };
        })
        .filter((x): x is { month: string; amount: number } => x !== null)
    : [];
  return {
    expectedIncome: toNum(item.expectedIncome),
    expectedExpenses: toNum(item.expectedExpenses),
    cashflow: toNum(item.cashflow),
    projectedProfit: toNum(item.projectedProfit),
    projectedProfitCashflow: toNum(item.projectedProfitCashflow),
    receivablesByMonth: byMonth,
    periodStart: toStr(item.periodStart),
    periodEnd: toStr(item.periodEnd),
    periodRevenue: toNum(item.periodRevenue),
    periodCost: toNum(item.periodCost),
    netProfit: toNum(item.netProfit),
  };
};

export const getCashflow = async (
  period?: CashflowPeriod,
): Promise<CashflowSummary> => {
  const params = new URLSearchParams();
  if (period?.startDate) params.set("startDate", period.startDate);
  if (period?.endDate) params.set("endDate", period.endDate);
  const query = params.toString();

  const payload = await request<unknown>(
    `/financial/cashflow${query ? `?${query}` : ""}`,
  );
  const normalized = normalizeCashflow(payload);
  if (!normalized)
    throw new Error("Resposta inválida ao buscar fluxo de caixa.");
  return normalized;
};

export const listReceivables = async (
  orderId: string,
): Promise<AccountReceivable[]> => {
  const payload = await request<unknown>(
    `/financial/orders/${orderId}/receivables`,
  );
  return parseCollection<unknown>(payload)
    .map(normalizeReceivable)
    .filter((x): x is AccountReceivable => x !== null)
    .sort((a, b) => a.installment - b.installment);
};

export const generateInstallments = async (
  input: GenerateInstallmentsInput,
): Promise<AccountReceivable[]> => {
  const payload = await request<unknown>(
    "/financial/receivables/installments",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return parseCollection<unknown>(payload)
    .map(normalizeReceivable)
    .filter((x): x is AccountReceivable => x !== null)
    .sort((a, b) => a.installment - b.installment);
};

export const updateReceivable = async (
  id: string,
  input: UpdateReceivableInput,
): Promise<AccountReceivable> => {
  const payload = await request<unknown>(`/financial/receivables/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const normalized = normalizeReceivable(payload);
  if (!normalized) throw new Error("Resposta inválida ao atualizar parcela.");
  return normalized;
};
