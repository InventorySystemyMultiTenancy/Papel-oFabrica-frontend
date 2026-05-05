import { useEffect, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ApiError } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  calculateQuotation,
  type QuotationInput,
  type QuotationResult,
} from "@/services/pricing";
import { Calculator, Plus, Trash2, Zap } from "lucide-react";

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
  gramatura: 200,
  numCores: 0,
  precoPorKg: 5.5,
  custoPorCorUnidade: 0.05,
  custoFixoLote: 0,
  margemPercent: 30,
  quantities: [300, 500, 1000],
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
        description: e instanceof ApiError ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addQty = () => {
    const n = parseInt(newQty);
    if (!n || n <= 0) return;
    if (!input.quantities.includes(n)) {
      setInput({
        ...input,
        quantities: [...input.quantities, n].sort((a, b) => a - b),
      });
    }
    setNewQty("");
  };

  const removeQty = (q: number) =>
    setInput({ ...input, quantities: input.quantities.filter((x) => x !== q) });

  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" /> Motor de Precificação
          </h1>
          <p className="text-sm text-muted-foreground">
            Cotação rápida — não salva dados, apenas calcula
          </p>
        </div>

        <form
          onSubmit={handleCalculate}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Dimensões */}
          <div className="border border-border rounded-lg p-5 bg-card space-y-4">
            <h2 className="font-semibold">Dimensões da Caixa (mm)</h2>
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
            <div className="grid grid-cols-2 gap-3">
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
                  Preço por KG (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={input.precoPorKg}
                  onChange={(e) =>
                    setInput({ ...input, precoPorKg: num(e.target.value) })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Nº de Cores de Impressão
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={input.numCores}
                  onChange={(e) =>
                    setInput({ ...input, numCores: num(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Custo por Cor/Unidade (R$)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min={0}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={input.custoPorCorUnidade}
                  onChange={(e) =>
                    setInput({
                      ...input,
                      custoPorCorUnidade: num(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Custo Fixo por Lote (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={input.custoFixoLote}
                  onChange={(e) =>
                    setInput({ ...input, custoFixoLote: num(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Margem desejada (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={99}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={input.margemPercent}
                  onChange={(e) =>
                    setInput({ ...input, margemPercent: num(e.target.value) })
                  }
                />
              </div>
            </div>
          </div>

          {/* Quantidades e parâmetros avançados */}
          <div className="space-y-4">
            <div className="border border-border rounded-lg p-5 bg-card space-y-3">
              <h2 className="font-semibold">Quantidades a Cotar</h2>
              <div className="flex flex-wrap gap-2">
                {input.quantities.map((q) => (
                  <span
                    key={q}
                    className="flex items-center gap-1 bg-primary/10 text-primary text-sm px-3 py-1 rounded-full"
                  >
                    {q.toLocaleString("pt-BR")} un
                    <button
                      type="button"
                      onClick={() => removeQty(q)}
                      className="hover:text-destructive ml-1"
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

            <div className="border border-border rounded-lg p-5 bg-card space-y-3">
              <h2 className="font-semibold">Parâmetros Avançados (opcional)</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Largura da Folha (mm)
                  </label>
                  <input
                    type="number"
                    placeholder="1600"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                    value={input.sheetWidthMm ?? ""}
                    onChange={(e) =>
                      setInput({
                        ...input,
                        sheetWidthMm: e.target.value
                          ? num(e.target.value)
                          : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Comprimento da Folha (mm)
                  </label>
                  <input
                    type="number"
                    placeholder="2800"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                    value={input.sheetHeightMm ?? ""}
                    onChange={(e) =>
                      setInput({
                        ...input,
                        sheetHeightMm: e.target.value
                          ? num(e.target.value)
                          : undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Fator de Perda (ex: 0.10 = 10%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={1}
                    placeholder="0.10"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                    value={input.lossFactor ?? ""}
                    onChange={(e) =>
                      setInput({
                        ...input,
                        lossFactor: e.target.value
                          ? num(e.target.value)
                          : undefined,
                      })
                    }
                  />
                </div>
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

        {/* Resultado */}
        {result && (
          <div className="space-y-4">
            <div className="border border-border rounded-lg p-5 bg-card">
              <h2 className="font-semibold mb-3">Resultado do Cálculo</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Blanck (largura)
                  </p>
                  <p className="font-medium">
                    {formatNum(result.blankWidthMm)} mm
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Blanck (altura)
                  </p>
                  <p className="font-medium">
                    {formatNum(result.blankHeightMm)} mm
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Peças por Folha
                  </p>
                  <p className="font-medium">{result.piecesPerSheet}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Peso por Folha
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
                        Custo Total
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                        Preço de Venda
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                        R$/un
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                        Margem Real
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {result.breakdowns.map((b) => (
                      <tr
                        key={b.quantity}
                        className={`hover:bg-muted/30 ${b.grossMarginPercent < 15 ? "bg-red-500/5" : ""}`}
                      >
                        <td className="px-3 py-2 font-medium">
                          {b.quantity.toLocaleString("pt-BR")} un
                        </td>
                        <td className="px-3 py-2">{b.sheetsNeeded}</td>
                        <td className="px-3 py-2">
                          {formatNum(b.totalWeightKg, 3)} kg
                        </td>
                        <td className="px-3 py-2">
                          {formatCurrency(b.totalCost)}
                        </td>
                        <td className="px-3 py-2 font-semibold text-primary">
                          {formatCurrency(b.salePrice)}
                        </td>
                        <td className="px-3 py-2">
                          {formatCurrency(b.unitSalePrice)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`font-medium ${b.grossMarginPercent < 15 ? "text-destructive" : "text-green-600"}`}
                          >
                            {formatNum(b.grossMarginPercent)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                ⚠️ Linhas em vermelho indicam margem abaixo de 15% — risco de
                prejuízo.
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
