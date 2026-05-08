import { parseCollection, request } from "@/services/api";

export interface Product {
  id: string;
  name: string;
  stockQuantity: number;
  lowStockAlertQuantity: number;
  stockStatus: "em_estoque" | "precisa_comprar";
  isPaperboardMaterial: boolean;
  gramatura: number | null;
  sheetsPerBundle: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  quality: "CMCB" | "CMCBC" | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  name: string;
  stockQuantity: number;
  lowStockAlertQuantity: number;
  isPaperboardMaterial?: boolean;
  gramatura?: number | null;
  sheetsPerBundle?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  quality?: "CMCB" | "CMCBC" | null;
}

export interface UpdateProductInput {
  name: string;
  lowStockAlertQuantity: number;
  isPaperboardMaterial?: boolean;
  gramatura?: number | null;
  sheetsPerBundle?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  quality?: "CMCB" | "CMCBC" | null;
}

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const toStringSafe = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const toNumberSafe = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeProduct = (value: unknown): Product | null => {
  const item = toRecord(value);

  if (!item) {
    return null;
  }

  const id = toStringSafe(item.id, "").trim();
  const name = toStringSafe(item.name, "").trim();

  if (!id || !name) {
    return null;
  }

  const stockQty = toNumberSafe(item.stockQuantity ?? item.stock_quantity ?? item.stock, 0);
  const lowStockAlertQty = toNumberSafe(
    item.lowStockAlertQuantity ??
      item.low_stock_alert_quantity ??
      item.minStock ??
      item.min_stock ??
      item.minimumStock ??
      item.minimum_stock,
    0,
  );
  const rawStockStatus = item.stockStatus ?? item.stock_status;
  const stockStatus: Product["stockStatus"] =
    rawStockStatus === "precisa_comprar" ? "precisa_comprar" : "em_estoque";
  const isPaperboardMaterial = typeof item.isPaperboardMaterial === "boolean" ? item.isPaperboardMaterial : false;
  const gramaturaRaw = item.gramatura;
  const gramatura = gramaturaRaw !== null && gramaturaRaw !== undefined ? toNumberSafe(gramaturaRaw) : null;
  const sheetsRaw = item.sheetsPerBundle;
  const sheetsPerBundle = sheetsRaw !== null && sheetsRaw !== undefined ? toNumberSafe(sheetsRaw) : null;
  const lengthRaw = item.length ?? item.comprimento ?? item.comprimentoMm ?? item.comprimento_mm;
  const widthRaw = item.width ?? item.largura ?? item.larguraMm ?? item.largura_mm;
  const heightRaw = item.height ?? item.altura ?? item.alturaMm ?? item.altura_mm;
  const qualityRaw = item.quality ?? item.qualidade;
  const quality: Product["quality"] =
    qualityRaw === "CMCB" || qualityRaw === "CMCBC" ? qualityRaw : null;

  return {
    id,
    name,
    stockQuantity: stockQty,
    lowStockAlertQuantity: lowStockAlertQty,
    stockStatus,
    isPaperboardMaterial,
    gramatura,
    sheetsPerBundle,
    length: lengthRaw !== null && lengthRaw !== undefined ? toNumberSafe(lengthRaw) : null,
    width: widthRaw !== null && widthRaw !== undefined ? toNumberSafe(widthRaw) : null,
    height: heightRaw !== null && heightRaw !== undefined ? toNumberSafe(heightRaw) : null,
    quality,
    createdAt: toStringSafe(item.createdAt ?? item.created_at, ""),
    updatedAt: toStringSafe(item.updatedAt ?? item.updated_at, ""),
  };
};

const unwrapDataEnvelope = (payload: unknown) => {
  const record = toRecord(payload);

  if (!record) {
    return payload;
  }

  if (record.data !== undefined) {
    return record.data;
  }

  return payload;
};

const ensureProduct = (payload: unknown, fallbackMessage: string) => {
  const normalized = normalizeProduct(unwrapDataEnvelope(payload));

  if (!normalized) {
    throw new Error(fallbackMessage);
  }

  return normalized;
};

const toCreatePayload = (input: CreateProductInput) => ({
  name: input.name.trim(),
  stockQuantity: toNumberSafe(input.stockQuantity, 0),
  lowStockAlertQuantity: Math.max(0, Math.trunc(toNumberSafe(input.lowStockAlertQuantity, 0))),
  low_stock_alert_quantity: Math.max(0, Math.trunc(toNumberSafe(input.lowStockAlertQuantity, 0))),
  minStock: Math.max(0, Math.trunc(toNumberSafe(input.lowStockAlertQuantity, 0))),
  min_stock: Math.max(0, Math.trunc(toNumberSafe(input.lowStockAlertQuantity, 0))),
  isPaperboardMaterial: input.isPaperboardMaterial ?? false,
  gramatura: input.gramatura ?? null,
  sheetsPerBundle: input.sheetsPerBundle ?? null,
  length: input.length ?? null,
  width: input.width ?? null,
  height: input.height ?? null,
  quality: input.quality ?? null,
});

const toUpdatePayload = (input: UpdateProductInput) => ({
  name: input.name.trim(),
  lowStockAlertQuantity: Math.max(0, Math.trunc(toNumberSafe(input.lowStockAlertQuantity, 0))),
  low_stock_alert_quantity: Math.max(0, Math.trunc(toNumberSafe(input.lowStockAlertQuantity, 0))),
  minStock: Math.max(0, Math.trunc(toNumberSafe(input.lowStockAlertQuantity, 0))),
  min_stock: Math.max(0, Math.trunc(toNumberSafe(input.lowStockAlertQuantity, 0))),
  isPaperboardMaterial: input.isPaperboardMaterial ?? false,
  gramatura: input.gramatura ?? null,
  sheetsPerBundle: input.sheetsPerBundle ?? null,
  length: input.length ?? null,
  width: input.width ?? null,
  height: input.height ?? null,
  quality: input.quality ?? null,
});

const buildProductsPath = (search?: string) => {
  const query = search?.trim();

  if (!query) {
    return "/products";
  }

  return `/products?search=${encodeURIComponent(query)}`;
};

export const listProducts = async (search?: string) => {
  const payload = await request<unknown>(buildProductsPath(search));
  const unwrapped = unwrapDataEnvelope(payload);

  if (Array.isArray(unwrapped)) {
    return unwrapped
      .map(normalizeProduct)
      .filter((item): item is Product => Boolean(item));
  }

  const collection = parseCollection<unknown>(payload)
    .map(normalizeProduct)
    .filter((item): item is Product => Boolean(item));

  if (collection.length > 0) {
    return collection;
  }

  const maybeSingle = normalizeProduct(unwrapped);
  return maybeSingle ? [maybeSingle] : [];
};

export const getProductById = async (id: string) => {
  const payload = await request<unknown>(`/products/${id}`);
  return ensureProduct(payload, "Nao foi possivel carregar o produto.");
};

export const createProduct = async (input: CreateProductInput) => {
  const payload = await request<unknown>("/products", {
    method: "POST",
    body: JSON.stringify(toCreatePayload(input)),
  });

  return ensureProduct(payload, "Nao foi possivel criar o produto.");
};

export const updateProduct = async (id: string, input: UpdateProductInput) => {
  const payload = await request<unknown>(`/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(toUpdatePayload(input)),
  });

  return ensureProduct(payload, "Nao foi possivel atualizar o produto.");
};
