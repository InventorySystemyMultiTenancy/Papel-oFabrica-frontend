import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import {
  calculateQuotation,
  type QuotationInput,
  type QuotationResult,
} from "@/services/pricing";
import { Calculator, Plus, Trash2, Zap } from "lucide-react";

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
  quantities: [100, 500, 1000],
};

export default function PricingPage() {
  const { toast } = useToast();
  const [input, setInput] = useState<QuotationInput>({ ...DEFAULT_INPUT });
  const [result, setResult] = useState<QuotationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [newQty, setNewQty] = useState("");

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (input.quantities.length === 0) {
      toast({
        title: "Adicione pelo menos uma quantidade",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await calculateQuotation(input);
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

  const addQty = () => {
    const quantity = parseInt(newQty, 10);
    if (!quantity || quantity <= 0) return;

    if (!input.quantities.includes(quantity)) {
      setInput({
        ...input,
        quantities: [...input.quantities, quantity].sort((a, b) => a - b),
      });
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
            <h2 className="font-semibold">Cálculo CLA da Caixa (mm)</h2>
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
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted text-muted-foreground"
                  value={input.gramatura}
                  readOnly
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Preço por kg
                </label>
                <input
                  type="text"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted text-muted-foreground"
                  value={formatCurrency(input.precoPorKg)}
                  readOnly
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
            <h2 className="font-semibold mb-3">Resultado do Cálculo</h2>
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
                  {result.breakdowns.map((breakdown) => (
                    <tr key={breakdown.quantity} className="hover:bg-muted/30">
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
                        {formatCurrency(breakdown.totalCost)}
                      </td>
                      <td className="px-3 py-2">
                        {formatCurrency(breakdown.unitSalePrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
