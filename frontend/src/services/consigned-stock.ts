import { request, parseCollection } from "@/services/api";

export interface ConsignedStockItem {
  id: string;
  clientId: string | null;
  clientName?: string;
  productDescription: string;
  quantity: number;
  unit: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConsignedMovement {
  id: string;
  consignedStockId: string;
  type: "entrada" | "saida";
  quantity: number;
  notes: string | null;
  performedBy: string | null;
  createdAt: string;
}

export type UpsertConsignedStockInput = {
  clientId?: string | null;
  productDescription: string;
  quantity: number;
  unit?: string;
  notes?: string | null;
};

export type AddConsignedMovementInput = {
  type: "entrada" | "saida";
  quantity: number;
  notes?: string | null;
  performedBy?: string | null;
};

function normalizeItem(raw: Record<string, unknown>): ConsignedStockItem {
  return {
    id: raw.id as string,
    clientId: (raw.client_id ?? raw.clientId ?? null) as string | null,
    clientName: (raw.client_name ?? raw.clientName ?? undefined) as
      | string
      | undefined,
    productDescription: (raw.product_description ??
      raw.productDescription) as string,
    quantity: Number(raw.quantity),
    unit: (raw.unit ?? "un") as string,
    notes: (raw.notes ?? null) as string | null,
    createdAt: (raw.created_at ?? raw.createdAt) as string,
    updatedAt: (raw.updated_at ?? raw.updatedAt) as string,
  };
}

function normalizeMovement(raw: Record<string, unknown>): ConsignedMovement {
  return {
    id: raw.id as string,
    consignedStockId: (raw.consigned_stock_id ??
      raw.consignedStockId) as string,
    type: raw.type as "entrada" | "saida",
    quantity: Number(raw.quantity),
    notes: (raw.notes ?? null) as string | null,
    performedBy: (raw.performed_by ?? raw.performedBy ?? null) as string | null,
    createdAt: (raw.created_at ?? raw.createdAt) as string,
  };
}

export async function listConsignedStock(
  clientId?: string,
): Promise<ConsignedStockItem[]> {
  const params = clientId ? `?clientId=${clientId}` : "";
  const data = await request(`/consigned-stock${params}`);
  return parseCollection(data).map(normalizeItem);
}

export async function getConsignedStockById(
  id: string,
): Promise<ConsignedStockItem> {
  const data = await request(`/consigned-stock/${id}`);
  return normalizeItem(data as Record<string, unknown>);
}

export async function upsertConsignedStock(
  input: UpsertConsignedStockInput,
): Promise<ConsignedStockItem> {
  const data = await request("/consigned-stock", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return normalizeItem(data as Record<string, unknown>);
}

export async function addConsignedMovement(
  id: string,
  input: AddConsignedMovementInput,
): Promise<ConsignedMovement> {
  const data = await request(`/consigned-stock/${id}/movements`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return normalizeMovement(data as Record<string, unknown>);
}

export async function getConsignedMovements(
  id: string,
): Promise<ConsignedMovement[]> {
  const data = await request(`/consigned-stock/${id}/movements`);
  return parseCollection(data).map(normalizeMovement);
}
