export interface QuotationInput {
  comprimentoMm: number;
  larguraMm: number;
  alturaMm: number;
  quality: "CMCB" | "CMCBC";
  gramatura: number;
  precoPorKg: number;
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

const PAPERBOARD_PRICE_PER_KG = 14;

const PAPERBOARD_QUALITY_GRAMMAGE: Record<QuotationInput["quality"], number> = {
  CMCB: 511,
  CMCBC: 651,
};

const calculateBlankFromSpreadsheet = (
  length: number,
  width: number,
  height: number,
  quality: QuotationInput["quality"],
) => {
  const isCmcbc = quality === "CMCBC";
  const blankWidthMm =
    width +
    (isCmcbc ? 6 : 2) +
    length +
    (isCmcbc ? 7 : 3) +
    width +
    (isCmcbc ? 7 : 3) +
    length +
    (isCmcbc ? 6 : 2) +
    (isCmcbc ? 40 : 35);
  const blankHeightMm =
    width / 2 +
    (isCmcbc ? 6 : 2) +
    height +
    (isCmcbc ? 12 : 5) +
    width / 2 +
    (isCmcbc ? 6 : 2);

  return {
    blankWidthMm,
    blankHeightMm,
    areaM2: (blankWidthMm / 1000) * (blankHeightMm / 1000),
  };
};

export async function calculateQuotation(
  input: QuotationInput,
): Promise<QuotationResult> {
  const length = Number(input.comprimentoMm);
  const width = Number(input.larguraMm);
  const height = Number(input.alturaMm);
  const quality = input.quality === "CMCB" ? "CMCB" : "CMCBC";
  const gramatura = PAPERBOARD_QUALITY_GRAMMAGE[quality];

  if (length <= 0 || width <= 0 || height <= 0) {
    throw new Error("Informe dimensoes validas para calcular a cotacao.");
  }

  const { blankWidthMm, blankHeightMm, areaM2 } =
    calculateBlankFromSpreadsheet(length, width, height, quality);
  const unitWeightKg = areaM2 * (gramatura / 1000);
  const unitPrice = unitWeightKg * PAPERBOARD_PRICE_PER_KG;

  return {
    input: {
      ...input,
      quality,
      gramatura,
      precoPorKg: PAPERBOARD_PRICE_PER_KG,
    },
    blankWidthMm,
    blankHeightMm,
    piecesPerSheet: 1,
    sheetWeightKg: unitWeightKg,
    breakdowns: input.quantities.map((quantity) => {
      const totalWeightKg = unitWeightKg * quantity;
      const total = unitPrice * quantity;

      return {
        quantity,
        sheetsNeeded: quantity,
        totalWeightKg,
        materialCost: total,
        printingCost: 0,
        fixedCost: 0,
        totalCost: total,
        salePrice: total,
        unitCost: unitPrice,
        unitSalePrice: unitPrice,
        grossMarginPercent: 0,
      };
    }),
  };
}
