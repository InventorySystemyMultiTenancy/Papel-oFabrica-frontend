import { useEffect, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { FormField } from "@/components/FormField";
import { ApiError } from "@/services/api";
import { Plus, ChevronDown, ChevronUp, Package, Truck, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import {
  type Order,
  type OrderItem,
  type OrderStatus,
  createOrder,
  getOrder,
  listOrders,
  updateItemProduced,
} from "@/services/orders";
import { type Shipment, createShipment, listShipments } from "@/services/shipments";
import { type AccountReceivable, generateInstallments, listReceivables, updateReceivable } from "@/services/financial";
import { listBudgets, type Budget } from "@/services/budgets";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (value: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR");
};

const formatDateTime = (value: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("pt-BR");
};

const statusLabel: Record<OrderStatus, string> = {
  production: "Em Produção",
  partial: "Parcialmente Expedido",
  completed: "Concluído",
};

const statusColor: Record<OrderStatus, string> = {
  production: "bg-blue-500/20 text-blue-400",
  partial: "bg-yellow-500/20 text-yellow-400",
  completed: "bg-green-500/20 text-green-500",
};

const receivableStatusLabel: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Vencido",
};

const receivableStatusColor: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  paid: "bg-green-500/20 text-green-500",
  overdue: "bg-destructive/20 text-destructive",
};

const ProgressBar = ({ value, total }: { value: number; total: number }) => {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-green-500" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{pct}%</span>
    </div>
  );
};

interface NewOrderForm {
  budgetId: string;
  items: Array<{ description: string; quantityTotal: string }>;
}

interface ShipmentForm {
  notes: string;
  shippedAt: string;
  quantities: Record<string, string>;
}

interface InstallmentsForm {
  totalAmount: string;
  paymentType: "avista" | "parcelado";
  daysInput: string;
  days: number[];
}

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [requestError, setRequestError] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoadingBudgets, setIsLoadingBudgets] = useState(false);

  // Create order modal
  const [createModal, setCreateModal] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState<NewOrderForm>({ budgetId: "", items: [{ description: "", quantityTotal: "" }] });
  const [createError, setCreateError] = useState("");
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // Update produced modal
  const [producedModal, setProducedModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [producedValue, setProducedValue] = useState("");
  const [producedError, setProducedError] = useState("");
  const [isSavingProduced, setIsSavingProduced] = useState(false);

  // Shipment modal
  const [shipmentModal, setShipmentModal] = useState(false);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isLoadingShipments, setIsLoadingShipments] = useState(false);
  const [shipmentForm, setShipmentForm] = useState<ShipmentForm>({ notes: "", shippedAt: "", quantities: {} });
  const [shipmentError, setShipmentError] = useState("");
  const [isSavingShipment, setIsSavingShipment] = useState(false);

  // Receivables
  const [receivablesModal, setReceivablesModal] = useState(false);
  const [receivables, setReceivables] = useState<AccountReceivable[]>([]);
  const [isLoadingReceivables, setIsLoadingReceivables] = useState(false);
  const [installmentsModal, setInstallmentsModal] = useState(false);
  const [installmentsForm, setInstallmentsForm] = useState<InstallmentsForm>({
    totalAmount: "",
    paymentType: "parcelado",
    daysInput: "",
    days: [30, 60, 90],
  });
  const [installmentsError, setInstallmentsError] = useState("");
  const [isSavingInstallments, setIsSavingInstallments] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  const loadOrders = async () => {
    setIsLoading(true);
    setRequestError("");
    try {
      const data = await listOrders(statusFilter ? { status: statusFilter } : undefined);
      setOrders(data);
    } catch (err) {
      setRequestError(err instanceof ApiError ? err.message : "Não foi possível carregar pedidos.");
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBudgets = async () => {
    setIsLoadingBudgets(true);
    try {
      const data = await listBudgets();
      setBudgets(data.filter((b) => b.status === "approved"));
    } catch {
      setBudgets([]);
    } finally {
      setIsLoadingBudgets(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [statusFilter]);

  const openDetail = async (order: Order) => {
    const isExpanding = expandedId !== order.id;
    setExpandedId(isExpanding ? order.id : null);
    if (!isExpanding) {
      setDetailOrder(null);
      return;
    }
    setIsLoadingDetail(true);
    try {
      const full = await getOrder(order.id);
      setDetailOrder(full);
    } catch {
      setDetailOrder(order);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const openCreateModal = () => {
    void loadBudgets();
    setNewOrderForm({ budgetId: "", items: [{ description: "", quantityTotal: "" }] });
    setCreateError("");
    setCreateModal(true);
  };

  const addOrderItem = () =>
    setNewOrderForm((prev) => ({ ...prev, items: [...prev.items, { description: "", quantityTotal: "" }] }));

  const removeOrderItem = (index: number) =>
    setNewOrderForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

  const updateOrderItem = (index: number, field: "description" | "quantityTotal", value: string) =>
    setNewOrderForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });

  const saveOrder = async () => {
    if (!newOrderForm.budgetId) {
      setCreateError("Selecione um orçamento.");
      return;
    }
    const items = newOrderForm.items.map((item) => ({
      description: item.description.trim(),
      quantityTotal: Number(item.quantityTotal),
    }));
    if (items.some((i) => !i.description || !Number.isFinite(i.quantityTotal) || i.quantityTotal <= 0)) {
      setCreateError("Preencha descrição e quantidade válida para todos os itens.");
      return;
    }
    setIsSavingOrder(true);
    setCreateError("");
    try {
      await createOrder({ budgetId: newOrderForm.budgetId, items });
      setCreateModal(false);
      void loadOrders();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Não foi possível criar o pedido.");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const openProducedModal = (item: OrderItem) => {
    setSelectedItem(item);
    setProducedValue(String(item.quantityProduced));
    setProducedError("");
    setProducedModal(true);
  };

  const saveProduced = async () => {
    if (!selectedItem || !detailOrder) return;
    const qty = Number(producedValue);
    if (!Number.isFinite(qty) || qty < 0) {
      setProducedError("Informe uma quantidade válida.");
      return;
    }
    setIsSavingProduced(true);
    setProducedError("");
    try {
      const updated = await updateItemProduced(detailOrder.id, selectedItem.id, qty);
      setDetailOrder((prev) => {
        if (!prev) return prev;
        return { ...prev, items: prev.items.map((i) => (i.id === updated.id ? updated : i)) };
      });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === detailOrder.id
            ? { ...o, items: o.items.map((i) => (i.id === updated.id ? updated : i)) }
            : o,
        ),
      );
      setProducedModal(false);
    } catch (err) {
      setProducedError(err instanceof ApiError ? err.message : "Não foi possível atualizar.");
    } finally {
      setIsSavingProduced(false);
    }
  };

  const openShipmentModal = async (order: Order) => {
    setShipmentError("");
    const currentDetail = detailOrder?.id === order.id ? detailOrder : order;
    const initQtys: Record<string, string> = {};
    currentDetail.items.forEach((i) => (initQtys[i.id] = ""));
    setShipmentForm({ notes: "", shippedAt: "", quantities: initQtys });
    setIsLoadingShipments(true);
    setShipmentModal(true);
    try {
      const data = await listShipments(order.id);
      setShipments(data);
    } catch {
      setShipments([]);
    } finally {
      setIsLoadingShipments(false);
    }
  };

  const saveShipment = async () => {
    if (!detailOrder) return;
    const items = Object.entries(shipmentForm.quantities)
      .map(([orderItemId, qty]) => ({ orderItemId, quantity: Number(qty) }))
      .filter((i) => Number.isFinite(i.quantity) && i.quantity > 0);
    if (items.length === 0) {
      setShipmentError("Informe ao menos um item com quantidade > 0.");
      return;
    }
    setIsSavingShipment(true);
    setShipmentError("");
    try {
      const body: Parameters<typeof createShipment>[0] = { orderId: detailOrder.id, items };
      if (shipmentForm.notes.trim()) body.notes = shipmentForm.notes.trim();
      if (shipmentForm.shippedAt) body.shippedAt = new Date(shipmentForm.shippedAt).toISOString();
      await createShipment(body);
      const [updatedOrder, updatedShipments] = await Promise.all([
        getOrder(detailOrder.id),
        listShipments(detailOrder.id),
      ]);
      setDetailOrder(updatedOrder);
      setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
      setShipments(updatedShipments);
      setShipmentForm((prev) => {
        const initQtys: Record<string, string> = {};
        updatedOrder.items.forEach((i) => (initQtys[i.id] = ""));
        return { ...prev, quantities: initQtys };
      });
    } catch (err) {
      setShipmentError(err instanceof ApiError ? err.message : "Não foi possível registrar a expedição.");
    } finally {
      setIsSavingShipment(false);
    }
  };

  const openReceivables = async (order: Order) => {
    setIsLoadingReceivables(true);
    setReceivablesModal(true);
    try {
      const data = await listReceivables(order.id);
      setReceivables(data);
    } catch {
      setReceivables([]);
    } finally {
      setIsLoadingReceivables(false);
    }
  };

  const openInstallments = () => {
    setInstallmentsForm({ totalAmount: "", paymentType: "parcelado", daysInput: "", days: [30, 60, 90] });
    setInstallmentsError("");
    setInstallmentsModal(true);
  };

  const addDay = () => {
    const d = Number(installmentsForm.daysInput.trim());
    if (!Number.isFinite(d) || d <= 0) {
      setInstallmentsError("Informe um prazo válido (dias > 0).");
      return;
    }
    setInstallmentsForm((prev) => ({ ...prev, days: [...prev.days, d], daysInput: "" }));
    setInstallmentsError("");
  };

  const removeDay = (index: number) =>
    setInstallmentsForm((prev) => ({ ...prev, days: prev.days.filter((_, i) => i !== index) }));

  const saveInstallments = async () => {
    if (!detailOrder) return;
    const totalAmount = Number(installmentsForm.totalAmount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      setInstallmentsError("Informe um valor total válido.");
      return;
    }
    if (installmentsForm.days.length === 0) {
      setInstallmentsError("Adicione ao menos um prazo.");
      return;
    }
    setIsSavingInstallments(true);
    setInstallmentsError("");
    try {
      const data = await generateInstallments({
        orderId: detailOrder.id,
        totalAmount,
        paymentType: installmentsForm.paymentType,
        installmentDays: installmentsForm.days,
      });
      setReceivables(data);
      setInstallmentsModal(false);
    } catch (err) {
      setInstallmentsError(err instanceof ApiError ? err.message : "Não foi possível gerar parcelas.");
    } finally {
      setIsSavingInstallments(false);
    }
  };

  const markAsPaid = async (receivable: AccountReceivable) => {
    setMarkingPaidId(receivable.id);
    try {
      const updated = await updateReceivable(receivable.id, { status: "paid" });
      setReceivables((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch {
      // silently fail; user can retry
    } finally {
      setMarkingPaidId(null);
    }
  };

  const currentDetailOrder = detailOrder;
  const currentDetailItems = currentDetailOrder?.items ?? [];

  const columns = [
    {
      key: "status",
      header: "Status",
      render: (order: Order) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${statusColor[order.status]}`}>
          {order.status === "production" && <Clock className="h-3 w-3" />}
          {order.status === "partial" && <Package className="h-3 w-3" />}
          {order.status === "completed" && <CheckCircle2 className="h-3 w-3" />}
          {statusLabel[order.status]}
        </span>
      ),
    },
    {
      key: "items",
      header: "Itens",
      render: (order: Order) => <span className="font-mono text-sm">{order.items.length}</span>,
    },
    {
      key: "progress",
      header: "Progresso de Produção",
      render: (order: Order) => {
        const total = order.items.reduce((s, i) => s + i.quantityTotal, 0);
        const produced = order.items.reduce((s, i) => s + i.quantityProduced, 0);
        return <ProgressBar value={produced} total={total} />;
      },
    },
    {
      key: "expedited",
      header: "Expedido",
      render: (order: Order) => {
        const total = order.items.reduce((s, i) => s + i.quantityTotal, 0);
        const shipped = order.items.reduce((s, i) => s + i.quantityShipped, 0);
        return <ProgressBar value={shipped} total={total} />;
      },
    },
    {
      key: "createdAt",
      header: "Criado em",
      mono: true,
      render: (order: Order) => formatDateTime(order.createdAt),
    },
    {
      key: "expand",
      header: "",
      render: (order: Order) => (
        <button
          onClick={(e) => { e.stopPropagation(); void openDetail(order); }}
          className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
          title="Ver detalhes"
        >
          {expandedId === order.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      ),
    },
  ];

  return (
    <DashboardLayout
      title="Pedidos"
      subtitle="Controle de produção e expedição por pedido"
      action={
        <button
          onClick={openCreateModal}
          className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> NOVO PEDIDO
        </button>
      }
    >
      <div className="animate-fade-in space-y-6">
        {requestError && (
          <div className="border border-destructive/40 bg-destructive/10 rounded px-3 py-2 text-sm text-destructive flex items-center justify-between gap-3">
            <span>{requestError}</span>
            <button onClick={() => void loadOrders()} className="px-2 py-1 text-[11px] font-bold rounded border border-destructive/30 hover:bg-destructive/20">
              TENTAR NOVAMENTE
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-sm text-muted-foreground">Filtrar:</span>
          {(["", "production", "partial", "completed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-secondary"}`}
            >
              {s === "" ? "Todos" : statusLabel[s]}
            </button>
          ))}
        </div>

        <DataTable
          columns={columns}
          data={orders}
          emptyMessage={isLoading ? "Carregando pedidos..." : "Nenhum pedido encontrado."}
        />

        {/* Expanded detail */}
        {expandedId && (
          <div className="border border-border rounded-lg p-4 space-y-4 bg-card">
            {isLoadingDetail ? (
              <p className="text-sm text-muted-foreground">Carregando detalhes...</p>
            ) : currentDetailOrder ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm">
                    Pedido: <span className="font-mono text-muted-foreground">{currentDetailOrder.id.slice(0, 8)}…</span>
                    <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${statusColor[currentDetailOrder.status]}`}>
                      {statusLabel[currentDetailOrder.status]}
                    </span>
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void openReceivables(currentDetailOrder)}
                      className="px-3 py-1.5 text-xs rounded border border-border hover:bg-secondary transition-colors"
                    >
                      Financeiro
                    </button>
                    <button
                      onClick={() => void openShipmentModal(currentDetailOrder)}
                      className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:opacity-90"
                    >
                      <Truck className="h-3.5 w-3.5 inline mr-1" /> Registrar Expedição
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground text-xs uppercase tracking-wider">
                        <th className="pb-2 pr-4">Descrição</th>
                        <th className="pb-2 pr-4 text-right">Total</th>
                        <th className="pb-2 pr-4 text-right">Produzido</th>
                        <th className="pb-2 pr-4 text-right">Expedido</th>
                        <th className="pb-2 pr-4 text-right">Restante</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {currentDetailItems.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 pr-4">{item.description}</td>
                          <td className="py-2 pr-4 text-right font-mono">{item.quantityTotal}</td>
                          <td className="py-2 pr-4 text-right font-mono">{item.quantityProduced}</td>
                          <td className="py-2 pr-4 text-right font-mono">{item.quantityShipped}</td>
                          <td className="py-2 pr-4 text-right font-mono">
                            {item.remaining === 0 ? (
                              <span className="text-green-500 font-bold">✓</span>
                            ) : (
                              <span className={item.remaining > 0 ? "text-yellow-400" : ""}>{item.remaining}</span>
                            )}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              onClick={() => openProducedModal(item)}
                              className="px-2 py-1 text-[11px] rounded border border-border hover:bg-secondary transition-colors"
                            >
                              Atualizar produzido
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      <Modal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="Novo Pedido"
        footer={
          <>
            <button onClick={() => setCreateModal(false)} className="px-4 py-2 text-sm rounded border border-border hover:bg-secondary">
              Cancelar
            </button>
            <button
              onClick={() => void saveOrder()}
              disabled={isSavingOrder}
              className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {isSavingOrder ? "Salvando..." : "Criar Pedido"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {createError && <div className="text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded px-3 py-2">{createError}</div>}

          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">Orçamento Aprovado *</label>
            {isLoadingBudgets ? (
              <p className="text-xs text-muted-foreground">Carregando orçamentos...</p>
            ) : (
              <select
                value={newOrderForm.budgetId}
                onChange={(e) => setNewOrderForm((prev) => ({ ...prev, budgetId: e.target.value }))}
                className="w-full px-3 py-2 rounded border border-border bg-background text-sm"
              >
                <option value="">Selecione...</option>
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.clientName} — {b.description?.slice(0, 40)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Itens do Pedido</span>
              <button onClick={addOrderItem} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Plus className="h-3 w-3" /> Adicionar item
              </button>
            </div>
            {newOrderForm.items.map((item, index) => (
              <div key={index} className="border border-border rounded p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium">Item {index + 1}</span>
                  {newOrderForm.items.length > 1 && (
                    <button onClick={() => removeOrderItem(index)} className="text-xs text-destructive hover:underline">
                      Remover
                    </button>
                  )}
                </div>
                <FormField
                  label="Descrição *"
                  value={item.description}
                  onChange={(e) => updateOrderItem(index, "description", e.target.value)}
                  placeholder="Ex.: Caixas 30x20x15 kraft"
                />
                <FormField
                  label="Quantidade Total *"
                  type="number"
                  value={item.quantityTotal}
                  onChange={(e) => updateOrderItem(index, "quantityTotal", e.target.value)}
                  placeholder="Ex.: 1000"
                />
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Update Produced Modal */}
      <Modal
        open={producedModal}
        onClose={() => setProducedModal(false)}
        title="Atualizar Quantidade Produzida"
        footer={
          <>
            <button onClick={() => setProducedModal(false)} className="px-4 py-2 text-sm rounded border border-border hover:bg-secondary">
              Cancelar
            </button>
            <button
              onClick={() => void saveProduced()}
              disabled={isSavingProduced}
              className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {isSavingProduced ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {producedError && <div className="text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded px-3 py-2">{producedError}</div>}
          {selectedItem && (
            <>
              <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono text-center">
                <div className="border border-border rounded p-2">
                  <div className="text-muted-foreground mb-1">Total</div>
                  <div className="font-bold">{selectedItem.quantityTotal}</div>
                </div>
                <div className="border border-border rounded p-2">
                  <div className="text-muted-foreground mb-1">Expedido</div>
                  <div className="font-bold">{selectedItem.quantityShipped}</div>
                </div>
                <div className="border border-yellow-500/30 bg-yellow-500/10 rounded p-2">
                  <div className="text-muted-foreground mb-1">Produzido atual</div>
                  <div className="font-bold text-yellow-400">{selectedItem.quantityProduced}</div>
                </div>
              </div>
            </>
          )}
          <FormField
            label={`Quantidade Produzida (máx: ${selectedItem?.quantityTotal ?? 0})`}
            type="number"
            value={producedValue}
            onChange={(e) => setProducedValue(e.target.value)}
          />
        </div>
      </Modal>

      {/* Shipment Modal */}
      <Modal
        open={shipmentModal}
        onClose={() => setShipmentModal(false)}
        title="Registrar Expedição"
        footer={
          <>
            <button onClick={() => setShipmentModal(false)} className="px-4 py-2 text-sm rounded border border-border hover:bg-secondary">
              Cancelar
            </button>
            <button
              onClick={() => void saveShipment()}
              disabled={isSavingShipment}
              className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {isSavingShipment ? "Registrando..." : "Registrar Expedição"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {shipmentError && <div className="text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded px-3 py-2">{shipmentError}</div>}

          <FormField
            label="Data de Expedição"
            type="datetime-local"
            value={shipmentForm.shippedAt}
            onChange={(e) => setShipmentForm((prev) => ({ ...prev, shippedAt: e.target.value }))}
          />
          <FormField
            label="Observações"
            value={shipmentForm.notes}
            onChange={(e) => setShipmentForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Ex.: Nota fiscal 12345"
          />

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quantidades por Item</p>
            {currentDetailItems.map((item) => {
              const avail = item.remaining;
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="flex-1 text-sm truncate">{item.description}</div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">máx: {avail}</div>
                  {avail === 0 ? (
                    <span className="text-[11px] text-green-500 font-bold px-2">✓ Completo</span>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      max={avail}
                      value={shipmentForm.quantities[item.id] ?? ""}
                      onChange={(e) =>
                        setShipmentForm((prev) => ({ ...prev, quantities: { ...prev.quantities, [item.id]: e.target.value } }))
                      }
                      className="w-24 px-2 py-1 rounded border border-border bg-background text-sm font-mono text-right"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Shipment history */}
          {isLoadingShipments ? (
            <p className="text-xs text-muted-foreground">Carregando histórico...</p>
          ) : shipments.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expedições Anteriores</p>
              {shipments.map((s) => (
                <div key={s.id} className="border border-border rounded px-3 py-2 text-xs space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{formatDate(s.shippedAt)}</span>
                    <span className="font-mono">{s.items.reduce((sum, i) => sum + i.quantity, 0)} un.</span>
                  </div>
                  {s.notes && <div className="text-muted-foreground italic">{s.notes}</div>}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Modal>

      {/* Receivables Modal */}
      <Modal
        open={receivablesModal}
        onClose={() => setReceivablesModal(false)}
        title="Financeiro do Pedido"
        footer={
          <button onClick={() => setReceivablesModal(false)} className="px-4 py-2 text-sm rounded border border-border hover:bg-secondary">
            Fechar
          </button>
        }
      >
        <div className="space-y-4">
          <button
            onClick={openInstallments}
            className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:opacity-90"
          >
            Gerar / Regerar Parcelas
          </button>

          {isLoadingReceivables ? (
            <p className="text-sm text-muted-foreground">Carregando parcelas...</p>
          ) : receivables.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma parcela gerada ainda.</p>
          ) : (
            <div className="space-y-2">
              {receivables.map((r) => (
                <div key={r.id} className="border border-border rounded px-3 py-2 flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">{formatCurrency(r.amount)}</div>
                    <div className="text-xs text-muted-foreground">
                      Parcela {r.installment} · Vencimento: {formatDate(r.dueDate)}
                      {r.paidAt && <span className="ml-2 text-green-500">Pago em {formatDate(r.paidAt)}</span>}
                    </div>
                    {r.notes && <div className="text-xs italic text-muted-foreground">{r.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${receivableStatusColor[r.status]}`}>
                      {receivableStatusLabel[r.status]}
                    </span>
                    {r.status !== "paid" && (
                      <button
                        onClick={() => void markAsPaid(r)}
                        disabled={markingPaidId === r.id}
                        className="px-2 py-0.5 text-[11px] rounded border border-green-500/30 text-green-500 hover:bg-green-500/10 disabled:opacity-50"
                      >
                        {markingPaidId === r.id ? "..." : "Marcar Pago"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Installments Modal */}
      <Modal
        open={installmentsModal}
        onClose={() => setInstallmentsModal(false)}
        title="Gerar Parcelas"
        footer={
          <>
            <button onClick={() => setInstallmentsModal(false)} className="px-4 py-2 text-sm rounded border border-border hover:bg-secondary">
              Cancelar
            </button>
            <button
              onClick={() => void saveInstallments()}
              disabled={isSavingInstallments}
              className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {isSavingInstallments ? "Gerando..." : "Gerar Parcelas"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {installmentsError && (
            <div className="text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded px-3 py-2">
              {installmentsError}
            </div>
          )}

          <div className="border border-yellow-500/20 bg-yellow-500/5 rounded px-3 py-2">
            <p className="text-xs text-yellow-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Atenção: gerar parcelas apaga e recria todas as existentes.
            </p>
          </div>

          <FormField
            label="Valor Total (R$) *"
            type="number"
            value={installmentsForm.totalAmount}
            onChange={(e) => setInstallmentsForm((prev) => ({ ...prev, totalAmount: e.target.value }))}
            placeholder="Ex.: 15000"
          />

          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">Tipo de Pagamento *</label>
            <select
              value={installmentsForm.paymentType}
              onChange={(e) => setInstallmentsForm((prev) => ({ ...prev, paymentType: e.target.value as "avista" | "parcelado" }))}
              className="w-full px-3 py-2 rounded border border-border bg-background text-sm"
            >
              <option value="parcelado">Parcelado</option>
              <option value="avista">À Vista</option>
            </select>
          </div>

          {installmentsForm.paymentType === "parcelado" && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Prazos (em dias a partir de hoje)</p>
              <div className="flex flex-wrap gap-1">
                {installmentsForm.days.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-xs font-mono">
                    +{d}d
                    <button onClick={() => removeDay(i)} className="text-muted-foreground hover:text-destructive ml-0.5">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <FormField
                  label="Adicionar prazo (dias)"
                  type="number"
                  value={installmentsForm.daysInput}
                  onChange={(e) => setInstallmentsForm((prev) => ({ ...prev, daysInput: e.target.value }))}
                  placeholder="Ex.: 90"
                />
                <button onClick={addDay} className="mt-5 px-3 py-2 text-sm rounded border border-border hover:bg-secondary shrink-0">
                  Adicionar
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default OrdersPage;
