import { useEffect, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ApiError } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  listCliches,
  createCliche,
  updateCliche,
  deleteCliche,
  type Cliche,
  type CreateClicheInput,
} from "@/services/cliches";
import { listClients } from "@/services/clients";
import type { Client } from "@/services/clients";
import {
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  XCircle,
  RefreshCw,
  Tag,
} from "lucide-react";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
};

export default function ClichesPage() {
  const { toast } = useToast();
  const [cliches, setCliches] = useState<Cliche[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<
    Partial<CreateClicheInput & { status: string }>
  >({
    clientId: "",
    name: "",
    colors: 1,
    cost: 0,
    paid: false,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [c, cl] = await Promise.all([listCliches(), listClients()]);
      setCliches(c);
      setClients(cl);
    } catch (e) {
      toast({
        title: "Erro",
        description:
          e instanceof ApiError ? e.message : "Erro ao carregar clichês",
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
        await updateCliche(editingId, form);
        toast({ title: "Clichê atualizado com sucesso" });
      } else {
        await createCliche(form as CreateClicheInput);
        toast({ title: "Clichê cadastrado com sucesso" });
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ clientId: "", name: "", colors: 1, cost: 0, paid: false });
      load();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof ApiError ? e.message : "Erro ao salvar",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (c: Cliche) => {
    setEditingId(c.id);
    setForm({
      clientId: c.clientId,
      name: c.name,
      colors: c.colors,
      widthCm: c.widthCm ?? undefined,
      heightCm: c.heightCm ?? undefined,
      cost: c.cost,
      paid: c.paid,
      notes: c.notes ?? undefined,
      status: c.status,
    });
    setShowForm(true);
  };

  const handleMarkPaid = async (c: Cliche) => {
    try {
      await updateCliche(c.id, { paid: true });
      toast({ title: "Clichê marcado como pago" });
      load();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof ApiError ? e.message : "Erro ao atualizar",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este clichê?")) return;
    try {
      await deleteCliche(id);
      toast({ title: "Clichê excluído" });
      load();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof ApiError ? e.message : "Erro ao excluir",
        variant: "destructive",
      });
    }
  };

  const unpaidTotal = cliches
    .filter((c) => !c.paid)
    .reduce((s, c) => s + c.cost, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Tag className="h-6 w-6" /> Controle de Clichês
            </h1>
            <p className="text-muted-foreground text-sm">
              Gerencie os clichês de impressão por cliente
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="flex items-center gap-1 text-sm border border-border px-3 py-1.5 rounded-lg hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" /> Atualizar
            </button>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingId(null);
                setForm({
                  clientId: "",
                  name: "",
                  colors: 1,
                  cost: 0,
                  paid: false,
                });
              }}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Novo Clichê
            </button>
          </div>
        </div>

        {/* Alerta de pendentes */}
        {unpaidTotal > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-700 dark:text-yellow-400">
            ⚠️ Total de clichês não pagos:{" "}
            <strong>{formatCurrency(unpaidTotal)}</strong>
          </div>
        )}

        {/* Formulário */}
        {showForm && (
          <div className="border border-border rounded-lg p-5 bg-card space-y-4">
            <h2 className="font-semibold">
              {editingId ? "Editar Clichê" : "Novo Clichê"}
            </h2>
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Cliente *
                </label>
                <select
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.clientId ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, clientId: e.target.value })
                  }
                  required
                >
                  <option value="">Selecione um cliente</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Nome / Descrição *
                </label>
                <input
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Número de Cores
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.colors ?? 1}
                  onChange={(e) =>
                    setForm({ ...form, colors: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Custo (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.cost ?? 0}
                  onChange={(e) =>
                    setForm({ ...form, cost: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Largura (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.widthCm ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      widthCm: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Altura (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.heightCm ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      heightCm: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  id="paid"
                  checked={form.paid ?? false}
                  onChange={(e) => setForm({ ...form, paid: e.target.checked })}
                  className="h-4 w-4"
                />
                <label htmlFor="paid" className="text-sm">
                  Já foi pago
                </label>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">
                  Observações
                </label>
                <textarea
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  rows={2}
                  value={form.notes ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                  {editingId ? "Salvar Alterações" : "Cadastrar"}
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

        {/* Tabela */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : cliches.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Nenhum clichê cadastrado</p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Cliente
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Clichê
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Cores
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Custo
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Status Pagamento
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Pago em
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cliches.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">{c.clientName ?? c.clientId}</td>
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3">{c.colors}</td>
                    <td className="px-4 py-3">{formatCurrency(c.cost)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${c.paid ? "bg-green-500/15 text-green-600" : "bg-yellow-500/15 text-yellow-700"}`}
                      >
                        {c.paid ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {c.paid ? "Pago" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(c.paidAt)}
                    </td>
                    <td className="px-4 py-3 text-right flex justify-end gap-1">
                      {!c.paid && (
                        <button
                          onClick={() => handleMarkPaid(c)}
                          title="Marcar como pago"
                          className="p-1.5 rounded hover:bg-green-500/10 text-green-600"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(c)}
                        className="p-1.5 rounded hover:bg-accent"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
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
