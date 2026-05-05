import { useEffect, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ApiError } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  listDeliveryRoutes,
  createDeliveryRoute,
  updateDeliveryRoute,
  confirmDeliveryItem,
  deleteDeliveryRoute,
  type DeliveryRoute,
  type RouteStatus,
} from "@/services/delivery-routes";
import {
  Plus,
  Trash2,
  RefreshCw,
  MapPin,
  ChevronDown,
  ChevronUp,
  CheckSquare,
} from "lucide-react";

const formatDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";

const STATUS_LABELS: Record<RouteStatus, string> = {
  pending: "Pendente",
  in_transit: "Em Rota",
  completed: "Concluído",
  cancelled: "Cancelado",
};
const STATUS_STYLES: Record<RouteStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  in_transit: "bg-blue-500/15 text-blue-600",
  completed: "bg-green-500/15 text-green-600",
  cancelled: "bg-destructive/15 text-destructive",
};

interface ItemForm {
  clientName: string;
  address: string;
  quantity: number;
  notes: string;
}

export default function DeliveryRoutesPage() {
  const { toast } = useToast();
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [routeName, setRouteName] = useState("");
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemForm[]>([
    { clientName: "", address: "", quantity: 1, notes: "" },
  ]);

  const load = async () => {
    setLoading(true);
    try {
      setRoutes(await listDeliveryRoutes());
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
      await createDeliveryRoute({
        name: routeName,
        driverName: driver || null,
        vehicle: vehicle || null,
        scheduledDate: scheduledDate,
        notes: notes || null,
        items: items.map((i) => ({
          clientName: i.clientName,
          address: i.address,
          quantity: i.quantity,
        })),
      });
      toast({ title: "Roteiro criado" });
      setShowForm(false);
      setRouteName("");
      setDriver("");
      setVehicle("");
      setScheduledDate("");
      setNotes("");
      setItems([
        {
          clientName: "",
          address: "",
          quantity: 1,
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

  const handleStatusChange = async (id: string, status: RouteStatus) => {
    try {
      await updateDeliveryRoute(id, { status });
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

  const handleConfirmItem = async (routeId: string, itemId: string) => {
    const receivedBy = prompt("Quem recebeu? (nome do recebedor):");
    if (!receivedBy) return;
    try {
      await confirmDeliveryItem(routeId, itemId, { receivedBy });
      toast({ title: "Entrega confirmada" });
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
    if (!confirm("Excluir este roteiro?")) return;
    try {
      await deleteDeliveryRoute(id);
      toast({ title: "Roteiro excluído" });
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
        clientName: "",
        address: "",
        quantity: 1,
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
              <MapPin className="h-6 w-6" /> Roteiros de Entrega
            </h1>
            <p className="text-sm text-muted-foreground">
              Gestão de rotas e confirmação de entregas
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
              <Plus className="h-4 w-4" /> Novo Roteiro
            </button>
          </div>
        </div>

        {showForm && (
          <div className="border border-border rounded-lg p-5 bg-card space-y-4">
            <h2 className="font-semibold">Novo Roteiro de Entrega</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Nome do Roteiro *
                  </label>
                  <input
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Motorista
                  </label>
                  <input
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                    value={driver}
                    onChange={(e) => setDriver(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Veículo / Placa
                  </label>
                  <input
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Data Prevista *
                  </label>
                  <input
                    type="date"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Observações
                  </label>
                  <input
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">Paradas / Entregas</h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Adicionar parada
                  </button>
                </div>
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="border border-border rounded-lg p-3 space-y-3 bg-muted/20"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Cliente
                        </label>
                        <input
                          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                          value={item.clientName}
                          onChange={(e) =>
                            updateItem(i, "clientName", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Endereço *
                        </label>
                        <input
                          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                          value={item.address}
                          onChange={(e) =>
                            updateItem(i, "address", e.target.value)
                          }
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Quantidade
                        </label>
                        <input
                          type="number"
                          min={1}
                          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(i, "quantity", Number(e.target.value))
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
                        Remover parada
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
                  Criar Roteiro
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
        ) : routes.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Nenhum roteiro cadastrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {routes.map((r) => (
              <div
                key={r.id}
                className="border border-border rounded-lg bg-card overflow-hidden"
              >
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{r.driverName}</span>
                    {r.vehicle && (
                      <span className="text-xs text-muted-foreground">
                        {r.vehicle}
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.status]}`}
                    >
                      {STATUS_LABELS[r.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(r.scheduledDate)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.items.length} parada(s)
                    </span>
                    {expanded === r.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
                {expanded === r.id && (
                  <div className="border-t border-border px-4 py-4 space-y-4">
                    <div className="space-y-2">
                      {r.items.map((item, idx) => (
                        <div
                          key={item.id}
                          className={`flex items-start justify-between p-3 rounded-lg border ${item.status === "delivered" ? "border-green-500/30 bg-green-500/5" : item.status === "failed" ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/20"}`}
                        >
                          <div>
                            <div className="font-medium text-sm">
                              {idx + 1}. {item.address}
                            </div>
                            {item.contactName && (
                              <div className="text-xs text-muted-foreground">
                                {item.contactName}
                                {item.contactPhone
                                  ? ` — ${item.contactPhone}`
                                  : ""}
                              </div>
                            )}
                            {item.receivedBy && (
                              <div className="text-xs text-green-600">
                                Recebido por: {item.receivedBy}
                              </div>
                            )}
                          </div>
                          {item.status === "pending" &&
                            r.status === "in_transit" && (
                              <button
                                onClick={() => handleConfirmItem(r.id, item.id)}
                                className="flex items-center gap-1 text-xs text-green-600 hover:underline"
                              >
                                <CheckSquare className="h-4 w-4" /> Confirmar
                              </button>
                            )}
                          {item.status !== "pending" && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${item.status === "delivered" ? "bg-green-500/15 text-green-600" : "bg-destructive/15 text-destructive"}`}
                            >
                              {item.status === "delivered"
                                ? "Entregue"
                                : "Falhou"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Mudar status:
                      </span>
                      {(
                        [
                          "pending",
                          "in_transit",
                          "completed",
                          "cancelled",
                        ] as RouteStatus[]
                      ).map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(r.id, s)}
                          disabled={r.status === s}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${r.status === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                      {["pending", "cancelled"].includes(r.status) && (
                        <button
                          onClick={() => handleDelete(r.id)}
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
