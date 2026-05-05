import { request } from "@/services/api";

export interface PaperboardConfig {
  id: string;
  budgetId: string;
  length: number;
  width: number;
  height: number;
  gramatura: number;
  quantity: number;
  usesFullSheet: boolean;
  outsourcedCut: boolean;
  isFirstPurchase: boolean;
  clicheCost: number | null;
  clichePrice: number | null;
  area: number;
  estimatedCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaperboardConfigInput {
  length: number;
  width: number;
  height: number;
  gramatura: number;
  quantity: number;
  usesFullSheet?: boolean;
  outsourcedCut?: boolean;
  isFirstPurchase?: boolean;
  clicheCost?: number | null;
  clichePrice?: number | null;
}

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const toStr = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const toNum = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const toBool = (v: unknown, fallback = false) => (typeof v === "boolean" ? v : fallback);
const toNumOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normalize = (raw: unknown): PaperboardConfig | null => {
  const item = toRecord(raw);
  if (!item) return null;
  const id = toStr(item.id, "").trim();
  const budgetId = toStr(item.budgetId, "").trim();
  if (!id || !budgetId) return null;
  return {
    id,
    budgetId,
    length: toNum(item.length),
    width: toNum(item.width),
    height: toNum(item.height),
    gramatura: toNum(item.gramatura),
    quantity: toNum(item.quantity),
    usesFullSheet: toBool(item.usesFullSheet),
    outsourcedCut: toBool(item.outsourcedCut),
    isFirstPurchase: toBool(item.isFirstPurchase),
    clicheCost: toNumOrNull(item.clicheCost),
    clichePrice: toNumOrNull(item.clichePrice),
    area: toNum(item.area),
    estimatedCost: toNum(item.estimatedCost),
    createdAt: toStr(item.createdAt),
    updatedAt: toStr(item.updatedAt),
  };
};

export const getPaperboardConfig = async (budgetId: string): Promise<PaperboardConfig | null> => {
  try {
    const payload = await request<unknown>(`/budgets/${budgetId}/paperboard`);
    return normalize(payload);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "status" in error && (error as { status: number }).status === 404) {
      return null;
    }
    throw error;
  }
};

export const upsertPaperboardConfig = async (
  budgetId: string,
  input: PaperboardConfigInput,
): Promise<PaperboardConfig> => {
  const payload = await request<unknown>(`/budgets/${budgetId}/paperboard`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  const normalized = normalize(payload);
  if (!normalized) throw new Error("Resposta inválida ao salvar configuração de papelão.");
  return normalized;
};

export const deletePaperboardConfig = async (budgetId: string): Promise<void> => {
  await request<unknown>(`/budgets/${budgetId}/paperboard`, { method: "DELETE" });
};
