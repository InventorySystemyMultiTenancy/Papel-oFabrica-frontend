import { parseCollection, request } from "@/services/api";

export type RouteStatus = "pending" | "in_transit" | "completed" | "cancelled";
export type RouteItemStatus = "pending" | "delivered" | "failed";

export interface DeliveryRouteItem {
  id: string;
  routeId: string;
  shipmentId: string | null;
  clientId: string | null;
  clientName: string;
  address: string;
  quantity: number;
  deliveredAt: string | null;
  receivedBy: string | null;
  deliveryNotes: string | null;
  status: RouteItemStatus;
  sortOrder: number;
}

export interface DeliveryRoute {
  id: string;
  name: string;
  driverName: string | null;
  vehicle: string | null;
  scheduledDate: string;
  departureAt: string | null;
  completedAt: string | null;
  status: RouteStatus;
  notes: string | null;
  items: DeliveryRouteItem[];
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

const normalizeItem = (raw: unknown): DeliveryRouteItem | null => {
  const item = toRecord(raw);
  if (!item) return null;
  return {
    id: toStr(item.id),
    routeId: toStr(item.routeId),
    shipmentId: typeof item.shipmentId === "string" ? item.shipmentId : null,
    clientId: typeof item.clientId === "string" ? item.clientId : null,
    clientName: toStr(item.clientName),
    address: toStr(item.address),
    quantity: toNum(item.quantity),
    deliveredAt: typeof item.deliveredAt === "string" ? item.deliveredAt : null,
    receivedBy: typeof item.receivedBy === "string" ? item.receivedBy : null,
    deliveryNotes:
      typeof item.deliveryNotes === "string" ? item.deliveryNotes : null,
    status: (item.status as RouteItemStatus) ?? "pending",
    sortOrder: toNum(item.sortOrder),
  };
};

const normalizeRoute = (raw: unknown): DeliveryRoute | null => {
  const item = toRecord(raw);
  if (!item) return null;
  const id = toStr(item.id).trim();
  if (!id) return null;
  return {
    id,
    name: toStr(item.name),
    driverName: typeof item.driverName === "string" ? item.driverName : null,
    vehicle: typeof item.vehicle === "string" ? item.vehicle : null,
    scheduledDate: toStr(item.scheduledDate),
    departureAt: typeof item.departureAt === "string" ? item.departureAt : null,
    completedAt: typeof item.completedAt === "string" ? item.completedAt : null,
    status: (item.status as RouteStatus) ?? "pending",
    notes: typeof item.notes === "string" ? item.notes : null,
    items: Array.isArray(item.items)
      ? ((item.items as unknown[])
          .map(normalizeItem)
          .filter(Boolean) as DeliveryRouteItem[])
      : [],
    createdAt: toStr(item.createdAt),
    updatedAt: toStr(item.updatedAt),
  };
};

export async function listDeliveryRoutes(): Promise<DeliveryRoute[]> {
  const raw = await request("/delivery-routes");
  return parseCollection(raw, normalizeRoute);
}

export async function createDeliveryRoute(input: {
  name: string;
  driverName?: string | null;
  vehicle?: string | null;
  scheduledDate: string;
  notes?: string | null;
  items: Array<{
    clientName: string;
    address: string;
    quantity: number;
    clientId?: string | null;
    shipmentId?: string | null;
    sortOrder?: number;
  }>;
}): Promise<DeliveryRoute> {
  const raw = await request("/delivery-routes", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const item = toRecord(raw);
  return normalizeRoute(item?.data ?? raw)!;
}

export async function updateDeliveryRoute(
  id: string,
  input: {
    status?: RouteStatus;
    driverName?: string | null;
    vehicle?: string | null;
    scheduledDate?: string;
    notes?: string | null;
  },
): Promise<DeliveryRoute> {
  const raw = await request(`/delivery-routes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const item = toRecord(raw);
  return normalizeRoute(item?.data ?? raw)!;
}

export async function confirmDeliveryItem(
  routeId: string,
  itemId: string,
  input: {
    receivedBy: string;
    deliveryNotes?: string | null;
    status?: RouteItemStatus;
  },
): Promise<DeliveryRouteItem> {
  const raw = await request(
    `/delivery-routes/${routeId}/items/${itemId}/confirm`,
    { method: "POST", body: JSON.stringify(input) },
  );
  const item = toRecord(raw);
  return normalizeItem(item?.data ?? raw)!;
}

export async function deleteDeliveryRoute(id: string): Promise<void> {
  await request(`/delivery-routes/${id}`, { method: "DELETE" });
}
