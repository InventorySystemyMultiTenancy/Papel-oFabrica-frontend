import { parseCollection, request } from "@/services/api";

export type OrderStatus = "production" | "partial" | "completed";

export interface OrderItem {
  id: string;
  orderId: string;
  budgetItemId: string | null;
  description: string;
  quantityTotal: number;
  quantityProduced: number;
  quantityShipped: number;
  remaining: number;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  budgetId: string;
  status: OrderStatus;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderInput {
  budgetId: string;
  items: Array<{
    budgetItemId?: string;
    description: string;
    quantityTotal: number;
  }>;
}

export interface ListOrdersParams {
  status?: OrderStatus;
  budgetId?: string;
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

const normalizeStatus = (v: unknown): OrderStatus => {
  if (v === "partial" || v === "completed") return v;
  return "production";
};

const normalizeItem = (raw: unknown): OrderItem | null => {
  const item = toRecord(raw);
  if (!item) return null;
  const id = toStr(item.id, "").trim();
  if (!id) return null;
  return {
    id,
    orderId: toStr(item.orderId),
    budgetItemId: typeof item.budgetItemId === "string" ? item.budgetItemId : null,
    description: toStr(item.description),
    quantityTotal: toNum(item.quantityTotal),
    quantityProduced: toNum(item.quantityProduced),
    quantityShipped: toNum(item.quantityShipped),
    remaining: toNum(item.remaining),
    createdAt: toStr(item.createdAt),
    updatedAt: toStr(item.updatedAt),
  };
};

const normalizeOrder = (raw: unknown): Order | null => {
  const item = toRecord(raw);
  if (!item) return null;
  const id = toStr(item.id, "").trim();
  if (!id) return null;
  const rawItems = Array.isArray(item.items) ? item.items : [];
  return {
    id,
    budgetId: toStr(item.budgetId),
    status: normalizeStatus(item.status),
    items: rawItems.map(normalizeItem).filter((x): x is OrderItem => x !== null),
    createdAt: toStr(item.createdAt),
    updatedAt: toStr(item.updatedAt),
  };
};

export const listOrders = async (params?: ListOrdersParams): Promise<Order[]> => {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.budgetId) query.set("budgetId", params.budgetId);
  const qs = query.toString();
  const payload = await request<unknown>(`/orders${qs ? `?${qs}` : ""}`);
  return parseCollection<unknown>(payload)
    .map(normalizeOrder)
    .filter((x): x is Order => x !== null);
};

export const getOrder = async (id: string): Promise<Order> => {
  const payload = await request<unknown>(`/orders/${id}`);
  const normalized = normalizeOrder(payload);
  if (!normalized) throw new Error("Resposta inválida ao buscar pedido.");
  return normalized;
};

export const createOrder = async (input: CreateOrderInput): Promise<Order> => {
  const payload = await request<unknown>("/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const normalized = normalizeOrder(payload);
  if (!normalized) throw new Error("Resposta inválida ao criar pedido.");
  return normalized;
};

export const updateItemProduced = async (
  orderId: string,
  itemId: string,
  quantityProduced: number,
): Promise<OrderItem> => {
  const payload = await request<unknown>(`/orders/${orderId}/items/${itemId}/produced`, {
    method: "PATCH",
    body: JSON.stringify({ quantityProduced }),
  });
  const item = normalizeItem(payload);
  if (!item) throw new Error("Resposta inválida ao atualizar quantidade produzida.");
  return item;
};
