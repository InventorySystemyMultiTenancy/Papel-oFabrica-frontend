import { parseCollection, request } from "@/services/api";

export type PayableCategory =
  | "agua"
  | "energia"
  | "material"
  | "aluguel"
  | "salario"
  | "impostos"
  | "servicos"
  | "outros";
export type PayableStatus = "pending" | "paid" | "overdue";

export interface AccountPayable {
  id: string;
  description: string;
  category: PayableCategory;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  status: PayableStatus;
  supplier: string | null;
  notes: string | null;
  recurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PayableSummary {
  totalPending: number;
  totalPaid: number;
  totalOverdue: number;
}

const VALID_CATEGORIES: PayableCategory[] = [
  "agua",
  "energia",
  "material",
  "aluguel",
  "salario",
  "impostos",
  "servicos",
  "outros",
];
const VALID_STATUSES: PayableStatus[] = ["pending", "paid", "overdue"];

const toRecord = (v: unknown) =>
  !v || typeof v !== "object" || Array.isArray(v)
    ? null
    : (v as Record<string, unknown>);
const toStr = (v: unknown, fb = "") => (typeof v === "string" ? v : fb);
const toNum = (v: unknown, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const normalizePayable = (raw: unknown): AccountPayable | null => {
  const item = toRecord(raw);
  if (!item) return null;
  const id = toStr(item.id).trim();
  if (!id) return null;
  return {
    id,
    description: toStr(item.description),
    category: VALID_CATEGORIES.includes(item.category as PayableCategory)
      ? (item.category as PayableCategory)
      : "outros",
    amount: toNum(item.amount),
    dueDate: toStr(item.dueDate),
    paidAt: typeof item.paidAt === "string" ? item.paidAt : null,
    status: VALID_STATUSES.includes(item.status as PayableStatus)
      ? (item.status as PayableStatus)
      : "pending",
    supplier: typeof item.supplier === "string" ? item.supplier : null,
    notes: typeof item.notes === "string" ? item.notes : null,
    recurrent: item.recurrent === true,
    createdAt: toStr(item.createdAt),
    updatedAt: toStr(item.updatedAt),
  };
};

export async function listPayables(status?: string): Promise<AccountPayable[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const raw = await request(`/accounts-payable${query}`);
  return parseCollection(raw, normalizePayable);
}

export async function getPayableSummary(): Promise<PayableSummary> {
  const raw = await request("/accounts-payable/summary");
  const item = toRecord(raw);
  const data = toRecord(item?.data ?? raw);
  return {
    totalPending: toNum(data?.totalPending),
    totalPaid: toNum(data?.totalPaid),
    totalOverdue: toNum(data?.totalOverdue),
  };
}

export async function createPayable(input: {
  description: string;
  category: PayableCategory;
  amount: number;
  dueDate: string;
  supplier?: string | null;
  notes?: string | null;
  recurrent?: boolean;
}): Promise<AccountPayable> {
  const raw = await request("/accounts-payable", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const item = toRecord(raw);
  return normalizePayable(item?.data ?? raw)!;
}

export async function updatePayable(
  id: string,
  input: Partial<{
    status: PayableStatus;
    paidAt: string | null;
    dueDate: string;
    amount: number;
    description: string;
    notes: string | null;
  }>,
): Promise<AccountPayable> {
  const raw = await request(`/accounts-payable/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const item = toRecord(raw);
  return normalizePayable(item?.data ?? raw)!;
}

export async function deletePayable(id: string): Promise<void> {
  await request(`/accounts-payable/${id}`, { method: "DELETE" });
}
