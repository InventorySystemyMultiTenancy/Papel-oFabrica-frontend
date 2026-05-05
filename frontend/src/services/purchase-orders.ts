import { parseCollection, request } from "@/services/api";

export type PurchaseOrderStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "received"
  | "cancelled";

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string | null;
  description: string;
  gramatura: number | null;
  sheetWidthCm: number | null;
  sheetLengthCm: number | null;
  quantityKg: number;
  unitPricePerKg: number | null;
  totalPrice: number | null;
  receivedKg: number;
  notes: string | null;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: number;
  supplier: string;
  status: PurchaseOrderStatus;
  totalAmount: number;
  notes: string | null;
  expectedDeliveryDate: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  items: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
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

const normalizeItem = (raw: unknown): PurchaseOrderItem | null => {
  const item = toRecord(raw);
  if (!item) return null;
  return {
    id: toStr(item.id),
    purchaseOrderId: toStr(item.purchaseOrderId),
    productId: typeof item.productId === "string" ? item.productId : null,
    description: toStr(item.description),
    gramatura: item.gramatura != null ? toNum(item.gramatura) : null,
    sheetWidthCm: item.sheetWidthCm != null ? toNum(item.sheetWidthCm) : null,
    sheetLengthCm:
      item.sheetLengthCm != null ? toNum(item.sheetLengthCm) : null,
    quantityKg: toNum(item.quantityKg),
    unitPricePerKg:
      item.unitPricePerKg != null ? toNum(item.unitPricePerKg) : null,
    totalPrice: item.totalPrice != null ? toNum(item.totalPrice) : null,
    receivedKg: toNum(item.receivedKg),
    notes: typeof item.notes === "string" ? item.notes : null,
  };
};

const normalizePO = (raw: unknown): PurchaseOrder | null => {
  const item = toRecord(raw);
  if (!item) return null;
  const id = toStr(item.id).trim();
  if (!id) return null;
  return {
    id,
    orderNumber: toNum(item.orderNumber),
    supplier: toStr(item.supplier),
    status: (item.status as PurchaseOrderStatus) ?? "draft",
    totalAmount: toNum(item.totalAmount),
    notes: typeof item.notes === "string" ? item.notes : null,
    expectedDeliveryDate:
      typeof item.expectedDeliveryDate === "string"
        ? item.expectedDeliveryDate
        : null,
    sentAt: typeof item.sentAt === "string" ? item.sentAt : null,
    receivedAt: typeof item.receivedAt === "string" ? item.receivedAt : null,
    items: Array.isArray(item.items)
      ? ((item.items as unknown[])
          .map(normalizeItem)
          .filter(Boolean) as PurchaseOrderItem[])
      : [],
    createdAt: toStr(item.createdAt),
    updatedAt: toStr(item.updatedAt),
  };
};

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  const raw = await request("/purchase-orders");
  return parseCollection(raw, normalizePO);
}

export async function createPurchaseOrder(input: {
  supplier: string;
  expectedDeliveryDate?: string | null;
  notes?: string | null;
  items: Array<{
    description: string;
    quantityKg: number;
    gramatura?: number | null;
    unitPricePerKg?: number | null;
    sheetWidthCm?: number | null;
    sheetLengthCm?: number | null;
    productId?: string | null;
    notes?: string | null;
  }>;
}): Promise<PurchaseOrder> {
  const raw = await request("/purchase-orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const item = toRecord(raw);
  return normalizePO(item?.data ?? raw)!;
}

export async function updatePurchaseOrder(
  id: string,
  input: {
    status?: PurchaseOrderStatus;
    supplier?: string;
    notes?: string | null;
    expectedDeliveryDate?: string | null;
  },
): Promise<PurchaseOrder> {
  const raw = await request(`/purchase-orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const item = toRecord(raw);
  return normalizePO(item?.data ?? raw)!;
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  await request(`/purchase-orders/${id}`, { method: "DELETE" });
}
