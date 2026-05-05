import { request } from "@/services/api";

export interface QuotationInput {
  comprimentoMm: number;
  larguraMm: number;
  alturaMm: number;
  gramatura: number;
  numCores?: number;
  precoPorKg: number;
  custoPorCorUnidade?: number;
  custoFixoLote?: number;
  margemPercent?: number;
  sheetWidthMm?: number;
  sheetHeightMm?: number;
  lossFactor?: number;
  quantities: number[];
}

export interface QuantityBreakdown {
  quantity: number;
  sheetsNeeded: number;
  totalWeightKg: number;
  materialCost: number;
  printingCost: number;
  fixedCost: number;
  totalCost: number;
  salePrice: number;
  unitCost: number;
  unitSalePrice: number;
  grossMarginPercent: number;
}

export interface QuotationResult {
  input: QuotationInput;
  blankWidthMm: number;
  blankHeightMm: number;
  piecesPerSheet: number;
  sheetWeightKg: number;
  breakdowns: QuantityBreakdown[];
}

const toRecord = (v: unknown) =>
  !v || typeof v !== "object" || Array.isArray(v)
    ? null
    : (v as Record<string, unknown>);
const toNum = (v: unknown, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

export async function calculateQuotation(
  input: QuotationInput,
): Promise<QuotationResult> {
  const raw = await request("/pricing/quotation", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const item = toRecord(raw);
  const data = toRecord(item?.data ?? raw);
  if (!data) throw new Error("Resposta inválida do servidor");
  return {
    input: (data.input as QuotationInput) ?? input,
    blankWidthMm: toNum(data.blankWidthMm),
    blankHeightMm: toNum(data.blankHeightMm),
    piecesPerSheet: toNum(data.piecesPerSheet),
    sheetWeightKg: toNum(data.sheetWeightKg),
    breakdowns: Array.isArray(data.breakdowns)
      ? ((data.breakdowns as unknown[])
          .map((b) => {
            const br = toRecord(b);
            if (!br) return null;
            return {
              quantity: toNum(br.quantity),
              sheetsNeeded: toNum(br.sheetsNeeded),
              totalWeightKg: toNum(br.totalWeightKg),
              materialCost: toNum(br.materialCost),
              printingCost: toNum(br.printingCost),
              fixedCost: toNum(br.fixedCost),
              totalCost: toNum(br.totalCost),
              salePrice: toNum(br.salePrice),
              unitCost: toNum(br.unitCost),
              unitSalePrice: toNum(br.unitSalePrice),
              grossMarginPercent: toNum(br.grossMarginPercent),
            } satisfies QuantityBreakdown;
          })
          .filter(Boolean) as QuantityBreakdown[])
      : [],
  };
}
