import { parseCollection, request } from "@/services/api";

export interface ShipmentItem {
  id: string;
  shipmentId: string;
  orderItemId: string;
  quantity: number;
}

export interface Shipment {
  id: string;
  orderId: string;
  notes: string | null;
  shippedAt: string;
  items: ShipmentItem[];
  createdAt: string;
}

export interface CreateShipmentInput {
  orderId: string;
  notes?: string;
  shippedAt?: string;
  items: Array<{ orderItemId: string; quantity: number }>;
}

const toRecord = (v: unknown): Record<string, unknown> | null => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
};

const toStr = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const toNum = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeShipmentItem = (raw: unknown): ShipmentItem | null => {
  const item = toRecord(raw);
  if (!item) return null;
  const id = toStr(item.id, "").trim();
  if (!id) return null;
  return {
    id,
    shipmentId: toStr(item.shipmentId),
    orderItemId: toStr(item.orderItemId),
    quantity: toNum(item.quantity),
  };
};

const normalizeShipment = (raw: unknown): Shipment | null => {
  const item = toRecord(raw);
  if (!item) return null;
  const id = toStr(item.id, "").trim();
  if (!id) return null;
  const rawItems = Array.isArray(item.items) ? item.items : [];
  return {
    id,
    orderId: toStr(item.orderId),
    notes: typeof item.notes === "string" ? item.notes : null,
    shippedAt: toStr(item.shippedAt),
    items: rawItems.map(normalizeShipmentItem).filter((x): x is ShipmentItem => x !== null),
    createdAt: toStr(item.createdAt),
  };
};

export const listShipments = async (orderId: string): Promise<Shipment[]> => {
  const payload = await request<unknown>(`/orders/${orderId}/shipments`);
  return parseCollection<unknown>(payload)
    .map(normalizeShipment)
    .filter((x): x is Shipment => x !== null);
};

export const getShipment = async (id: string): Promise<Shipment> => {
  const payload = await request<unknown>(`/shipments/${id}`);
  const normalized = normalizeShipment(payload);
  if (!normalized) throw new Error("Resposta inválida ao buscar expedição.");
  return normalized;
};

export const createShipment = async (input: CreateShipmentInput): Promise<Shipment> => {
  const payload = await request<unknown>("/shipments", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const normalized = normalizeShipment(payload);
  if (!normalized) throw new Error("Resposta inválida ao registrar expedição.");
  return normalized;
};
