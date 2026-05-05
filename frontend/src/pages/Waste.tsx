import { useEffect, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ApiError } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  listWasteRecords,
  getWasteSummary,
  createWasteRecord,
  updateWasteRecord,
  deleteWasteRecord,
  type WasteRecord,
  type WasteSummary,
} from "@/services/waste";
import {
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  Recycle,
  DollarSign,
} from "lucide-react";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatNum = (v: number, dec = 3) =>
  v.toLocaleString("pt-BR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
const formatDate = (v: string) => new Date(v).toLocaleDateString("pt-BR");

export default function WastePage() {
  const { toast } = useToast();
  const [records, setRecords] = useState<WasteRecord[]>([]);
  const [summary, setSummary] = useState<WasteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<
    Partial<{
      recordDate: string;
      weightKg: number;
      description: string;
      sold: boolean;
      saleAmount: number;
      buyer: string;
      notes: string;
    }>
  >({
    sold: false,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([listWasteRecords(), getWasteSummary()]);
      setRecords(r);
      setSummary(s);
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof ApiError ? e.message : "Erro ao carregar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateWasteRecord(editingId, form);
        toast({ title: "Registro atualizado" });
      } else {
        await createWasteRecord(
          form as Parameters<typeof createWasteRecord>[0],
        );
        toast({ title: "Registro criado" });
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ sold: false });
      load();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof ApiError ? e.message : "Erro ao salvar",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (r: WasteRecord) => {
    setEditingId(r.id);
    setForm({
      recordDate: r.recordDate,
      weightKg: r.weightKg,
      description: r.description ?? "",
      sold: r.sold,
      saleAmount: r.saleAmount ?? undefined,
      buyer: r.buyer ?? "",
      notes: r.notes ?? "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este registro?")) return;
    try {
      await deleteWasteRecord(id);
      toast({ title: "Registro excluído" });
      load();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof ApiError ? e.message : "Erro ao excluir",
        variant: "destructive",
      });
    }
  };

  const handleMarkSold = async (r: WasteRecord) => {
    const amount = prompt("Valor da venda (R$):");
    if (!amount) return;
    try {
      await updateWasteRecord(r.id, { sold: true, saleAmount: Number(amount) });
      toast({ title: "Resíduo marcado como vendido" });
      load();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof ApiError ? e.message : "Erro",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Recycle className="h-6 w-6" /> Gestão de Resíduos
            </h1>
            <p className="text-sm text-muted-foreground">
              Controle de sobras de papelão e vendas de resíduos
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="flex items-center gap-1 text-sm border border-border px-3 py-1.5 rounded-lg hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingId(null);
                setForm({ sold: false });
              }}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Novo Registro
            </button>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="border border-border rounded-lg p-4 bg-card">
              <p className="text-xs text-muted-foreground uppercase">
                Total Acumulado
              </p>
              <p className="text-xl font-bold">
                {formatNum(summary.totalWeightKg)} kg
              </p>
            </div>
            <div className="border border-border rounded-lg p-4 bg-card">
              <p className="text-xs text-muted-foreground uppercase">
                Vendidos
              </p>
              <p className="text-xl font-bold text-green-600">
                {formatNum(summary.totalSold)} kg
              </p>
            </div>
            <div className="border border-border rounded-lg p-4 bg-card">
              <p className="text-xs text-muted-foreground uppercase">
                Receita com Resíduos
              </p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(summary.totalRevenue)}
              </p>
            </div>
            <div className="border border-border rounded-lg p-4 bg-card">
              <p className="text-xs text-muted-foreground uppercase">
                Pendente para Venda
              </p>
              <p className="text-xl font-bold text-yellow-600">
                {formatNum(summary.pendingSaleWeightKg)} kg
              </p>
            </div>
          </div>
        )}

        {showForm && (
          <div className="border border-border rounded-lg p-5 bg-card space-y-4">
            <h2 className="font-semibold">
              {editingId ? "Editar Registro" : "Novo Registro de Resíduo"}
            </h2>
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Data</label>
                <input
                  type="date"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.recordDate ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, recordDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Peso (kg) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min={0}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.weightKg ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, weightKg: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">
                  Descrição
                </label>
                <input
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.description ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  id="sold"
                  checked={form.sold ?? false}
                  onChange={(e) => setForm({ ...form, sold: e.target.checked })}
                  className="h-4 w-4"
                />
                <label htmlFor="sold" className="text-sm">
                  Já vendido
                </label>
              </div>
              {form.sold && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Valor da Venda (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                      value={form.saleAmount ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, saleAmount: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Comprador
                    </label>
                    <input
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                      value={form.buyer ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, buyer: e.target.value })
                      }
                    />
                  </div>
                </>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                  {editingId ? "Salvar" : "Registrar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="border border-border px-4 py-2 rounded-lg text-sm hover:bg-accent"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Recycle className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Nenhum registro de resíduo</p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Data
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Peso (kg)
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Descrição
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Vendido
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Valor
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">{formatDate(r.recordDate)}</td>
                    <td className="px-4 py-3 font-medium">
                      {formatNum(r.weightKg)} kg
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.description ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.sold ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}
                      >
                        {r.sold
                          ? `Sim${r.buyer ? ` — ${r.buyer}` : ""}`
                          : "Não"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.saleAmount != null
                        ? formatCurrency(r.saleAmount)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right flex justify-end gap-1">
                      {!r.sold && (
                        <button
                          onClick={() => handleMarkSold(r)}
                          title="Marcar como vendido"
                          className="p-1.5 rounded hover:bg-green-500/10 text-green-600"
                        >
                          <DollarSign className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(r)}
                        className="p-1.5 rounded hover:bg-accent"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
