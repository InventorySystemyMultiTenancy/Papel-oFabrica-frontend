import { useEffect, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ApiError } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  listPayables,
  createPayable,
  updatePayable,
  deletePayable,
  getPayableSummary,
  type AccountPayable,
  type PayableCategory,
  type PayableSummary,
} from "@/services/accounts-payable";
import {
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  CreditCard,
} from "lucide-react";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";

const CATEGORY_LABELS: Record<PayableCategory, string> = {
  agua: "Água",
  energia: "Energia",
  material: "Material",
  aluguel: "Aluguel",
  salario: "Salário",
  impostos: "Impostos",
  servicos: "Serviços",
  outros: "Outros",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-700",
  paid: "bg-green-500/15 text-green-600",
  overdue: "bg-destructive/15 text-destructive",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Vencido",
};

export default function AccountsPayablePage() {
  const { toast } = useToast();
  const [payables, setPayables] = useState<AccountPayable[]>([]);
  const [summary, setSummary] = useState<PayableSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");

  const [form, setForm] = useState<
    Partial<{
      description: string;
      category: PayableCategory;
      amount: number;
      dueDate: string;
      supplier: string;
      notes: string;
      recurrent: boolean;
    }>
  >({
    category: "outros",
    amount: 0,
    recurrent: false,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        listPayables(filterStatus || undefined),
        getPayableSummary(),
      ]);
      setPayables(p);
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
  }, [filterStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updatePayable(editingId, form);
        toast({ title: "Conta atualizada" });
      } else {
        await createPayable(form as Parameters<typeof createPayable>[0]);
        toast({ title: "Conta cadastrada" });
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ category: "outros", amount: 0, recurrent: false });
      load();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof ApiError ? e.message : "Erro ao salvar",
        variant: "destructive",
      });
    }
  };

  const handleMarkPaid = async (p: AccountPayable) => {
    try {
      await updatePayable(p.id, { status: "paid" });
      toast({ title: "Conta marcada como paga" });
      load();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof ApiError ? e.message : "Erro",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (p: AccountPayable) => {
    setEditingId(p.id);
    setForm({
      description: p.description,
      category: p.category,
      amount: p.amount,
      dueDate: p.dueDate,
      supplier: p.supplier ?? "",
      notes: p.notes ?? "",
      recurrent: p.recurrent,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta conta?")) return;
    try {
      await deletePayable(id);
      toast({ title: "Conta excluída" });
      load();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof ApiError ? e.message : "Erro ao excluir",
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
              <CreditCard className="h-6 w-6" /> Contas a Pagar
            </h1>
            <p className="text-sm text-muted-foreground">
              Despesas e obrigações financeiras
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
                setForm({ category: "outros", amount: 0, recurrent: false });
              }}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Nova Conta
            </button>
          </div>
        </div>

        {/* Resumo */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-border rounded-lg p-4 bg-card">
              <p className="text-xs text-muted-foreground uppercase">
                Pendentes
              </p>
              <p className="text-xl font-bold text-yellow-600">
                {formatCurrency(summary.totalPending)}
              </p>
            </div>
            <div className="border border-border rounded-lg p-4 bg-card">
              <p className="text-xs text-muted-foreground uppercase">
                Vencidas
              </p>
              <p className="text-xl font-bold text-destructive">
                {formatCurrency(summary.totalOverdue)}
              </p>
            </div>
            <div className="border border-border rounded-lg p-4 bg-card">
              <p className="text-xs text-muted-foreground uppercase">Pagas</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(summary.totalPaid)}
              </p>
            </div>
          </div>
        )}

        {/* Filtro */}
        <div className="flex gap-2">
          {["", "pending", "overdue", "paid"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
            >
              {s === "" ? "Todos" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Formulário */}
        {showForm && (
          <div className="border border-border rounded-lg p-5 bg-card space-y-4">
            <h2 className="font-semibold">
              {editingId ? "Editar Conta" : "Nova Conta a Pagar"}
            </h2>
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">
                  Descrição *
                </label>
                <input
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.description ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Categoria
                </label>
                <select
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.category ?? "outros"}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category: e.target.value as PayableCategory,
                    })
                  }
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Valor (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.amount ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, amount: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Vencimento *
                </label>
                <input
                  type="date"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.dueDate ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, dueDate: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Fornecedor
                </label>
                <input
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.supplier ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, supplier: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  id="recurrent"
                  checked={form.recurrent ?? false}
                  onChange={(e) =>
                    setForm({ ...form, recurrent: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <label htmlFor="recurrent" className="text-sm">
                  Recorrente (mensal)
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
                  {editingId ? "Salvar" : "Cadastrar"}
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
        ) : payables.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Nenhuma conta cadastrada</p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Descrição
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Categoria
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Valor
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Vencimento
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payables.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.description}</div>
                      {p.supplier && (
                        <div className="text-xs text-muted-foreground">
                          {p.supplier}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {CATEGORY_LABELS[p.category]}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="px-4 py-3">{formatDate(p.dueDate)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[p.status]}`}
                      >
                        {STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right flex justify-end gap-1">
                      {p.status !== "paid" && (
                        <button
                          onClick={() => handleMarkPaid(p)}
                          title="Marcar como pago"
                          className="p-1.5 rounded hover:bg-green-500/10 text-green-600"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(p)}
                        className="p-1.5 rounded hover:bg-accent"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
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
