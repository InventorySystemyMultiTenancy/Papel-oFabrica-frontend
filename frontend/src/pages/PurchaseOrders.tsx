import { useEffect, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ApiError } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  listPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from "@/services/purchase-orders";
import {
  Plus,
  Trash2,
  RefreshCw,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";
const formatNum = (v: number, dec = 3) =>
  v.toLocaleString("pt-BR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  confirmed: "Confirmado",
  received: "Recebido",
  cancelled: "Cancelado",
};
const STATUS_STYLES: Record<PurchaseOrderStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-600",
  confirmed: "bg-yellow-500/15 text-yellow-700",
  received: "bg-green-500/15 text-green-600",
  cancelled: "bg-destructive/15 text-destructive",
};

interface ItemForm {
  description: string;
  quantityKg: number;
  unitPricePerKg: number;
  gramatura: number;
  notes: string;
}

export default function PurchaseOrdersPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [supplier, setSupplier] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemForm[]>([
    {
      description: "",
      quantityKg: 0,
      unitPricePerKg: 0,
      gramatura: 0,
      notes: "",
    },
  ]);

  const load = async () => {
    setLoading(true);
    try {
      setOrders(await listPurchaseOrders());
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
      await createPurchaseOrder({
        supplier,
        expectedDeliveryDate: expectedDate || null,
        notes: notes || null,
        items: items.map((i) => ({
          description: i.description,
          quantityKg: i.quantityKg,
          unitPricePerKg: i.unitPricePerKg || null,
          gramatura: i.gramatura || null,
          notes: i.notes || null,
        })),
      });
      toast({ title: "Pedido de compra criado" });
      setShowForm(false);
      setSupplier("");
      setExpectedDate("");
      setNotes("");
      setItems([
        {
          description: "",
          quantityKg: 0,
          unitPricePerKg: 0,
          gramatura: 0,
          notes: "",
        },
      ]);
      load();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof ApiError ? e.message : "Erro ao salvar",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (
    id: string,
    status: PurchaseOrderStatus,
  ) => {
    try {
      await updatePurchaseOrder(id, { status });
      toast({ title: "Status atualizado" });
      load();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof ApiError ? e.message : "Erro",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este pedido?")) return;
    try {
      await deletePurchaseOrder(id);
      toast({ title: "Pedido excluído" });
      load();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof ApiError ? e.message : "Erro ao excluir",
        variant: "destructive",
      });
    }
  };

  const addItem = () =>
    setItems([
      ...items,
      {
        description: "",
        quantityKg: 0,
        unitPricePerKg: 0,
        gramatura: 0,
        notes: "",
      },
    ]);
  const removeItem = (i: number) =>
    setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (
    i: number,
    field: keyof ItemForm,
    value: string | number,
  ) => {
    const copy = [...items];
    copy[i] = { ...copy[i], [field]: value };
    setItems(copy);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingBag className="h-6 w-6" /> Pedidos de Compra
            </h1>
            <p className="text-sm text-muted-foreground">
              Gestão de compras de matéria-prima (chapas)
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
              <Plus className="h-4 w-4" /> Novo Pedido
            </button>
          </div>
        </div>

        {showForm && (
          <div className="border border-border rounded-lg p-5 bg-card space-y-4">
            <h2 className="font-semibold">Novo Pedido de Compra</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Fornecedor *
                  </label>
                  <input
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Previsão de Entrega
                  </label>
                  <input
                    type="date"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs text-muted-foreground">
                    Observações
                  </label>
                  <textarea
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">Itens</h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Adicionar item
                  </button>
                </div>
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="border border-border rounded-lg p-3 space-y-3 bg-muted/20"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs text-muted-foreground">
                          Descrição *
                        </label>
                        <input
                          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                          value={item.description}
                          onChange={(e) =>
                            updateItem(i, "description", e.target.value)
                          }
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Quantidade (kg) *
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min={0}
                          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                          value={item.quantityKg || ""}
                          onChange={(e) =>
                            updateItem(i, "quantityKg", Number(e.target.value))
                          }
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Preço/kg (R$)
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          min={0}
                          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                          value={item.unitPricePerKg || ""}
                          onChange={(e) =>
                            updateItem(
                              i,
                              "unitPricePerKg",
                              Number(e.target.value),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Gramatura (g/m²)
                        </label>
                        <input
                          type="number"
                          min={0}
                          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                          value={item.gramatura || ""}
                          onChange={(e) =>
                            updateItem(i, "gramatura", Number(e.target.value))
                          }
                        />
                      </div>
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remover item
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                  Criar Pedido
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

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Nenhum pedido de compra</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div
                key={o.id}
                className="border border-border rounded-lg bg-card overflow-hidden"
              >
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30"
                  onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground">
                      #{o.orderNumber}
                    </span>
                    <span className="font-medium">{o.supplier}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[o.status]}`}
                    >
                      {STATUS_LABELS[o.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">
                      {formatCurrency(o.totalAmount)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(o.expectedDeliveryDate)}
                    </span>
                    {expanded === o.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
                {expanded === o.id && (
                  <div className="border-t border-border px-4 py-4 space-y-4">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                            Item
                          </th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                            Gramatura
                          </th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                            Qtd (kg)
                          </th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                            Preço/kg
                          </th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {o.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2">
                              {item.gramatura != null
                                ? `${item.gramatura} g/m²`
                                : "—"}
                            </td>
                            <td className="px-3 py-2">
                              {formatNum(item.quantityKg)} kg
                            </td>
                            <td className="px-3 py-2">
                              {item.unitPricePerKg != null
                                ? formatCurrency(item.unitPricePerKg)
                                : "—"}
                            </td>
                            <td className="px-3 py-2">
                              {item.totalPrice != null
                                ? formatCurrency(item.totalPrice)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Mudar status:
                      </span>
                      {(
                        [
                          "draft",
                          "sent",
                          "confirmed",
                          "received",
                          "cancelled",
                        ] as PurchaseOrderStatus[]
                      ).map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(o.id, s)}
                          disabled={o.status === s}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${o.status === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                      {["draft", "cancelled"].includes(o.status) && (
                        <button
                          onClick={() => handleDelete(o.id)}
                          className="ml-auto text-xs text-destructive hover:underline flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" /> Excluir
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
