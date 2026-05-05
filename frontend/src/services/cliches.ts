import { parseCollection, request } from "@/services/api";

export interface Cliche {
  id: string;
  clientId: string;
  clientName?: string;
  name: string;
  colors: number;
  widthCm: number | null;
  heightCm: number | null;
  cost: number;
  paid: boolean;
  paidAt: string | null;
  notes: string | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface CreateClicheInput {
  clientId: string;
  name: string;
  colors?: number;
  widthCm?: number | null;
  heightCm?: number | null;
  cost?: number;
  paid?: boolean;
  notes?: string | null;
}

export interface UpdateClicheInput {
  name?: string;
  colors?: number;
  widthCm?: number | null;
  heightCm?: number | null;
  cost?: number;
  paid?: boolean;
  notes?: string | null;
  status?: "active" | "inactive";
}

const toRecord = (v: unknown): Record<string, unknown> | null => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
};
const toStr = (v: unknown, fb = "") => (typeof v === "string" ? v : fb);
const toNum = (v: unknown, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const toBool = (v: unknown) => v === true || v === "true";

const normalizeCliche = (raw: unknown): Cliche | null => {
  const item = toRecord(raw);
  if (!item) return null;
  const id = toStr(item.id).trim();
  if (!id) return null;
  return {
    id,
    clientId: toStr(item.clientId),
    clientName:
      typeof item.clientName === "string" ? item.clientName : undefined,
    name: toStr(item.name),
    colors: toNum(item.colors, 1),
    widthCm: item.widthCm != null ? toNum(item.widthCm) : null,
    heightCm: item.heightCm != null ? toNum(item.heightCm) : null,
    cost: toNum(item.cost),
    paid: toBool(item.paid),
    paidAt: typeof item.paidAt === "string" ? item.paidAt : null,
    notes: typeof item.notes === "string" ? item.notes : null,
    status: item.status === "inactive" ? "inactive" : "active",
    createdAt: toStr(item.createdAt),
    updatedAt: toStr(item.updatedAt),
  };
};

export async function listCliches(clientId?: string): Promise<Cliche[]> {
  const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
  const raw = await request(`/cliches${query}`);
  return parseCollection(raw, normalizeCliche);
}

export async function createCliche(input: CreateClicheInput): Promise<Cliche> {
  const raw = await request("/cliches", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const item = toRecord(raw);
  return normalizeCliche(item?.data ?? raw)!;
}

export async function updateCliche(
  id: string,
  input: UpdateClicheInput,
): Promise<Cliche> {
  const raw = await request(`/cliches/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const item = toRecord(raw);
  return normalizeCliche(item?.data ?? raw)!;
}

export async function deleteCliche(id: string): Promise<void> {
  await request(`/cliches/${id}`, { method: "DELETE" });
}
