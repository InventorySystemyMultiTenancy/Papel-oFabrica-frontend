import { useEffect, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ApiError } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  listConsignedStock,
  upsertConsignedStock,
  addConsignedMovement,
  getConsignedMovements,
  type ConsignedStockItem,
  type ConsignedMovement,
} from "@/services/consigned-stock";
import {
  Plus,
  RefreshCw,
  Archive,
  ArrowUp,
  ArrowDown,
  History,
} from "lucide-react";

const formatDate = (v: string) => new Date(v).toLocaleDateString("pt-BR");

export default function ConsignedStockPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<ConsignedStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showMovForm, setShowMovForm] = useState<string | null>(null);
  const [movements, setMovements] = useState<ConsignedMovement[]>([]);
  const [showHistory, setShowHistory] = useState<string | null>(null);

  const [form, setForm] = useState<{
    productDescription: string;
    quantity: number;
    unit: string;
    notes: string;
  }>({ productDescription: "", quantity: 0, unit: "un", notes: "" });
  const [movForm, setMovForm] = useState<{
    type: "entrada" | "saida";
    quantity: number;
    notes: string;
    performedBy: string;
  }>({ type: "entrada", quantity: 0, notes: "", performedBy: "" });

  const load = async () => {
    setLoading(true);
    try {
      setItems(await listConsignedStock());
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
      await upsertConsignedStock(form);
      toast({ title: "Estoque consignado registrado" });
      setShowForm(false);
      setForm({ productDescription: "", quantity: 0, unit: "un", notes: "" });
      load();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof ApiError ? e.message : "Erro ao salvar",
        variant: "destructive",
      });
    }
  };

  const handleMovSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showMovForm) return;
    try {
      await addConsignedMovement(showMovForm, movForm);
      toast({ title: `Movimentação (${movForm.type}) registrada` });
      setShowMovForm(null);
      setMovForm({ type: "entrada", quantity: 0, notes: "", performedBy: "" });
      load();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof ApiError ? e.message : "Erro ao registrar",
        variant: "destructive",
      });
    }
  };

  const loadHistory = async (id: string) => {
    try {
      const mvs = await getConsignedMovements(id);
      setMovements(mvs);
      setShowHistory(id);
    } catch (e) {
      toast({ title: "Erro ao carregar histórico", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Archive className="h-6 w-6" /> Estoque Consignado
            </h1>
            <p className="text-sm text-muted-foreground">
              Material de cliente armazenado na fábrica
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
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Registrar Estoque
            </button>
          </div>
        </div>

        {showForm && (
          <div className="border border-border rounded-lg p-5 bg-card space-y-4">
            <h2 className="font-semibold">
              Novo Registro de Estoque Consignado
            </h2>
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">
                  Descrição do Produto *
                </label>
                <input
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.productDescription}
                  onChange={(e) =>
                    setForm({ ...form, productDescription: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Quantidade *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min={0}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.quantity || ""}
                  onChange={(e) =>
                    setForm({ ...form, quantity: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Unidade</label>
                <input
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="un, kg, cx..."
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">
                  Observações
                </label>
                <textarea
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="border border-border px-4 py-2 rounded-lg text-sm hover:bg-accent"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Movement form */}
        {showMovForm && (
          <div className="border border-primary/30 rounded-lg p-5 bg-primary/5 space-y-4">
            <h2 className="font-semibold">Registrar Movimentação</h2>
            <form
              onSubmit={handleMovSubmit}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tipo</label>
                <select
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={movForm.type}
                  onChange={(e) =>
                    setMovForm({
                      ...movForm,
                      type: e.target.value as "entrada" | "saida",
                    })
                  }
                >
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Quantidade *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min={0}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={movForm.quantity || ""}
                  onChange={(e) =>
                    setMovForm({ ...movForm, quantity: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Realizado por
                </label>
                <input
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={movForm.performedBy}
                  onChange={(e) =>
                    setMovForm({ ...movForm, performedBy: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1 sm:col-span-3">
                <label className="text-xs text-muted-foreground">
                  Observações
                </label>
                <input
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={movForm.notes}
                  onChange={(e) =>
                    setMovForm({ ...movForm, notes: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2 sm:col-span-3">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                  Registrar
                </button>
                <button
                  type="button"
                  onClick={() => setShowMovForm(null)}
                  className="border border-border px-4 py-2 rounded-lg text-sm hover:bg-accent"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* History modal */}
        {showHistory && (
          <div className="border border-border rounded-lg p-5 bg-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <History className="h-4 w-4" /> Histórico de Movimentações
              </h2>
              <button
                onClick={() => setShowHistory(null)}
                className="text-xs text-muted-foreground hover:underline"
              >
                Fechar
              </button>
            </div>
            {movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem movimentações registradas.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Data
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Tipo
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Quantidade
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Realizado por
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Obs
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="px-3 py-2">{formatDate(m.createdAt)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`flex items-center gap-1 text-xs font-medium ${m.type === "entrada" ? "text-green-600" : "text-destructive"}`}
                        >
                          {m.type === "entrada" ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUp className="h-3 w-3" />
                          )}
                          {m.type === "entrada" ? "Entrada" : "Saída"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium">{m.quantity}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {m.performedBy ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {m.notes ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Archive className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Nenhum estoque consignado registrado</p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Produto
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Quantidade
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Atualizado
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {item.productDescription}
                      </div>
                      {item.notes && (
                        <div className="text-xs text-muted-foreground">
                          {item.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(item.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right flex justify-end gap-1">
                      <button
                        onClick={() => {
                          setShowMovForm(item.id);
                          setShowHistory(null);
                        }}
                        title="Registrar entrada/saída"
                        className="p-1.5 rounded hover:bg-primary/10 text-primary flex items-center gap-1 text-xs"
                      >
                        <Plus className="h-3 w-3" /> Movimentação
                      </button>
                      <button
                        onClick={() => {
                          loadHistory(item.id);
                          setShowMovForm(null);
                        }}
                        title="Ver histórico"
                        className="p-1.5 rounded hover:bg-accent"
                      >
                        <History className="h-4 w-4" />
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
