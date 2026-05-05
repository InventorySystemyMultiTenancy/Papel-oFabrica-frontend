import { request, parseCollection } from "@/services/api";

export interface ConsignedStockItem {
  id: string;
  clientId: string | null;
  clientName?: string;
  productName: string;
  quantity: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConsignedMovement {
  id: string;
  consignedStockId: string;
  movementType: "entrada" | "saida";
  quantity: number;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

export type UpsertConsignedStockInput = {
  clientId: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  notes?: string | null;
  productDescription?: string;
};

export type AddConsignedMovementInput = {
  movementType: "entrada" | "saida";
  quantity: number;
  reference?: string | null;
  notes?: string | null;
  performedBy?: string | null;
  type?: "entrada" | "saida";
};

function normalizeItem(raw: Record<string, unknown>): ConsignedStockItem {
  return {
    id: raw.id as string,
    clientId: (raw.client_id ?? raw.clientId ?? null) as string | null,
    clientName: (raw.client_name ?? raw.clientName ?? undefined) as
      | string
      | undefined,
    productName: (raw.product_name ??
      raw.productName ??
      raw.product_description ??
      raw.productDescription) as string,
    quantity: Number(raw.quantity),
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
    movementType: (raw.movement_type ?? raw.movementType ?? raw.type) as
      | "entrada"
      | "saida",
    quantity: Number(raw.quantity),
    reference: (raw.reference ??
      raw.performed_by ??
      raw.performedBy ??
      null) as string | null,
    notes: (raw.notes ?? null) as string | null,
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
  const payload = {
    clientId: input.clientId,
    productId: input.productId ?? null,
    productName: input.productName ?? input.productDescription ?? "",
    notes: input.notes ?? null,
  };

  const data = await request("/consigned-stock", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeItem(data as Record<string, unknown>);
}

export async function addConsignedMovement(
  id: string,
  input: AddConsignedMovementInput,
): Promise<ConsignedMovement> {
  const payload = {
    movementType: input.movementType ?? input.type,
    quantity: input.quantity,
    reference: input.reference ?? input.performedBy ?? null,
    notes: input.notes ?? null,
  };

  const data = await request(`/consigned-stock/${id}/movements`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeMovement(data as Record<string, unknown>);
}

export async function getConsignedMovements(
  id: string,
): Promise<ConsignedMovement[]> {
  const data = await request(`/consigned-stock/${id}/movements`);
  return parseCollection(data).map(normalizeMovement);
}
