import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import {
  calculateQuotation,
  type QuotationInput,
  type QuotationResult,
} from "@/services/pricing";
import {
  Calculator,
  Check,
  FileDown,
  Pencil,
  Plus,
  Trash2,
  X,
  Zap,
} from "lucide-react";

const COMPANY_NAME = "4D EMBALAGENS LTDA";
const COMPANY_ADDRESS = "Rua Benedito Passos, 160 - Vila Matilde - SP";
const COMPANY_CNPJ = "CNPJ: 62.728.414/0001-99";
const COMPANY_TEL = "Tel: (11) 2651-4292 | Cel: (11) 95266-1751";

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Falha ao converter logo para data URL."));
      }
    };

    reader.onerror = () => reject(new Error("Falha ao ler logo."));
    reader.readAsDataURL(blob);
  });

let logoDataUrlCache: string | null | undefined;

const loadLogoDataUrl = async () => {
  if (logoDataUrlCache !== undefined) {
    return logoDataUrlCache;
  }

  try {
    const response = await fetch("/4d.jpg");

    if (!response.ok) {
      logoDataUrlCache = null;
      return null;
    }

    const blob = await response.blob();
    logoDataUrlCache = await blobToDataUrl(blob);
    return logoDataUrlCache;
  } catch {
    logoDataUrlCache = null;
    return null;
  }
};

const PAPERBOARD_PRICE_PER_KG = 14;
const PAPERBOARD_QUALITY_GRAMMAGE: Record<QuotationInput["quality"], number> = {
  CMCB: 511,
  CMCBC: 651,
};

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatNum = (v: number, dec = 2) =>
  v.toLocaleString("pt-BR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

const DEFAULT_INPUT: QuotationInput = {
  comprimentoMm: 300,
  larguraMm: 200,
  alturaMm: 100,
  quality: "CMCBC",
  gramatura: PAPERBOARD_QUALITY_GRAMMAGE.CMCBC,
  precoPorKg: PAPERBOARD_PRICE_PER_KG,
  quantities: [],
};

const DEFAULT_TAX_PERCENTAGE = 28;

export default function PricingPage() {
  const { toast } = useToast();
  const [input, setInput] = useState<QuotationInput>({ ...DEFAULT_INPUT });
  const [result, setResult] = useState<QuotationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [newQty, setNewQty] = useState("");
  const [taxApplied, setTaxApplied] = useState(false);
  const [taxPercentage, setTaxPercentage] = useState(DEFAULT_TAX_PERCENTAGE);
  const [isEditingTaxPercentage, setIsEditingTaxPercentage] = useState(false);
  const [taxPercentageDraft, setTaxPercentageDraft] = useState("");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const mergeQuantity = (quantities: number[], rawValue: string) => {
    const quantity = parseInt(rawValue, 10);

    if (!quantity || quantity <= 0 || quantities.includes(quantity)) {
      return quantities;
    }

    return [...quantities, quantity].sort((a, b) => a - b);
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();

    const quantities = mergeQuantity(input.quantities, newQty);

    if (quantities.length === 0) {
      toast({
        title: "Adicione pelo menos uma quantidade",
        variant: "destructive",
      });
      return;
    }

    if (quantities !== input.quantities) {
      setInput((current) => ({ ...current, quantities }));
      setNewQty("");
    }

    setLoading(true);
    try {
      const res = await calculateQuotation({ ...input, quantities });
      setResult(res);
    } catch (e) {
      toast({
        title: "Erro no cálculo",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateQuotationPdf = async () => {
    if (!result) {
      return;
    }

    setIsGeneratingPdf(true);

    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const PW = pdf.internal.pageSize.getWidth();
      const MX = 14;
      const taxMultiplier = taxApplied ? 1 + taxPercentage / 100 : 1;
      let y = 12;

      // ── Cabeçalho: logo + dados da empresa (igual ao PDF de orçamento) ──
      const logoDataUrl = await loadLogoDataUrl();
      const LOGO_W = 28;
      const LOGO_H = 28;
      if (logoDataUrl) {
        pdf.addImage(logoDataUrl, "PNG", MX, y, LOGO_W, LOGO_H);
      }

      const compX = MX + LOGO_W + 4;
      const compW = PW - compX - MX;
      pdf.setTextColor(26, 26, 26);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(COMPANY_NAME, compX + compW, y + 5, { align: "right" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(85, 85, 85);
      pdf.text(COMPANY_ADDRESS, compX + compW, y + 10, { align: "right" });
      pdf.text(COMPANY_CNPJ, compX + compW, y + 15, { align: "right" });
      pdf.text(COMPANY_TEL, compX + compW, y + 20, { align: "right" });

      y += 34;

      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text("Cotação Rápida", PW / 2, y, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text(
        `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
        PW / 2,
        y + 5,
        { align: "center" },
      );

      y += 12;
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      const spec = (label: string, value: string, x: number) => {
        pdf.setFont("helvetica", "bold");
        pdf.text(label, x, y);
        pdf.setFont("helvetica", "normal");
        pdf.text(value, x + pdf.getTextWidth(label) + 2, y);
      };
      const colX = [MX, MX + 95];
      spec(
        "Dimensões (C x L x A):",
        `${formatNum(result.input.comprimentoMm, 0)} x ${formatNum(result.input.larguraMm, 0)} x ${formatNum(result.input.alturaMm, 0)} mm`,
        colX[0],
      );
      spec("Qualidade:", result.input.quality, colX[1]);
      y += 6;
      spec("Gramatura:", `${result.input.gramatura} g/m²`, colX[0]);
      spec("Preço por kg:", formatCurrency(result.input.precoPorKg), colX[1]);
      y += 6;
      spec(
        "Formato impressora:",
        `${formatNum(result.blankWidthMm)} mm`,
        colX[0],
      );
      spec(
        "Formato riscador:",
        `${formatNum(result.blankHeightMm)} mm`,
        colX[1],
      );
      y += 6;
      spec("Peso por caixa:", `${formatNum(result.sheetWeightKg, 4)} kg`, colX[0]);

      y += 10;
      const tableHeaders = [
        "Quantidade",
        "Folhas",
        "Peso Total",
        "Valor Total",
        "R$/un",
      ];
      const colWidths = [30, 25, 30, 40, 30];
      const tableX = MX;
      const rowHeight = 7;

      pdf.setFillColor(226, 232, 240);
      pdf.rect(
        tableX,
        y,
        colWidths.reduce((a, b) => a + b, 0),
        rowHeight,
        "F",
      );
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(15, 23, 42);
      let headerX = tableX;
      tableHeaders.forEach((header, index) => {
        pdf.text(header, headerX + 2, y + 4.8);
        headerX += colWidths[index];
      });

      y += rowHeight;
      pdf.setFont("helvetica", "normal");
      result.breakdowns.forEach((breakdown, index) => {
        if (index % 2 === 1) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(
            tableX,
            y,
            colWidths.reduce((a, b) => a + b, 0),
            rowHeight,
            "F",
          );
        }

        let cellX = tableX;
        const cells = [
          `${breakdown.quantity.toLocaleString("pt-BR")} un`,
          breakdown.sheetsNeeded.toLocaleString("pt-BR"),
          `${formatNum(breakdown.totalWeightKg, 3)} kg`,
          formatCurrency(breakdown.totalCost * taxMultiplier),
          formatCurrency(breakdown.unitSalePrice * taxMultiplier),
        ];
        cells.forEach((cell, cellIndex) => {
          pdf.text(cell, cellX + 2, y + 4.8);
          cellX += colWidths[cellIndex];
        });
        y += rowHeight;
      });

      pdf.setDrawColor(203, 213, 225);
      pdf.rect(
        tableX,
        y - rowHeight * (result.breakdowns.length + 1),
        colWidths.reduce((a, b) => a + b, 0),
        rowHeight * (result.breakdowns.length + 1),
        "S",
      );

      if (taxApplied) {
        y += 6;
        pdf.setFontSize(8.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(
          `* Valores já incluem imposto de ${taxPercentage}%.`,
          MX,
          y,
        );
      }

      y += 10;
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text(
        "Cotação simplificada, sujeita a confirmação. Não substitui orçamento formal.",
        MX,
        y,
      );

      pdf.save(`cotacao-rapida-${Date.now()}.pdf`);
    } catch (e) {
      toast({
        title: "Erro ao gerar PDF",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const addQty = () => {
    const quantities = mergeQuantity(input.quantities, newQty);

    if (quantities !== input.quantities) {
      setInput((current) => ({ ...current, quantities }));
    }

    setNewQty("");
  };

  const removeQty = (quantity: number) => {
    setInput({
      ...input,
      quantities: input.quantities.filter((item) => item !== quantity),
    });
  };

  const setQuality = (quality: QuotationInput["quality"]) => {
    setInput({
      ...input,
      quality,
      gramatura: PAPERBOARD_QUALITY_GRAMMAGE[quality],
      precoPorKg: PAPERBOARD_PRICE_PER_KG,
    });
  };

  const num = (v: string) => (v === "" ? 0 : Number(v));

  const handleEditTaxPercentage = () => {
    setTaxPercentageDraft(String(taxPercentage));
    setIsEditingTaxPercentage(true);
  };

  const handleCancelEditTaxPercentage = () => {
    setIsEditingTaxPercentage(false);
    setTaxPercentageDraft("");
  };

  const handleSaveTaxPercentage = () => {
    const value = Number(taxPercentageDraft);

    if (!Number.isFinite(value) || value < 0) {
      toast({
        title: "Informe uma porcentagem válida",
        variant: "destructive",
      });
      return;
    }

    setTaxPercentage(value);
    setIsEditingTaxPercentage(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" /> Cotação Rápida
          </h1>
          <p className="text-sm text-muted-foreground">
            Calcula o preço da caixa com o mesmo cálculo CLA usado em
            orçamentos.
          </p>
        </div>

        <form
          onSubmit={handleCalculate}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <div className="border border-border rounded-lg p-5 bg-card space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-semibold">Cálculo CLA da Caixa (mm)</h2>
              {isEditingTaxPercentage ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    autoFocus
                    value={taxPercentageDraft}
                    onChange={(e) => setTaxPercentageDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTaxPercentage();
                      if (e.key === "Escape") handleCancelEditTaxPercentage();
                    }}
                    className="w-16 border border-border rounded-md px-2 py-1 text-xs bg-background"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                  <button
                    type="button"
                    onClick={handleSaveTaxPercentage}
                    title="Salvar"
                    className="p-1 rounded hover:bg-green-500/10 text-green-600"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEditTaxPercentage}
                    title="Cancelar"
                    className="p-1 rounded hover:bg-destructive/10 text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleEditTaxPercentage}
                  title="Editar porcentagem de imposto"
                  className="flex items-center gap-1.5 text-xs font-bold border border-border px-2.5 py-1 rounded-lg hover:bg-accent"
                >
                  <Pencil className="h-3 w-3" /> Imposto {taxPercentage}%
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(["comprimentoMm", "larguraMm", "alturaMm"] as const).map(
                (key) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs text-muted-foreground capitalize">
                      {key
                        .replace("Mm", "")
                        .replace("comprimento", "Comprimento")
                        .replace("largura", "Largura")
                        .replace("altura", "Altura")}
                    </label>
                    <input
                      type="number"
                      min={1}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                      value={input[key]}
                      onChange={(e) =>
                        setInput({ ...input, [key]: num(e.target.value) })
                      }
                      required
                    />
                  </div>
                ),
              )}
            </div>

            <h2 className="font-semibold pt-2">Material</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Qualidade
                </label>
                <select
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={input.quality}
                  onChange={(e) =>
                    setQuality(e.target.value as QuotationInput["quality"])
                  }
                  required
                >
                  <option value="CMCB">CMCB</option>
                  <option value="CMCBC">CMCBC</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Gramatura (g/m²)
                </label>
                <input
                  type="number"
                  min={1}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={input.gramatura}
                  onChange={(e) =>
                    setInput({ ...input, gramatura: num(e.target.value) })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Preço por kg
                </label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={input.precoPorKg}
                  onChange={(e) =>
                    setInput({ ...input, precoPorKg: num(e.target.value) })
                  }
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-border rounded-lg p-5 bg-card space-y-3">
              <h2 className="font-semibold">Quantidades a Cotar</h2>
              <div className="flex flex-wrap gap-2">
                {input.quantities.map((quantity) => (
                  <span
                    key={quantity}
                    className="flex items-center gap-1 bg-primary/10 text-primary text-sm px-3 py-1 rounded-full"
                  >
                    {quantity.toLocaleString("pt-BR")} un
                    <button
                      type="button"
                      onClick={() => removeQty(quantity)}
                      className="hover:text-destructive ml-1"
                      aria-label={`Remover ${quantity} unidades`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  placeholder="Ex: 2000"
                  className="border border-border rounded-md px-3 py-2 text-sm bg-background flex-1"
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addQty();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addQty}
                  className="flex items-center gap-1 border border-border px-3 py-2 rounded-lg text-sm hover:bg-accent"
                >
                  <Plus className="h-4 w-4" /> Adicionar
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTaxApplied((current) => !current)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold border border-orange-500 bg-orange-500 text-white hover:bg-orange-600 transition-colors"
            >
              {taxApplied
                ? "Aplicado imposto (clique para remover)"
                : `Adicionar imposto (${taxPercentage}%)`}
            </button>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-60"
            >
              <Zap className="h-5 w-5" />
              {loading ? "Calculando..." : "Calcular Cotação"}
            </button>
          </div>
        </form>

        {result && (
          <div className="border border-border rounded-lg p-5 bg-card">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">Resultado do Cálculo</h2>
                {taxApplied && (
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full">
                    Imposto de {taxPercentage}% incluso
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => void generateQuotationPdf()}
                disabled={isGeneratingPdf}
                className="flex items-center gap-1.5 text-xs font-bold border border-border px-3 py-1.5 rounded-lg hover:bg-accent disabled:opacity-60"
              >
                <FileDown className="h-3.5 w-3.5" />
                {isGeneratingPdf ? "Gerando PDF..." : "Gerar PDF"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  Formato impressora
                </p>
                <p className="font-medium">
                  {formatNum(result.blankWidthMm)} mm
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Formato riscador
                </p>
                <p className="font-medium">
                  {formatNum(result.blankHeightMm)} mm
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gramatura</p>
                <p className="font-medium">{result.input.gramatura} g/m²</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Peso por caixa
                </p>
                <p className="font-medium">
                  {formatNum(result.sheetWeightKg, 4)} kg
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Quantidade
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Folhas
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Peso Total
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Valor Total
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      R$/un
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.breakdowns.map((breakdown) => {
                    const taxMultiplier = taxApplied
                      ? 1 + taxPercentage / 100
                      : 1;

                    return (
                      <tr
                        key={breakdown.quantity}
                        className="hover:bg-muted/30"
                      >
                        <td className="px-3 py-2 font-medium">
                          {breakdown.quantity.toLocaleString("pt-BR")} un
                        </td>
                        <td className="px-3 py-2">
                          {breakdown.sheetsNeeded.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-3 py-2">
                          {formatNum(breakdown.totalWeightKg, 3)} kg
                        </td>
                        <td className="px-3 py-2 font-semibold text-primary">
                          {formatCurrency(breakdown.totalCost * taxMultiplier)}
                        </td>
                        <td className="px-3 py-2">
                          {formatCurrency(
                            breakdown.unitSalePrice * taxMultiplier,
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
