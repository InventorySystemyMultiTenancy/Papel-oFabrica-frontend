import { parseCollection, request } from "@/services/api";

export interface WasteRecord {
  id: string;
  recordDate: string;
  weightKg: number;
  description: string | null;
  sold: boolean;
  saleAmount: number | null;
  soldAt: string | null;
  buyer: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface WasteSummary {
  totalWeightKg: number;
  totalSold: number;
  totalRevenue: number;
  pendingSaleWeightKg: number;
}

const toRecord = (v: unknown) =>
  !v || typeof v !== "object" || Array.isArray(v)
    ? null
    : (v as Record<string, unknown>);
const toStr = (v: unknown, fb = "") => (typeof v === "string" ? v : fb);
const toNum = (v: unknown, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const normalizeWaste = (raw: unknown): WasteRecord | null => {
  const item = toRecord(raw);
  if (!item) return null;
  const id = toStr(item.id).trim();
  if (!id) return null;
  return {
    id,
    recordDate: toStr(item.recordDate),
    weightKg: toNum(item.weightKg),
    description: typeof item.description === "string" ? item.description : null,
    sold: item.sold === true,
    saleAmount: item.saleAmount != null ? toNum(item.saleAmount) : null,
    soldAt: typeof item.soldAt === "string" ? item.soldAt : null,
    buyer: typeof item.buyer === "string" ? item.buyer : null,
    notes: typeof item.notes === "string" ? item.notes : null,
    createdAt: toStr(item.createdAt),
    updatedAt: toStr(item.updatedAt),
  };
};

export async function listWasteRecords(): Promise<WasteRecord[]> {
  const raw = await request("/waste");
  return parseCollection(raw, normalizeWaste);
}

export async function getWasteSummary(): Promise<WasteSummary> {
  const raw = await request("/waste/summary");
  const item = toRecord(raw);
  const data = toRecord(item?.data ?? raw);
  return {
    totalWeightKg: toNum(data?.totalWeightKg),
    totalSold: toNum(data?.totalSold),
    totalRevenue: toNum(data?.totalRevenue),
    pendingSaleWeightKg: toNum(data?.pendingSaleWeightKg),
  };
}

export async function createWasteRecord(input: {
  weightKg: number;
  recordDate?: string;
  description?: string | null;
  sold?: boolean;
  saleAmount?: number | null;
  buyer?: string | null;
  notes?: string | null;
}): Promise<WasteRecord> {
  const raw = await request("/waste", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const item = toRecord(raw);
  return normalizeWaste(item?.data ?? raw)!;
}

export async function updateWasteRecord(
  id: string,
  input: {
    sold?: boolean;
    saleAmount?: number | null;
    buyer?: string | null;
    weightKg?: number;
    notes?: string | null;
  },
): Promise<WasteRecord> {
  const raw = await request(`/waste/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const item = toRecord(raw);
  return normalizeWaste(item?.data ?? raw)!;
}

export async function deleteWasteRecord(id: string): Promise<void> {
  await request(`/waste/${id}`, { method: "DELETE" });
}
