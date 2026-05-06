import { useEffect, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { FormField } from "@/components/FormField";
import { StatusBadge } from "@/components/StatusBadge";
import { ApiError } from "@/services/api";
import { dispatchInventoryDataChanged } from "@/lib/inventory-events";
import {
  ApproveBudgetError,
  ApproveBudgetStockDetail,
  type BudgetApplicableCost as ApiBudgetApplicableCost,
  approveBudget,
  type BudgetExpenseDepartment as ApiBudgetExpenseDepartment,
  createBudget,
  type ExpenseDepartmentCatalogItem,
  formatApproveBudgetDetailMessage,
  getBudgetById,
  listBudgets,
  listExpenseDepartments,
  updateBudget,
  deleteBudget,
  type Budget as ApiBudget,
  type BudgetCategory,
  type BudgetMaterial as ApiBudgetMaterial,
  type BudgetStatus,
} from "@/services/budgets";
import { Client, listClients } from "@/services/clients";
import { Product, listProducts } from "@/services/products";
import {
  type PaperboardConfig,
  type PaperboardConfigInput,
  getPaperboardConfig,
  upsertPaperboardConfig,
  deletePaperboardConfig,
} from "@/services/paperboard";
import { useAuth } from "@/auth/AuthProvider";
import { Plus, Trash2 } from "lucide-react";

type MaterialInputMode = "existing" | "new";

const imageDataUrlCache: Record<string, string | null | undefined> = {};

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatStatus = (status: BudgetRow["status"]) => {
  switch (status) {
    case "draft":
      return "Rascunho";
    case "pre_approved":
      return "Pre-aprovado";
    case "pending":
      return "Pendente";
    case "approved":
      return "Aprovado";
    case "rejected":
      return "Rejeitado";
    default:
      return status;
  }
};

const formatCategory = (category: BudgetCategory) => {
  switch (category) {
    case "arquitetonico":
      return "Corte e vinco";
    case "executivo":
      return "Produção e expedição";
    default:
      return category;
  }
};

const normalizeMarginPercentage = (value: unknown) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  if (numeric <= 1) {
    return Math.max(0, numeric * 100);
  }

  return Math.max(0, numeric);
};

const sanitizeFileName = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

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

    reader.onerror = () =>
      reject(new Error("Falha ao carregar logo para PDF."));
    reader.readAsDataURL(blob);
  });

const loadImageDataUrl = async (imagePath: string) => {
  const cacheKey = imagePath;

  if (imageDataUrlCache[cacheKey] !== undefined) {
    return imageDataUrlCache[cacheKey] ?? null;
  }

  try {
    const response = await fetch(imagePath);

    if (!response.ok) {
      imageDataUrlCache[cacheKey] = null;
      return null;
    }

    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    imageDataUrlCache[cacheKey] = dataUrl;
    return dataUrl;
  } catch {
    imageDataUrlCache[cacheKey] = null;
    return null;
  }
};

const loadLogoDataUrl = async () => loadImageDataUrl("/4d.jpg");

type ProposalSectionLine = {
  text: string;
  indentLevel: number;
};

const PROPOSAL_DESCRIPTION_PLACEHOLDER = [
  "Papelão:",
  "  - Produção em C x L x A conforme necessidade do cliente.",
  "  - Definição de corte, vinco e acabamento.",
  "  - Avaliação de perda técnica por aproveitamento de chapa.",
].join("\n");

const PROPOSAL_NOTES_PLACEHOLDER = [
  "Observações:",
  "  - Material pode ser produzido internamente ou com corte terceirizado.",
  "  - Informar se há uso de chapa inteira para múltiplos projetos.",
  "  - Informar riscos de atraso e impacto no prazo de entrega.",
].join("\n");

const DEFAULT_BUDGET_PDF_PAYMENT_TERMS = [
  "Pagamento: Ato + boleto em 15/30/45 dias (conforme negociação).",
  "Prazo de pagamento e entrega sujeitos a ajuste por atraso logístico ou operacional.",
  "Proposta válida por 10 dias úteis.",
].join("\n");

const DEFAULT_BUDGET_VALIDITY_BUSINESS_DAYS = 10;
const PAPERBOARD_MATERIAL_COST_FACTOR = 0.0042;
const PAPERBOARD_DEFAULT_CUTTING_COST_PER_KG = 0.15;
const PAPERBOARD_DEFAULT_CREASING_COST_PER_KG = 0.08;
const PAPERBOARD_DEFAULT_MARKUP_PERCENTAGE = 35;

const PAYMENT_TERMS_PRESETS = [
  "Ato",
  "Boleto 15 dias",
  "Boleto 30 dias",
  "Boleto 45 dias",
  "Ato + boleto 15/30/45 dias",
].join("\n");

const DEFAULT_ARCHITECTURE_LINES: ProposalSectionLine[] = [
  { text: "Projeto ou laudo conforme layout aprovado.", indentLevel: 0 },
  { text: "A.R.T. do sistema e da execucao da obra.", indentLevel: 0 },
  { text: "Projeto eletrico e compatibilizacao tecnica.", indentLevel: 0 },
  { text: "Alinhamento final com comunicacao visual.", indentLevel: 0 },
];

const DEFAULT_ALVENARIA_LINES: ProposalSectionLine[] = [
  { text: "Demolicao e preparacao da area existente.", indentLevel: 0 },
  { text: "Instalacoes de base conforme projeto executivo.", indentLevel: 0 },
  {
    text: "Acabamentos finais de acordo com a aprovacao do cliente.",
    indentLevel: 0,
  },
];

const parseProposalSectionLines = (
  value: string | null | undefined,
  fallback: ProposalSectionLine[],
): ProposalSectionLine[] => {
  const parsed = (value || "")
    .split(/\r?\n/)
    .map((line) => {
      const leadingSpaces = line.match(/^\s*/)?.[0].length || 0;
      const indentLevel = Math.min(3, Math.floor(leadingSpaces / 2));
      const text = line.trim().replace(/^[-*•]\s*/, "");
      return {
        text,
        indentLevel,
      };
    })
    .filter((line) => line.text.length > 0);

  return parsed.length > 0 ? parsed : fallback;
};

interface BudgetItemRow {
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
}

interface BudgetExpenseDepartmentRow {
  expenseDepartmentId?: string;
  name: string;
  sector: string;
  amount: number;
}

interface BudgetApplicableCostRow {
  applicableCostId?: string;
  name: string;
  amount: number;
}

interface BudgetRow {
  id: string;
  clientId: string;
  clientName: string;
  category: BudgetCategory;
  description: string;
  status: BudgetStatus;
  estimatedDeliveryBusinessDays: number | null;
  validityBusinessDays: number;
  elapsedBusinessDays: number;
  remainingValidityBusinessDays: number;
  isExpired: boolean;
  deliveryDate: string;
  notes: string | null;
  paymentTerms: string | null;
  approvedAt: string | null;
  costsApplicableValue: number;
  costsAppliedAt: string | null;
  costsAppliedValue: number;
  remainingCostToApply: number;
  createdAt: string;
  updatedAt: string;
  items: BudgetItemRow[];
  expenseDepartments: BudgetExpenseDepartmentRow[];
  applicableCosts: BudgetApplicableCostRow[];
  materialCost: number;
  expenseDepartmentsCost: number;
  applicableCostsCost: number;
  laborCost: number;
  totalCost: number;
  profitMargin: number;
  finalPrice: number;
}

interface PaperboardPreview {
  estimatedCost: number;
  suggestedPrice: number;
  totalSheets: number;
  totalBundles: number;
}

const calculatePaperboardPreview = (
  input: PaperboardConfigInput,
): PaperboardPreview | null => {
  const length = Number(input.length);
  const width = Number(input.width);
  const height = Number(input.height);
  const gramatura = Number(input.gramatura);
  const quantity = Number(input.quantity);

  if (
    !Number.isFinite(length) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(gramatura) ||
    !Number.isFinite(quantity) ||
    length <= 0 ||
    width <= 0 ||
    height <= 0 ||
    gramatura <= 0 ||
    quantity <= 0
  ) {
    return null;
  }

  const areaCm2 = length * width;
  const sheetsPerBundle =
    input.sheetsPerBundle && input.sheetsPerBundle > 0
      ? input.sheetsPerBundle
      : null;
  const sheetUnitCost =
    input.sheetUnitCost && input.sheetUnitCost > 0 ? input.sheetUnitCost : null;
  const cuttingCostPerKg =
    input.cuttingCostPerKg ?? PAPERBOARD_DEFAULT_CUTTING_COST_PER_KG;
  const creasingCostPerKg =
    input.creasingCostPerKg ?? PAPERBOARD_DEFAULT_CREASING_COST_PER_KG;
  const lossPercentage = Math.max(0, Number(input.lossPercentage ?? 0));
  const markupPercentage = Math.max(
    0,
    Number(input.markupPercentage ?? PAPERBOARD_DEFAULT_MARKUP_PERCENTAGE),
  );
  const clicheCost = Number(input.clicheCost ?? 0);
  const clichePrice = Number(input.clichePrice ?? 0);

  const packageArea = Math.max(
    (length * width + 2 * height * (length + width)) / 10000,
    areaCm2 / 10000,
  );
  const lossFactor = input.usesFullSheet ? 1 + lossPercentage / 100 : 1;
  const totalArea = packageArea * quantity * lossFactor;

  const sheetArea = Math.max(areaCm2 / 10000, 0.0001);
  const totalSheets = Math.max(totalArea / sheetArea, 0);
  const totalBundles =
    sheetsPerBundle && sheetsPerBundle > 0
      ? Math.ceil(totalSheets / sheetsPerBundle)
      : 0;

  const baseMaterialCost =
    totalArea * gramatura * PAPERBOARD_MATERIAL_COST_FACTOR;
  const materialCost =
    sheetUnitCost && sheetUnitCost > 0
      ? totalSheets * sheetUnitCost
      : baseMaterialCost;
  const cuttingCost = input.outsourcedCut ? quantity * cuttingCostPerKg : 0;
  const creasingCost = quantity * creasingCostPerKg;
  const lossCost = input.usesFullSheet
    ? materialCost * (lossPercentage / 100)
    : 0;
  const clicheAppliedCost = input.isFirstPurchase ? clicheCost : 0;

  const estimatedCost =
    materialCost + cuttingCost + creasingCost + lossCost + clicheAppliedCost;
  const suggestedPrice =
    estimatedCost * (1 + markupPercentage / 100) +
    (input.isFirstPurchase ? clichePrice : 0);

  return {
    estimatedCost,
    suggestedPrice,
    totalSheets,
    totalBundles,
  };
};

const normalizeDateOnly = (value: string | null | undefined) => {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value.includes("T") ? value.split("T")[0] : value;
};

const parseBusinessDaysInput = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return Number.NaN;
  }

  return parsed;
};

const formatBusinessDaysLabel = (value: number | null | undefined) => {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    return "-";
  }

  const normalized = Math.trunc(Number(value));
  return `${normalized} ${normalized === 1 ? "dia util" : "dias uteis"}`;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const normalizeName = (value: string) => value.trim().toLowerCase();

const findClientByName = (clientsCatalog: Client[], clientName: string) => {
  const normalized = normalizeName(clientName);

  if (!normalized) {
    return undefined;
  }

  return clientsCatalog.find(
    (client) => normalizeName(client.name) === normalized,
  );
};

const buildClientAddress = (client: Client | undefined) => {
  if (!client) {
    return "";
  }

  const streetLine = [client.street, client.number].filter(Boolean).join(", ");
  const districtLine = [
    client.neighborhood,
    client.city && client.state
      ? `${client.city}/${client.state}`
      : client.city || client.state,
  ]
    .filter(Boolean)
    .join(" - ");
  const trailing = [
    client.complement,
    districtLine,
    client.postalCode ? `CEP ${client.postalCode}` : "",
  ]
    .filter(Boolean)
    .join(" • ");

  return [streetLine, trailing].filter(Boolean).join(" | ");
};

const normalizeBudgetError = (error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Sessao expirada. Redirecionando para login.";
    }

    if (error.status === 403) {
      return "Acesso negado. Somente admin e gerente podem gerenciar orçamentos.";
    }

    if (error.status === 409) {
      return "Conflito de produto duplicado para este material. Selecione um produto existente no catálogo.";
    }

    if (error.status === 500) {
      return "Erro interno ao processar orçamentos. Tente novamente.";
    }

    if (error.status === 400) {
      return `Erro de validação: ${error.message}`;
    }

    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

const extractExpenseDepartmentsFieldErrors = (error: unknown) => {
  if (!(error instanceof ApiError) || error.status !== 400) {
    return {} as Record<string, string>;
  }

  const payload = error.payload;

  if (!payload || typeof payload !== "object") {
    return {} as Record<string, string>;
  }

  const output: Record<string, string> = {};
  const candidates: Array<{ path?: string; message?: string }> = [];

  const record = payload as Record<string, unknown>;

  const collectCandidate = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return;
    }

    const item = value as Record<string, unknown>;
    candidates.push({
      path:
        typeof item.path === "string"
          ? item.path
          : typeof item.field === "string"
            ? item.field
            : undefined,
      message:
        typeof item.message === "string"
          ? item.message
          : typeof item.msg === "string"
            ? item.msg
            : undefined,
    });
  };

  if (Array.isArray(record.errors)) {
    record.errors.forEach(collectCandidate);
  }

  if (Array.isArray(record.details)) {
    record.details.forEach(collectCandidate);
  }

  const expensePathRegex =
    /expense(?:_|)departments?\[(\d+)\]\.(name|sector|amount)/i;

  candidates.forEach((candidate) => {
    if (!candidate.path) {
      return;
    }

    const match = candidate.path.match(expensePathRegex);

    if (!match) {
      return;
    }

    const [, index, field] = match;
    output[`${index}-${field.toLowerCase()}`] =
      candidate.message || "Campo invalido.";
  });

  return output;
};

const extractApplicableCostsFieldErrors = (error: unknown) => {
  if (!(error instanceof ApiError) || error.status !== 400) {
    return {} as Record<string, string>;
  }

  const payload = error.payload;

  if (!payload || typeof payload !== "object") {
    return {} as Record<string, string>;
  }

  const output: Record<string, string> = {};
  const candidates: Array<{ path?: string; message?: string }> = [];

  const record = payload as Record<string, unknown>;

  const collectCandidate = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return;
    }

    const item = value as Record<string, unknown>;
    candidates.push({
      path:
        typeof item.path === "string"
          ? item.path
          : typeof item.field === "string"
            ? item.field
            : undefined,
      message:
        typeof item.message === "string"
          ? item.message
          : typeof item.msg === "string"
            ? item.msg
            : undefined,
    });
  };

  if (Array.isArray(record.errors)) {
    record.errors.forEach(collectCandidate);
  }

  if (Array.isArray(record.details)) {
    record.details.forEach(collectCandidate);
  }

  const applicablePathRegex = /applicable(?:_|)costs?\[(\d+)\]\.(name|amount)/i;

  candidates.forEach((candidate) => {
    if (!candidate.path) {
      return;
    }

    const match = candidate.path.match(applicablePathRegex);

    if (!match) {
      return;
    }

    const [, index, field] = match;
    output[`${index}-${field.toLowerCase()}`] =
      candidate.message || "Campo invalido.";
  });

  return output;
};

const extractStatusFieldError = (error: unknown) => {
  if (!(error instanceof ApiError) || error.status !== 400) {
    return "";
  }

  const payload = error.payload;

  if (!payload || typeof payload !== "object") {
    return "";
  }

  const record = payload as Record<string, unknown>;
  const candidates: Array<{ path?: string; message?: string }> = [];

  const collectCandidate = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return;
    }

    const item = value as Record<string, unknown>;
    candidates.push({
      path:
        typeof item.path === "string"
          ? item.path
          : typeof item.field === "string"
            ? item.field
            : undefined,
      message:
        typeof item.message === "string"
          ? item.message
          : typeof item.msg === "string"
            ? item.msg
            : undefined,
    });
  };

  if (Array.isArray(record.errors)) {
    record.errors.forEach(collectCandidate);
  }

  if (Array.isArray(record.details)) {
    record.details.forEach(collectCandidate);
  }

  const statusError = candidates.find(
    (candidate) =>
      typeof candidate.path === "string" &&
      /(^|\.)status$/i.test(candidate.path),
  );

  return statusError?.message || "";
};

const mapBudgetItemFromApi = (item: ApiBudgetMaterial): BudgetItemRow => ({
  productId: item.productId || undefined,
  productName: item.productName,
  quantity: Number(item.quantity) || 0,
  unit: item.unit || "unidade",
  unitPrice: Number(item.unitPrice) || 0,
  subtotal: (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
});

const mapBudgetExpenseDepartmentFromApi = (
  department: ApiBudgetExpenseDepartment,
): BudgetExpenseDepartmentRow => ({
  expenseDepartmentId: department.expenseDepartmentId || undefined,
  name: department.name,
  sector: department.sector,
  amount: Math.max(0, Number(department.amount) || 0),
});

const mapBudgetApplicableCostFromApi = (
  cost: ApiBudgetApplicableCost,
): BudgetApplicableCostRow => ({
  applicableCostId: cost.applicableCostId || undefined,
  name: cost.name,
  amount: Math.max(0, Number(cost.amount) || 0),
});

const createEmptyMaterialInput = (mode: MaterialInputMode = "existing") => ({
  mode,
  productId: "",
  productName: "",
  quantity: 1,
  unit: "unidade",
  unitPrice: 0,
});

const createEmptyExpenseDepartment = (): BudgetExpenseDepartmentRow => ({
  expenseDepartmentId: undefined,
  name: "",
  sector: "",
  amount: 0,
});

const createEmptyApplicableCost = (): BudgetApplicableCostRow => ({
  applicableCostId: undefined,
  name: "",
  amount: 0,
});

const formatExpenseDepartmentSuggestion = (
  department: ExpenseDepartmentCatalogItem,
) =>
  `${department.name} - ${department.sector} (${formatCurrency(department.defaultAmount)})`;

const getStockBadge = (stockQuantity: number) => {
  if (stockQuantity <= 0) {
    return {
      label: "Precisa comprar",
      className: "bg-destructive/20 text-destructive",
    };
  }

  return {
    label: "Em estoque",
    className: "bg-success/20 text-success",
  };
};

const mapBudgetFromApi = (
  budget: ApiBudget,
  clientsCatalog: Client[] = [],
): BudgetRow => {
  const items = budget.materials.map(mapBudgetItemFromApi);
  const expenseDepartments = budget.expenseDepartments.map(
    mapBudgetExpenseDepartmentFromApi,
  );
  const applicableCosts = (budget.applicableCosts || []).map(
    mapBudgetApplicableCostFromApi,
  );
  const materialCost = items.reduce((sum, item) => sum + item.subtotal, 0);
  const applicableCostsFromList = applicableCosts.reduce(
    (sum, cost) => sum + cost.amount,
    0,
  );
  const costsApplicableValueFromApi = Number(
    budget.financialSummary?.costsApplicableValue ??
      budget.costsApplicableValue,
  );
  const hasCostsApplicableValueFromApi = Number.isFinite(
    costsApplicableValueFromApi,
  );
  const costsApplicableValue = hasCostsApplicableValueFromApi
    ? Math.max(0, costsApplicableValueFromApi)
    : Number.isFinite(Number(budget.financialSummary?.applicableCostsCost))
      ? Math.max(0, Number(budget.financialSummary?.applicableCostsCost))
      : applicableCostsFromList;
  const expenseDepartmentsCost = Number.isFinite(
    Number(budget.financialSummary?.expenseDepartmentsCost),
  )
    ? Math.max(0, Number(budget.financialSummary?.expenseDepartmentsCost))
    : expenseDepartments.reduce(
        (sum, department) => sum + department.amount,
        0,
      );
  const applicableCostsCost = costsApplicableValue;
  const apiTotalCost = Number(budget.totalCost);
  const apiLaborCost = Number(budget.laborCost);
  const apiFinalPrice = Number(budget.finalPrice ?? budget.totalPrice) || 0;
  const laborCost = Number.isFinite(apiLaborCost)
    ? Math.max(0, apiLaborCost)
    : Math.max(
        0,
        Number.isFinite(apiTotalCost)
          ? apiTotalCost -
              materialCost -
              expenseDepartmentsCost -
              applicableCostsCost
          : 0,
      );
  const totalCost = Number.isFinite(apiTotalCost)
    ? Math.max(0, apiTotalCost)
    : materialCost + laborCost + expenseDepartmentsCost + applicableCostsCost;
  const profitMargin =
    Number(budget.profitMarginPercentage) ||
    normalizeMarginPercentage(
      Number.isFinite(Number(budget.profitMargin))
        ? budget.profitMargin
        : totalCost > 0
          ? (apiFinalPrice - totalCost) / totalCost
          : 0,
    );
  const finalPrice =
    materialCost > 0
      ? Math.max(0, materialCost * (1 + profitMargin / 100))
      : Math.max(0, apiFinalPrice);

  const linkedClient = findClientByName(clientsCatalog, budget.clientName);
  const costsAppliedAt =
    budget.financialSummary?.costsAppliedAt ?? budget.costsAppliedAt ?? null;
  const costsAppliedValue = Math.max(
    0,
    Number(
      budget.financialSummary?.costsAppliedValue ??
        budget.costsAppliedValue ??
        0,
    ) || 0,
  );
  const remainingCostToApply = Math.max(
    0,
    Number(budget.financialSummary?.remainingCostToApply ?? 0) || 0,
  );
  const validityBusinessDays =
    Number.isFinite(Number(budget.validityBusinessDays)) &&
    Number(budget.validityBusinessDays) > 0
      ? Math.trunc(Number(budget.validityBusinessDays))
      : DEFAULT_BUDGET_VALIDITY_BUSINESS_DAYS;
  const elapsedBusinessDays = Math.max(
    0,
    Math.trunc(Number(budget.elapsedBusinessDays) || 0),
  );
  const remainingValidityBusinessDays = Number.isFinite(
    Number(budget.remainingValidityBusinessDays),
  )
    ? Math.max(0, Math.trunc(Number(budget.remainingValidityBusinessDays)))
    : Math.max(0, validityBusinessDays - elapsedBusinessDays);
  const isExpired =
    typeof budget.isExpired === "boolean"
      ? budget.isExpired
      : remainingValidityBusinessDays <= 0 || budget.status === "rejected";

  return {
    id: budget.id,
    clientId: linkedClient?.id || "",
    clientName: budget.clientName,
    category: budget.category,
    description: budget.description,
    status: budget.status,
    estimatedDeliveryBusinessDays: Number.isFinite(
      Number(budget.estimatedDeliveryBusinessDays),
    )
      ? Math.max(0, Math.trunc(Number(budget.estimatedDeliveryBusinessDays)))
      : null,
    validityBusinessDays,
    elapsedBusinessDays,
    remainingValidityBusinessDays,
    isExpired,
    deliveryDate: normalizeDateOnly(budget.deliveryDate),
    notes: budget.notes,
    paymentTerms: budget.paymentTerms || null,
    approvedAt: budget.approvedAt,
    costsApplicableValue,
    costsAppliedAt,
    costsAppliedValue,
    remainingCostToApply,
    createdAt: normalizeDateOnly(budget.createdAt),
    updatedAt: normalizeDateOnly(budget.updatedAt),
    items,
    expenseDepartments,
    applicableCosts,
    materialCost,
    expenseDepartmentsCost,
    applicableCostsCost,
    laborCost,
    totalCost,
    profitMargin,
    finalPrice,
  };
};

interface ContractFormState {
  contratanteName: string;
  operationName: string;
  projectAddress: string;
  kioskWidthMeters: number;
  kioskDepthMeters: number;
  contractValue: number;
  signatureCity: string;
  signatureDate: string;
  clauses: ContractClause[];
}

interface ContractClause {
  id: string;
  title: string;
  content: string;
}

const DEFAULT_CONTRACT_CLAUSES: Array<
  Pick<ContractClause, "title" | "content">
> = [
  {
    title: "CLÁUSULA 1 — DO OBJETO",
    content: [
      "O objeto deste contrato consiste no fornecimento de materiais e serviços para embalagens de papelão:",
      "• Definição técnica do produto (C x L x A)",
      "• Especificação de gramatura e estrutura de chapa",
      "• Processos de corte e vinco",
      "• Produção interna e/ou terceirização de corte, quando aplicável",
      "• Controle de quantidade por pedido e expedição",
      "• Apuração de perdas técnicas por aproveitamento de chapa",
      "• Itens adicionais de acabamento conforme orçamento aprovado",
      "",
      "Não incluso:",
      "• Serviços não descritos expressamente no orçamento",
      "• Alterações técnicas sem aprovação formal",
    ].join("\n"),
  },
  {
    title: "CLÁUSULA 2 — DO VALOR",
    content: [
      "A CONTRATANTE pagará à CONTRATADA o valor unitário de {{valor_contrato}}.",
      "O pagamento deverá ser efetuado da seguinte forma:",
      "(a) Parcela no ato da confirmação do pedido;",
      "(b) Demais parcelas em boleto, conforme prazo negociado (15/30/45 dias).",
    ].join("\n"),
  },
  {
    title: "CLÁUSULA 4 — DA GARANTIA",
    content:
      "A contratada oferece 90 (noventa) dias de garantia contra defeitos de fabricação ou instalação, não cobrindo danos decorrentes de mau uso, acidentes, intervenções de terceiros ou eventos naturais.",
  },
  {
    title: "CLÁUSULA 5 — DAS ALTERAÇÕES",
    content:
      "Qualquer alteração após o início da produção poderá gerar custos adicionais e prorrogação de prazo. Alterações somente serão feitas mediante autorização expressa.",
  },
  {
    title: "CLÁUSULA 6 — DA RESCISÃO",
    content:
      "A contratante poderá rescindir antes do início da produção, mediante multa de 20% do valor total. Após a aprovação do projeto e início da produção, não haverá reembolso dos valores pagos.",
  },
];

const createClauseId = () =>
  `clause-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createDefaultContractClauses = (): ContractClause[] =>
  DEFAULT_CONTRACT_CLAUSES.map((clause) => ({
    id: createClauseId(),
    title: clause.title,
    content: clause.content,
  }));

const getTodayInputDate = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatLongDate = (inputDate: string) => {
  const date = new Date(`${inputDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return inputDate;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

const replaceContractPlaceholders = (value: string, contractValue: number) =>
  value.replace(
    /\{\{\s*valor_contrato\s*\}\}/gi,
    formatCurrency(contractValue),
  );

const createInitialBudgetForm = () => ({
  clientId: "",
  category: "arquitetonico" as BudgetCategory,
  status: "draft" as BudgetStatus,
  description: "",
  estimatedDeliveryBusinessDays: "",
  notes: "",
  paymentTerms: PAYMENT_TERMS_PRESETS,
  laborCost: 0,
  costsApplicableValue: 0,
  profitMargin: 35,
  items: [] as BudgetItemRow[],
  expenseDepartments: [] as BudgetExpenseDepartmentRow[],
  applicableCosts: [] as BudgetApplicableCostRow[],
});

const createInitialDetailForm = () => ({
  clientName: "",
  category: "arquitetonico" as BudgetCategory,
  description: "",
  estimatedDeliveryBusinessDays: "",
  notes: "",
  paymentTerms: PAYMENT_TERMS_PRESETS,
  status: "draft" as BudgetStatus,
  totalPrice: 0,
  profitMargin: 35,
  costsApplicableValue: 0,
  items: [] as BudgetItemRow[],
  expenseDepartments: [] as BudgetExpenseDepartmentRow[],
  applicableCosts: [] as BudgetApplicableCostRow[],
});

const BudgetsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [data, setData] = useState<BudgetRow[]>([]);
  const [modal, setModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [requestError, setRequestError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [statusFieldError, setStatusFieldError] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [preApprovingId, setPreApprovingId] = useState<string | null>(null);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [selectedBudgetForContract, setSelectedBudgetForContract] =
    useState<BudgetRow | null>(null);
  const [isGeneratingContract, setIsGeneratingContract] = useState(false);
  const [contractFormError, setContractFormError] = useState("");
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<BudgetRow | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isUpdatingDetail, setIsUpdatingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailStatusFieldError, setDetailStatusFieldError] = useState("");
  const [productsCatalog, setProductsCatalog] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [expenseDepartmentsCatalog, setExpenseDepartmentsCatalog] = useState<
    ExpenseDepartmentCatalogItem[]
  >([]);
  const [
    isLoadingExpenseDepartmentsCatalog,
    setIsLoadingExpenseDepartmentsCatalog,
  ] = useState(false);
  const [expenseDepartmentsCatalogError, setExpenseDepartmentsCatalogError] =
    useState("");
  const [expenseDepartmentsSearch, setExpenseDepartmentsSearch] = useState("");
  const [detailExpenseDepartmentsSearch, setDetailExpenseDepartmentsSearch] =
    useState("");
  const [expenseDepartmentsFieldErrors, setExpenseDepartmentsFieldErrors] =
    useState<Record<string, string>>({});
  const [
    detailExpenseDepartmentsFieldErrors,
    setDetailExpenseDepartmentsFieldErrors,
  ] = useState<Record<string, string>>({});
  const [applicableCostsFieldErrors, setApplicableCostsFieldErrors] = useState<
    Record<string, string>
  >({});
  const [
    detailApplicableCostsFieldErrors,
    setDetailApplicableCostsFieldErrors,
  ] = useState<Record<string, string>>({});
  const [selectedToPreApprove, setSelectedToPreApprove] =
    useState<BudgetRow | null>(null);
  const [selectedToApprove, setSelectedToApprove] = useState<BudgetRow | null>(
    null,
  );
  const [approvalError, setApprovalError] = useState("");
  const [approvalDetails, setApprovalDetails] = useState<
    ApproveBudgetStockDetail[]
  >([]);
  const [clientsCatalog, setClientsCatalog] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [clientsError, setClientsError] = useState("");
  // Paperboard config state
  const [paperboardConfig, setPaperboardConfig] =
    useState<PaperboardConfig | null>(null);
  const [isPaperboardSectionOpen, setIsPaperboardSectionOpen] = useState(false);
  const [isLoadingPaperboard, setIsLoadingPaperboard] = useState(false);
  const [isSavingPaperboard, setIsSavingPaperboard] = useState(false);
  const [paperboardError, setPaperboardError] = useState("");
  const [paperboardForm, setPaperboardForm] = useState<PaperboardConfigInput>({
    length: 0,
    width: 0,
    height: 0,
    gramatura: 0,
    quantity: 0,
    sheetsPerBundle: undefined,
    sheetUnitCost: undefined,
    cuttingCostPerKg: undefined,
    creasingCostPerKg: undefined,
    lossPercentage: 0,
    markupPercentage: 35,
    usesFullSheet: false,
    outsourcedCut: false,
    isFirstPurchase: false,
    clicheCost: undefined,
    clichePrice: undefined,
  });
  const [detailForm, setDetailForm] = useState(createInitialDetailForm());
  const [form, setForm] = useState(createInitialBudgetForm);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    scope: "create" | "detail";
    previousStatus: BudgetStatus;
  } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"all" | BudgetCategory>(
    "all",
  );
  const [newItem, setNewItem] = useState(createEmptyMaterialInput);
  const [detailNewItem, setDetailNewItem] = useState(createEmptyMaterialInput);
  // CLA mode for creation
  const [createUseCla, setCreateUseCla] = useState(false);
  const [createClaForm, setCreateClaForm] = useState<PaperboardConfigInput>({
    length: 0,
    width: 0,
    height: 0,
    gramatura: 0,
    quantity: 0,
    sheetsPerBundle: undefined,
    sheetUnitCost: undefined,
    cuttingCostPerKg: undefined,
    creasingCostPerKg: undefined,
    lossPercentage: 0,
    markupPercentage: 35,
    usesFullSheet: false,
    outsourcedCut: false,
    isFirstPurchase: false,
    clicheCost: undefined,
    clichePrice: undefined,
  });

  const [contractForm, setContractForm] = useState<ContractFormState>({
    contratanteName: "",
    operationName: "",
    projectAddress: "",
    kioskWidthMeters: 3,
    kioskDepthMeters: 4,
    contractValue: 0,
    signatureCity: "São Paulo",
    signatureDate: getTodayInputDate(),
    clauses: createDefaultContractClauses(),
  });

  const loadBudgetsFromApi = async (
    availableClients: Client[] = clientsCatalog,
    activeCategoryFilter: "all" | BudgetCategory = categoryFilter,
  ) => {
    setIsLoading(true);
    setRequestError("");

    try {
      const budgets = await listBudgets(
        activeCategoryFilter === "all" ? undefined : activeCategoryFilter,
      );
      setData(
        budgets.map((budget) => mapBudgetFromApi(budget, availableClients)),
      );
    } catch (error) {
      setData([]);
      setRequestError(
        normalizeBudgetError(error, "Não foi possível carregar os orçamentos."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadClientsForForms = async () => {
    setIsLoadingClients(true);
    setClientsError("");

    try {
      const clients = await listClients();
      setClientsCatalog(clients);
      return clients;
    } catch (error) {
      setClientsCatalog([]);
      setClientsError(
        normalizeBudgetError(
          error,
          "Nao foi possivel carregar clientes para o formulario.",
        ),
      );
      return [] as Client[];
    } finally {
      setIsLoadingClients(false);
    }
  };

  useEffect(() => {
    void loadClientsForForms();
    void loadBudgetsFromApi();
  }, []);

  useEffect(() => {
    void loadBudgetsFromApi(clientsCatalog, categoryFilter);
  }, [categoryFilter]);

  useEffect(() => {
    if (clientsCatalog.length === 0) {
      return;
    }

    setData((current) =>
      current.map((budget) => {
        if (budget.clientId) {
          return budget;
        }

        const linkedClient = findClientByName(
          clientsCatalog,
          budget.clientName,
        );

        if (!linkedClient) {
          return budget;
        }

        return {
          ...budget,
          clientId: linkedClient.id,
        };
      }),
    );
  }, [clientsCatalog]);

  const loadProductsForForm = async () => {
    setIsLoadingProducts(true);
    setProductsError("");

    try {
      const products = await listProducts();
      setProductsCatalog(products);
    } catch (error) {
      setProductsCatalog([]);
      setProductsError(
        normalizeBudgetError(
          error,
          "Nao foi possivel carregar produtos para o formulario.",
        ),
      );
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const loadExpenseDepartmentsCatalog = async (search = "") => {
    setIsLoadingExpenseDepartmentsCatalog(true);
    setExpenseDepartmentsCatalogError("");

    try {
      const departments = await listExpenseDepartments(search);
      setExpenseDepartmentsCatalog(departments);
    } catch (error) {
      setExpenseDepartmentsCatalog([]);
      setExpenseDepartmentsCatalogError(
        normalizeBudgetError(
          error,
          "Nao foi possivel carregar departamentos de gasto.",
        ),
      );
    } finally {
      setIsLoadingExpenseDepartmentsCatalog(false);
    }
  };

  const openCreateModal = () => {
    setModal(true);
    setFormError("");
    setStatusFieldError("");
    setExpenseDepartmentsFieldErrors({});
    setApplicableCostsFieldErrors({});
    setExpenseDepartmentsSearch("");
    void loadClientsForForms();
    void loadProductsForForm();
    void loadExpenseDepartmentsCatalog();
  };

  useEffect(() => {
    if (!modal) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadExpenseDepartmentsCatalog(expenseDepartmentsSearch);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [expenseDepartmentsSearch, modal]);

  useEffect(() => {
    if (!detailModalOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadExpenseDepartmentsCatalog(detailExpenseDepartmentsSearch);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [detailExpenseDepartmentsSearch, detailModalOpen]);

  const requestStatusChange = (
    scope: "create" | "detail",
    nextStatus: BudgetStatus,
  ) => {
    if (nextStatus !== "pre_approved") {
      if (scope === "create") {
        setForm((current) => ({ ...current, status: nextStatus }));
        setStatusFieldError("");
      } else {
        setDetailForm((current) => ({ ...current, status: nextStatus }));
        setDetailStatusFieldError("");
      }
      return;
    }

    const previousStatus = scope === "create" ? form.status : detailForm.status;

    if (previousStatus === "pre_approved") {
      return;
    }

    setPendingStatusChange({
      scope,
      previousStatus,
    });
  };

  const cancelPreApprovedStatusChange = () => {
    if (pendingStatusChange?.scope === "create") {
      setForm((current) => ({
        ...current,
        status: pendingStatusChange.previousStatus,
      }));
    }

    if (pendingStatusChange?.scope === "detail") {
      setDetailForm((current) => ({
        ...current,
        status: pendingStatusChange.previousStatus,
      }));
    }

    setPendingStatusChange(null);
  };

  const confirmPreApprovedStatusChange = () => {
    if (!pendingStatusChange) {
      return;
    }

    if (pendingStatusChange.scope === "create") {
      setForm((current) => ({ ...current, status: "pre_approved" }));
      setStatusFieldError("");
    } else {
      setDetailForm((current) => ({ ...current, status: "pre_approved" }));
      setDetailStatusFieldError("");
    }

    setPendingStatusChange(null);
  };

  const clearApprovalFeedback = () => {
    setApprovalError("");
    setApprovalDetails([]);
  };

  const openPreApproveModal = (budget: BudgetRow) => {
    if (
      preApprovingId ||
      budget.status === "pre_approved" ||
      budget.status === "approved"
    ) {
      return;
    }

    setRequestError("");
    const shouldUseDetailCostsApplicableValue =
      detailModalOpen && selectedBudget?.id === budget.id;

    if (shouldUseDetailCostsApplicableValue) {
      setSelectedToPreApprove({
        ...budget,
        costsApplicableValue: Math.max(
          0,
          Number(detailForm.costsApplicableValue) || 0,
        ),
      });
      return;
    }

    setSelectedToPreApprove(budget);
  };

  const closePreApproveModal = () => {
    if (preApprovingId) {
      return;
    }

    setSelectedToPreApprove(null);
  };

  const executePreApproveBudget = async (
    budget: BudgetRow,
    options?: { costsApplicableValue?: number },
  ) => {
    if (preApprovingId) {
      return;
    }

    const budgetId = budget.id;
    setPreApprovingId(budgetId);
    setRequestError("");

    try {
      const preApprovePayload: {
        status: BudgetStatus;
        costsApplicableValue?: number;
      } = { status: "pre_approved" };

      preApprovePayload.costsApplicableValue = Math.max(
        0,
        Number(options?.costsApplicableValue ?? budget.costsApplicableValue) ||
          0,
      );

      const updated = mapBudgetFromApi(
        await updateBudget(budgetId, preApprovePayload),
        clientsCatalog,
      );

      setData((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );

      setSelectedBudget((current) => {
        if (!current || current.id !== updated.id) {
          return current;
        }

        return updated;
      });

      setDetailForm((current) => {
        if (!selectedBudget || selectedBudget.id !== updated.id) {
          return current;
        }

        return {
          ...current,
          status: updated.status,
          costsApplicableValue: updated.costsApplicableValue,
        };
      });

      closePreApproveModal();
      await loadBudgetsFromApi();
    } catch (error) {
      setRequestError(
        normalizeBudgetError(
          error,
          "Nao foi possivel pre-aprovar o orçamento.",
        ),
      );
    } finally {
      setPreApprovingId(null);
    }
  };

  const confirmPreApproveBudget = async () => {
    if (!selectedToPreApprove || preApprovingId) {
      return;
    }

    const shouldUseDetailCostsApplicableValue =
      detailModalOpen && selectedBudget?.id === selectedToPreApprove.id;

    await executePreApproveBudget(selectedToPreApprove, {
      costsApplicableValue: shouldUseDetailCostsApplicableValue
        ? Math.max(0, Number(detailForm.costsApplicableValue) || 0)
        : Math.max(0, Number(selectedToPreApprove.costsApplicableValue) || 0),
    });
  };

  const handleDetailPreApproveClick = async () => {
    if (
      !selectedBudget ||
      preApprovingId ||
      isUpdatingDetail ||
      isLoadingDetail
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Confirma pre-aprovar este orçamento e aplicar apenas os custos aplicáveis agora?",
    );

    if (!confirmed) {
      return;
    }

    await executePreApproveBudget(selectedBudget, {
      costsApplicableValue: Math.max(
        0,
        Number(detailForm.costsApplicableValue) || 0,
      ),
    });
  };

  const handleDeleteBudget = async (budget: BudgetRow) => {
    const Swal = (await import("sweetalert2")).default;
    const result = await Swal.fire({
      title: "Excluir orçamento?",
      html: `O orçamento de <b>${budget.clientName}</b> será excluído permanentemente.<br/>Esta ação não pode ser desfeita.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sim, excluir",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      await deleteBudget(budget.id);
      setData((current) => current.filter((b) => b.id !== budget.id));
      if (selectedBudget?.id === budget.id) {
        setDetailModalOpen(false);
        setSelectedBudget(null);
      }
      await Swal.fire({
        title: "Excluído!",
        text: "O orçamento foi excluído com sucesso.",
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch {
      await Swal.fire({
        title: "Erro",
        text: "Não foi possível excluir o orçamento. Tente novamente.",
        icon: "error",
      });
    }
  };

  const openApproveModal = (budget: BudgetRow) => {
    if (approvingId || budget.status !== "pre_approved") {
      return;
    }

    clearApprovalFeedback();
    setSelectedToApprove(budget);
  };

  const closeApproveModal = (force = false) => {
    if (!force && approvingId) {
      return;
    }

    setSelectedToApprove(null);
    clearApprovalFeedback();
  };

  const addItem = () => {
    const quantity = Number(newItem.quantity);
    const unitPrice = Number(newItem.unitPrice);
    const unit = newItem.unit.trim() || "unidade";
    const isExistingMode = newItem.mode === "existing";

    const product = isExistingMode
      ? productsCatalog.find((p) => p.id === newItem.productId)
      : undefined;
    const productName = isExistingMode
      ? product?.name || ""
      : newItem.productName.trim();

    if (!productName) {
      setFormError(
        isExistingMode
          ? "Selecione um produto valido."
          : "Informe o nome do material novo.",
      );
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError("Informe uma quantidade valida para o material.");
      return;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setFormError("Informe um valor unitario valido para o material.");
      return;
    }

    const item: BudgetItemRow = {
      productId: product?.id,
      productName,
      quantity,
      unit,
      unitPrice,
      subtotal: unitPrice * quantity,
    };

    setForm((current) => ({ ...current, items: [...current.items, item] }));
    setFormError("");
    setNewItem(createEmptyMaterialInput(newItem.mode));
  };

  const addDetailItem = () => {
    if (!selectedBudget) {
      return;
    }

    const quantity = Number(detailNewItem.quantity);
    const unitPrice = Number(detailNewItem.unitPrice);
    const unit = detailNewItem.unit.trim() || "unidade";
    const isExistingMode = detailNewItem.mode === "existing";

    const product = isExistingMode
      ? productsCatalog.find((p) => p.id === detailNewItem.productId)
      : undefined;
    const productName = isExistingMode
      ? product?.name || ""
      : detailNewItem.productName.trim();

    if (!productName) {
      setDetailError(
        isExistingMode
          ? "Selecione um produto valido."
          : "Informe o nome do material novo.",
      );
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setDetailError("Informe uma quantidade valida para o material.");
      return;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setDetailError("Informe um valor unitario valido para o material.");
      return;
    }

    const item: BudgetItemRow = {
      productId: product?.id,
      productName,
      quantity,
      unit,
      unitPrice,
      subtotal: unitPrice * quantity,
    };

    const nextItems = [...selectedBudget.items, item];

    setSelectedBudget((current) =>
      current
        ? {
            ...current,
            items: nextItems,
          }
        : current,
    );
    setDetailForm((current) => ({ ...current, items: nextItems }));
    setDetailError("");
    setDetailNewItem(createEmptyMaterialInput(detailNewItem.mode));
  };

  const removeItem = (idx: number) => {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, i) => i !== idx),
    }));
  };

  const addExpenseDepartment = () => {
    setForm((current) => ({
      ...current,
      expenseDepartments: [
        ...current.expenseDepartments,
        createEmptyExpenseDepartment(),
      ],
    }));
  };

  const addDetailExpenseDepartment = () => {
    if (!selectedBudget) {
      return;
    }

    const nextDepartments = [
      ...selectedBudget.expenseDepartments,
      createEmptyExpenseDepartment(),
    ];

    setSelectedBudget((current) =>
      current
        ? {
            ...current,
            expenseDepartments: nextDepartments,
          }
        : current,
    );
    setDetailForm((current) => ({
      ...current,
      expenseDepartments: nextDepartments,
    }));
  };

  const addApplicableCost = () => {
    setForm((current) => ({
      ...current,
      applicableCosts: [
        ...current.applicableCosts,
        createEmptyApplicableCost(),
      ],
    }));
  };

  const addDetailApplicableCost = () => {
    if (!selectedBudget) {
      return;
    }

    const nextApplicableCosts = [
      ...selectedBudget.applicableCosts,
      createEmptyApplicableCost(),
    ];

    setSelectedBudget((current) =>
      current
        ? {
            ...current,
            applicableCosts: nextApplicableCosts,
          }
        : current,
    );
    setDetailForm((current) => ({
      ...current,
      applicableCosts: nextApplicableCosts,
    }));
  };

  const removeExpenseDepartment = (index: number) => {
    setForm((current) => ({
      ...current,
      expenseDepartments: current.expenseDepartments.filter(
        (_, departmentIndex) => departmentIndex !== index,
      ),
    }));
    setExpenseDepartmentsFieldErrors((current) => {
      const nextEntries = Object.entries(current).filter(
        ([key]) => !key.startsWith(`${index}-`),
      );
      return Object.fromEntries(nextEntries);
    });
  };

  const removeDetailExpenseDepartment = (index: number) => {
    setSelectedBudget((current) => {
      if (!current) {
        return current;
      }

      const nextDepartments = current.expenseDepartments.filter(
        (_, departmentIndex) => departmentIndex !== index,
      );

      setDetailForm((detailCurrent) => ({
        ...detailCurrent,
        expenseDepartments: nextDepartments,
      }));

      return {
        ...current,
        expenseDepartments: nextDepartments,
      };
    });

    setDetailExpenseDepartmentsFieldErrors((current) => {
      const nextEntries = Object.entries(current).filter(
        ([key]) => !key.startsWith(`${index}-`),
      );
      return Object.fromEntries(nextEntries);
    });
  };

  const removeApplicableCost = (index: number) => {
    setForm((current) => ({
      ...current,
      applicableCosts: current.applicableCosts.filter(
        (_, costIndex) => costIndex !== index,
      ),
    }));

    setApplicableCostsFieldErrors((current) => {
      const nextEntries = Object.entries(current).filter(
        ([key]) => !key.startsWith(`${index}-`),
      );
      return Object.fromEntries(nextEntries);
    });
  };

  const removeDetailApplicableCost = (index: number) => {
    setSelectedBudget((current) => {
      if (!current) {
        return current;
      }

      const nextApplicableCosts = current.applicableCosts.filter(
        (_, costIndex) => costIndex !== index,
      );

      setDetailForm((detailCurrent) => ({
        ...detailCurrent,
        applicableCosts: nextApplicableCosts,
      }));

      return {
        ...current,
        applicableCosts: nextApplicableCosts,
      };
    });

    setDetailApplicableCostsFieldErrors((current) => {
      const nextEntries = Object.entries(current).filter(
        ([key]) => !key.startsWith(`${index}-`),
      );
      return Object.fromEntries(nextEntries);
    });
  };

  const updateExpenseDepartmentField = (
    index: number,
    field: keyof BudgetExpenseDepartmentRow,
    value: string | number,
  ) => {
    setForm((current) => ({
      ...current,
      expenseDepartments: current.expenseDepartments.map(
        (department, departmentIndex) => {
          if (departmentIndex !== index) {
            return department;
          }

          if (field === "amount") {
            return {
              ...department,
              amount: Math.max(0, Number(value) || 0),
            };
          }

          if (field === "expenseDepartmentId") {
            return {
              ...department,
              expenseDepartmentId:
                typeof value === "string" && value ? value : undefined,
            };
          }

          return {
            ...department,
            [field]: typeof value === "string" ? value : String(value),
          };
        },
      ),
    }));

    setExpenseDepartmentsFieldErrors((current) => {
      if (!current[`${index}-${field}`]) {
        return current;
      }

      const next = { ...current };
      delete next[`${index}-${field}`];
      return next;
    });
  };

  const updateDetailExpenseDepartmentField = (
    index: number,
    field: keyof BudgetExpenseDepartmentRow,
    value: string | number,
  ) => {
    if (!selectedBudget) {
      return;
    }

    const nextDepartments = selectedBudget.expenseDepartments.map(
      (department, departmentIndex) => {
        if (departmentIndex !== index) {
          return department;
        }

        if (field === "amount") {
          return {
            ...department,
            amount: Math.max(0, Number(value) || 0),
          };
        }

        if (field === "expenseDepartmentId") {
          return {
            ...department,
            expenseDepartmentId:
              typeof value === "string" && value ? value : undefined,
          };
        }

        return {
          ...department,
          [field]: typeof value === "string" ? value : String(value),
        };
      },
    );

    setSelectedBudget((current) =>
      current
        ? {
            ...current,
            expenseDepartments: nextDepartments,
          }
        : current,
    );
    setDetailForm((current) => ({
      ...current,
      expenseDepartments: nextDepartments,
    }));

    setDetailExpenseDepartmentsFieldErrors((current) => {
      if (!current[`${index}-${field}`]) {
        return current;
      }

      const next = { ...current };
      delete next[`${index}-${field}`];
      return next;
    });
  };

  const updateApplicableCostField = (
    index: number,
    field: keyof BudgetApplicableCostRow,
    value: string | number,
  ) => {
    setForm((current) => ({
      ...current,
      applicableCosts: current.applicableCosts.map((cost, costIndex) => {
        if (costIndex !== index) {
          return cost;
        }

        if (field === "amount") {
          return {
            ...cost,
            amount: Math.max(0, Number(value) || 0),
          };
        }

        if (field === "applicableCostId") {
          return {
            ...cost,
            applicableCostId:
              typeof value === "string" && value ? value : undefined,
          };
        }

        return {
          ...cost,
          [field]: typeof value === "string" ? value : String(value),
        };
      }),
    }));

    setApplicableCostsFieldErrors((current) => {
      if (!current[`${index}-${field}`]) {
        return current;
      }

      const next = { ...current };
      delete next[`${index}-${field}`];
      return next;
    });
  };

  const updateDetailApplicableCostField = (
    index: number,
    field: keyof BudgetApplicableCostRow,
    value: string | number,
  ) => {
    if (!selectedBudget) {
      return;
    }

    const nextApplicableCosts = selectedBudget.applicableCosts.map(
      (cost, costIndex) => {
        if (costIndex !== index) {
          return cost;
        }

        if (field === "amount") {
          return {
            ...cost,
            amount: Math.max(0, Number(value) || 0),
          };
        }

        if (field === "applicableCostId") {
          return {
            ...cost,
            applicableCostId:
              typeof value === "string" && value ? value : undefined,
          };
        }

        return {
          ...cost,
          [field]: typeof value === "string" ? value : String(value),
        };
      },
    );

    setSelectedBudget((current) =>
      current
        ? {
            ...current,
            applicableCosts: nextApplicableCosts,
          }
        : current,
    );
    setDetailForm((current) => ({
      ...current,
      applicableCosts: nextApplicableCosts,
    }));

    setDetailApplicableCostsFieldErrors((current) => {
      if (!current[`${index}-${field}`]) {
        return current;
      }

      const next = { ...current };
      delete next[`${index}-${field}`];
      return next;
    });
  };

  const applyCatalogToExpenseDepartment = (
    index: number,
    catalogId: string,
  ) => {
    const selectedCatalog = expenseDepartmentsCatalog.find(
      (department) => department.id === catalogId,
    );

    if (!selectedCatalog) {
      return;
    }

    setForm((current) => ({
      ...current,
      expenseDepartments: current.expenseDepartments.map(
        (department, departmentIndex) =>
          departmentIndex === index
            ? {
                expenseDepartmentId: selectedCatalog.id,
                name: selectedCatalog.name,
                sector: selectedCatalog.sector,
                amount: selectedCatalog.defaultAmount,
              }
            : department,
      ),
    }));
  };

  const applyCatalogToDetailExpenseDepartment = (
    index: number,
    catalogId: string,
  ) => {
    const selectedCatalog = expenseDepartmentsCatalog.find(
      (department) => department.id === catalogId,
    );

    if (!selectedCatalog || !selectedBudget) {
      return;
    }

    const nextDepartments = selectedBudget.expenseDepartments.map(
      (department, departmentIndex) =>
        departmentIndex === index
          ? {
              expenseDepartmentId: selectedCatalog.id,
              name: selectedCatalog.name,
              sector: selectedCatalog.sector,
              amount: selectedCatalog.defaultAmount,
            }
          : department,
    );

    setSelectedBudget((current) =>
      current
        ? {
            ...current,
            expenseDepartments: nextDepartments,
          }
        : current,
    );
    setDetailForm((current) => ({
      ...current,
      expenseDepartments: nextDepartments,
    }));
  };

  const validateExpenseDepartments = (
    departments: BudgetExpenseDepartmentRow[],
  ) => {
    const errors: Record<string, string> = {};

    departments.forEach((department, index) => {
      if (!department.name.trim()) {
        errors[`${index}-name`] = "Nome obrigatorio.";
      }

      if (!department.sector.trim()) {
        errors[`${index}-sector`] = "Setor obrigatorio.";
      }

      if (!Number.isFinite(department.amount) || department.amount < 0) {
        errors[`${index}-amount`] = "Valor deve ser maior ou igual a zero.";
      }
    });

    return errors;
  };

  const validateApplicableCosts = (costs: BudgetApplicableCostRow[]) => {
    const errors: Record<string, string> = {};

    costs.forEach((cost, index) => {
      if (!cost.name.trim()) {
        errors[`${index}-name`] = "Nome obrigatorio.";
      }

      if (!Number.isFinite(cost.amount) || cost.amount < 0) {
        errors[`${index}-amount`] = "Valor deve ser maior ou igual a zero.";
      }
    });

    return errors;
  };

  const marginPercentage = Math.max(0, Number(form.profitMargin) || 0);
  const marginDecimal = marginPercentage / 100;
  const createClaPreview = calculatePaperboardPreview(createClaForm);
  const materialCost = form.items.reduce(
    (sum, item) => sum + (Number(item.subtotal) || 0),
    0,
  );

  const expenseDepartmentsCost = form.expenseDepartments.reduce(
    (sum, department) => sum + (Number(department.amount) || 0),
    0,
  );
  const applicableCostsListCost = form.applicableCosts.reduce(
    (sum, cost) => sum + (Number(cost.amount) || 0),
    0,
  );

  const costsApplicableValue = Math.max(
    0,
    Number(form.costsApplicableValue) || 0,
  );

  const createBaseTotalForMargin =
    createUseCla && createClaPreview
      ? createClaPreview.suggestedPrice * (createClaForm.quantity || 1)
      : materialCost;
  const totalCostWithExpenses = createBaseTotalForMargin;
  const profitValueWithExpenses = totalCostWithExpenses * marginDecimal;
  const finalPriceWithExpenses = totalCostWithExpenses + profitValueWithExpenses;

  const detailMaterialCost = (detailForm.items || []).reduce(
    (sum, item) => sum + (Number(item.subtotal) || 0),
    0,
  );

  const detailExpenseDepartmentsCost = detailForm.expenseDepartments.reduce(
    (sum, department) => sum + (Number(department.amount) || 0),
    0,
  );
  const detailApplicableCostsCost = Math.max(
    0,
    Number(detailForm.costsApplicableValue) || 0,
  );

  const detailMarginPercentage = Math.max(
    0,
    Number(detailForm.profitMargin) || 0,
  );
  const detailMarginDecimal = detailMarginPercentage / 100;
  const detailBaseTotalForMargin =
    paperboardConfig?.suggestedPrice ?? detailMaterialCost;
  const detailTotalCostWithExpenses = detailBaseTotalForMargin;
  const detailProfitValueWithExpenses =
    detailTotalCostWithExpenses * detailMarginDecimal;
  const detailFinalPriceWithExpenses =
    detailTotalCostWithExpenses + detailProfitValueWithExpenses;
  const paperboardPreview = calculatePaperboardPreview(paperboardForm);
  const detailPersistedTotalCost = Math.max(
    0,
    Number(selectedBudget?.totalCost) || detailTotalCostWithExpenses,
  );
  const detailPersistedFinalPrice = Math.max(
    0,
    Number(selectedBudget?.finalPrice) || detailFinalPriceWithExpenses,
  );
  const detailTotalCostDisplay = detailPersistedTotalCost;
  const detailFinalPriceDisplay = detailPersistedFinalPrice;
  const detailClaMarginDisplay =
    (paperboardPreview?.estimatedCost ?? 0) > 0
      ? (((paperboardPreview?.suggestedPrice ?? 0) -
          (paperboardPreview?.estimatedCost ?? 0)) /
          (paperboardPreview?.estimatedCost ?? 1)) *
        100
      : 0;

  const closeCreateModal = () => {
    setModal(false);
    setFormError("");
    setStatusFieldError("");
    setForm(createInitialBudgetForm());
    setProductsError("");
    setExpenseDepartmentsCatalogError("");
    setExpenseDepartmentsSearch("");
    setExpenseDepartmentsFieldErrors({});
    setApplicableCostsFieldErrors({});
    setNewItem(createEmptyMaterialInput());
    setCreateUseCla(false);
    setCreateClaForm({
      length: 0,
      width: 0,
      height: 0,
      gramatura: 0,
      quantity: 0,
      sheetsPerBundle: undefined,
      sheetUnitCost: undefined,
      cuttingCostPerKg: undefined,
      creasingCostPerKg: undefined,
      lossPercentage: 0,
      markupPercentage: 35,
      usesFullSheet: false,
      outsourcedCut: false,
      isFirstPurchase: false,
      clicheCost: undefined,
      clichePrice: undefined,
    });
    setPendingStatusChange((current) =>
      current?.scope === "create" ? null : current,
    );
  };

  const saveBudget = async () => {
    const client = clientsCatalog.find((item) => item.id === form.clientId);

    if (!client) {
      setFormError("Selecione um cliente válido.");
      return;
    }

    if (!form.description.trim()) {
      setFormError("Informe a descrição do orçamento.");
      return;
    }

    if (!form.category) {
      setFormError("Selecione a categoria do orcamento.");
      return;
    }

    if (!form.status) {
      setStatusFieldError("Selecione um status para o orçamento.");
      setFormError("Selecione um status valido.");
      return;
    }

    const parsedEstimatedDeliveryBusinessDays = parseBusinessDaysInput(
      form.estimatedDeliveryBusinessDays,
    );

    if (parsedEstimatedDeliveryBusinessDays === null) {
      setFormError("Campo estimatedDeliveryBusinessDays é obrigatório.");
      return;
    }

    if (Number.isNaN(parsedEstimatedDeliveryBusinessDays)) {
      setFormError(
        "estimatedDeliveryBusinessDays deve ser um número inteiro maior que zero.",
      );
      return;
    }

    const normalizedFormCostsApplicableValue = Number(
      form.costsApplicableValue ?? 0,
    );
    if (
      !Number.isFinite(normalizedFormCostsApplicableValue) ||
      normalizedFormCostsApplicableValue < 0
    ) {
      setFormError(
        "Informe um custo aplicavel valido (maior ou igual a zero).",
      );
      return;
    }

    const normalizedProfitMargin = Number(form.profitMargin);

    if (
      !Number.isFinite(normalizedProfitMargin) ||
      normalizedProfitMargin < 0 ||
      normalizedProfitMargin > 100
    ) {
      setFormError("A margem de lucro deve estar entre 0 e 100.");
      return;
    }

    if (createUseCla && !createClaPreview) {
      setFormError(
        "Preencha os campos do Cálculo CLA (C, L, A, gramatura e quantidade).",
      );
      return;
    }

    const departmentErrors = validateExpenseDepartments(
      form.expenseDepartments,
    );
    const applicableCostsErrors = validateApplicableCosts(form.applicableCosts);

    if (Object.keys(departmentErrors).length > 0) {
      setExpenseDepartmentsFieldErrors(departmentErrors);
      setFormError("Revise os campos obrigatorios em departamentos de gasto.");
      return;
    }

    if (Object.keys(applicableCostsErrors).length > 0) {
      setApplicableCostsFieldErrors(applicableCostsErrors);
      setFormError("Revise os campos obrigatorios em custos aplicaveis.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    setStatusFieldError("");
    setExpenseDepartmentsFieldErrors({});
    setApplicableCostsFieldErrors({});

    try {
      const created = await createBudget({
        clientName: client.name,
        category: form.category,
        description: form.description.trim(),
        deliveryDate: null,
        estimatedDeliveryBusinessDays: parsedEstimatedDeliveryBusinessDays,
        totalPrice: finalPriceWithExpenses,
        finalPrice: finalPriceWithExpenses,
        profitMargin: normalizedProfitMargin,
        costsApplicableValue,
        notes: form.notes.trim() ? form.notes.trim() : null,
        paymentTerms: form.paymentTerms.trim()
          ? form.paymentTerms.trim()
          : DEFAULT_BUDGET_PDF_PAYMENT_TERMS,
        status: form.status,
        materials: createUseCla
          ? []
          : form.items.map((item) => {
              const payloadItem = {
                productName: item.productName,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: item.unitPrice,
              };

              if (item.productId) {
                return {
                  ...payloadItem,
                  productId: item.productId,
                };
              }

              return payloadItem;
            }),
        expenseDepartments: form.expenseDepartments.map((department) => ({
          expenseDepartmentId: department.expenseDepartmentId,
          name: department.name.trim(),
          sector: department.sector.trim(),
          amount: Math.max(0, Number(department.amount) || 0),
        })),
        applicableCosts: form.applicableCosts.map((cost) => ({
          applicableCostId: cost.applicableCostId,
          name: cost.name.trim(),
          amount: Math.max(0, Number(cost.amount) || 0),
        })),
      });

      // Se criou via CLA, salva a configuração de papelão imediatamente
      if (createUseCla && createClaPreview) {
        try {
          await upsertPaperboardConfig(created.id, createClaForm);
        } catch {
          // não bloqueia o fluxo, pode ser editado depois
        }
      }

      setData((current) => [
        mapBudgetFromApi(created, clientsCatalog),
        ...current,
      ]);
      await Promise.all([loadBudgetsFromApi(), loadProductsForForm()]);
      closeCreateModal();
    } catch (error) {
      const apiFieldErrors = extractExpenseDepartmentsFieldErrors(error);
      const apiApplicableCostsErrors = extractApplicableCostsFieldErrors(error);
      const apiStatusError = extractStatusFieldError(error);

      if (Object.keys(apiFieldErrors).length > 0) {
        setExpenseDepartmentsFieldErrors(apiFieldErrors);
      }

      if (Object.keys(apiApplicableCostsErrors).length > 0) {
        setApplicableCostsFieldErrors(apiApplicableCostsErrors);
      }

      if (apiStatusError) {
        setStatusFieldError(apiStatusError);
      }

      setFormError(
        normalizeBudgetError(error, "Não foi possível criar o orçamento."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openBudgetDetail = async (budgetId: string) => {
    setDetailModalOpen(true);
    setDetailError("");
    setDetailStatusFieldError("");
    setIsLoadingDetail(true);

    try {
      const budget = mapBudgetFromApi(
        await getBudgetById(budgetId),
        clientsCatalog,
      );
      setSelectedBudget(budget);
      setDetailForm({
        clientName: budget.clientName,
        category: budget.category,
        description: budget.description,
        estimatedDeliveryBusinessDays:
          budget.estimatedDeliveryBusinessDays !== null
            ? String(budget.estimatedDeliveryBusinessDays)
            : "",
        notes: budget.notes || "",
        paymentTerms: budget.paymentTerms || DEFAULT_BUDGET_PDF_PAYMENT_TERMS,
        status: budget.status,
        totalPrice: budget.finalPrice,
        profitMargin: normalizeMarginPercentage(budget.profitMargin),
        costsApplicableValue: Math.max(
          0,
          Number(budget.costsApplicableValue) || 0,
        ),
        items: budget.items,
        expenseDepartments: budget.expenseDepartments,
        applicableCosts: budget.applicableCosts,
      });
      void loadProductsForForm();
      void loadExpenseDepartmentsCatalog();
    } catch (error) {
      setSelectedBudget(null);
      if (error instanceof ApiError && error.status === 404) {
        setDetailError(
          "Este orçamento não está mais disponível. Ele pode ter sido removido após expiração/rejeição.",
        );
      } else {
        setDetailError(
          normalizeBudgetError(
            error,
            "Não foi possível carregar os detalhes do orçamento.",
          ),
        );
      }
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedBudget(null);
    setDetailError("");
    setDetailStatusFieldError("");
    setDetailForm(createInitialDetailForm());
    setDetailNewItem(createEmptyMaterialInput());
    setDetailExpenseDepartmentsSearch("");
    setDetailExpenseDepartmentsFieldErrors({});
    setDetailApplicableCostsFieldErrors({});
    setPendingStatusChange((current) =>
      current?.scope === "detail" ? null : current,
    );
    setPaperboardConfig(null);
    setIsPaperboardSectionOpen(false);
    setPaperboardError("");
  };

  const loadPaperboardConfig = async (budgetId: string) => {
    setIsLoadingPaperboard(true);
    setPaperboardError("");
    try {
      const config = await getPaperboardConfig(budgetId);
      setPaperboardConfig(config);
      if (config) {
        setPaperboardForm({
          length: config.length,
          width: config.width,
          height: config.height,
          gramatura: config.gramatura,
          quantity: config.quantity,
          sheetsPerBundle: config.sheetsPerBundle ?? undefined,
          sheetUnitCost: config.sheetUnitCost ?? undefined,
          cuttingCostPerKg: config.cuttingCostPerKg ?? undefined,
          creasingCostPerKg: config.creasingCostPerKg ?? undefined,
          lossPercentage: config.lossPercentage,
          markupPercentage: config.markupPercentage,
          usesFullSheet: config.usesFullSheet,
          outsourcedCut: config.outsourcedCut,
          isFirstPurchase: config.isFirstPurchase,
          clicheCost: config.clicheCost ?? undefined,
          clichePrice: config.clichePrice ?? undefined,
        });
      } else {
        setPaperboardForm({
          length: 0,
          width: 0,
          height: 0,
          gramatura: 0,
          quantity: 0,
          sheetsPerBundle: undefined,
          sheetUnitCost: undefined,
          cuttingCostPerKg: undefined,
          creasingCostPerKg: undefined,
          lossPercentage: 0,
          markupPercentage: 35,
          usesFullSheet: false,
          outsourcedCut: false,
          isFirstPurchase: false,
        });
      }
    } catch (error) {
      setPaperboardError(
        normalizeBudgetError(
          error,
          "Não foi possível carregar a configuração de papelão.",
        ),
      );
    } finally {
      setIsLoadingPaperboard(false);
    }
  };

  const savePaperboardConfig = async () => {
    if (!selectedBudget) return;
    if (
      !paperboardForm.length ||
      !paperboardForm.width ||
      !paperboardForm.height ||
      !paperboardForm.gramatura ||
      !paperboardForm.quantity
    ) {
      setPaperboardError(
        "Preencha todos os campos obrigatórios (dimensões, gramatura e quantidade).",
      );
      return;
    }
    setIsSavingPaperboard(true);
    setPaperboardError("");
    try {
      const saved = await upsertPaperboardConfig(
        selectedBudget.id,
        paperboardForm,
      );
      setPaperboardConfig(saved);
      const refreshedBudget = mapBudgetFromApi(
        await getBudgetById(selectedBudget.id),
        clientsCatalog,
      );
      setSelectedBudget(refreshedBudget);
      setData((current) =>
        current.map((item) =>
          item.id === refreshedBudget.id ? refreshedBudget : item,
        ),
      );
      setPaperboardError("");
    } catch (error) {
      setPaperboardError(
        normalizeBudgetError(
          error,
          "Não foi possível salvar a configuração de papelão.",
        ),
      );
    } finally {
      setIsSavingPaperboard(false);
    }
  };

  const handleDeletePaperboardConfig = async () => {
    if (!selectedBudget || !paperboardConfig) return;
    setIsSavingPaperboard(true);
    setPaperboardError("");
    try {
      await deletePaperboardConfig(selectedBudget.id);
      setPaperboardConfig(null);
      const refreshedBudget = mapBudgetFromApi(
        await getBudgetById(selectedBudget.id),
        clientsCatalog,
      );
      setSelectedBudget(refreshedBudget);
      setData((current) =>
        current.map((item) =>
          item.id === refreshedBudget.id ? refreshedBudget : item,
        ),
      );
      setPaperboardForm({
        length: 0,
        width: 0,
        height: 0,
        gramatura: 0,
        quantity: 0,
        sheetsPerBundle: undefined,
        sheetUnitCost: undefined,
        cuttingCostPerKg: undefined,
        creasingCostPerKg: undefined,
        lossPercentage: 0,
        markupPercentage: 35,
        usesFullSheet: false,
        outsourcedCut: false,
        isFirstPurchase: false,
      });
    } catch (error) {
      setPaperboardError(
        normalizeBudgetError(
          error,
          "Não foi possível remover a configuração de papelão.",
        ),
      );
    } finally {
      setIsSavingPaperboard(false);
    }
  };

  const togglePaperboardSection = () => {
    const next = !isPaperboardSectionOpen;
    setIsPaperboardSectionOpen(next);
    if (next && selectedBudget && !paperboardConfig && !isLoadingPaperboard) {
      void loadPaperboardConfig(selectedBudget.id);
    }
  };

  const saveBudgetDetail = async () => {
    if (!selectedBudget) {
      return;
    }

    if (!detailForm.clientName.trim() || !detailForm.description.trim()) {
      setDetailError("Cliente e descricao sao obrigatorios.");
      return;
    }

    if (!detailForm.category) {
      setDetailError("Selecione a categoria do orcamento.");
      return;
    }

    if (!detailForm.status) {
      setDetailStatusFieldError("Selecione um status para o orçamento.");
      setDetailError("Selecione um status valido.");
      return;
    }

    const parsedDetailEstimatedDeliveryBusinessDays = parseBusinessDaysInput(
      detailForm.estimatedDeliveryBusinessDays,
    );

    if (parsedDetailEstimatedDeliveryBusinessDays === null) {
      setDetailError("Campo estimatedDeliveryBusinessDays é obrigatório.");
      return;
    }

    if (Number.isNaN(parsedDetailEstimatedDeliveryBusinessDays)) {
      setDetailError(
        "estimatedDeliveryBusinessDays deve ser um número inteiro maior que zero.",
      );
      return;
    }

    const normalizedDetailCostsApplicableValue = Number(
      detailForm.costsApplicableValue ?? 0,
    );
    if (
      !Number.isFinite(normalizedDetailCostsApplicableValue) ||
      normalizedDetailCostsApplicableValue < 0
    ) {
      setDetailError(
        "Informe um custo aplicavel valido (maior ou igual a zero).",
      );
      return;
    }

    const normalizedDetailProfitMargin = Number(detailForm.profitMargin);

    if (
      !Number.isFinite(normalizedDetailProfitMargin) ||
      normalizedDetailProfitMargin < 0 ||
      normalizedDetailProfitMargin > 100
    ) {
      setDetailError("A margem de lucro deve estar entre 0 e 100.");
      return;
    }

    const departmentErrors = validateExpenseDepartments(
      detailForm.expenseDepartments,
    );
    const applicableCostsErrors = validateApplicableCosts(
      detailForm.applicableCosts,
    );

    if (Object.keys(departmentErrors).length > 0) {
      setDetailExpenseDepartmentsFieldErrors(departmentErrors);
      setDetailError(
        "Revise os campos obrigatorios em departamentos de gasto.",
      );
      return;
    }

    if (Object.keys(applicableCostsErrors).length > 0) {
      setDetailApplicableCostsFieldErrors(applicableCostsErrors);
      setDetailError("Revise os campos obrigatorios em custos aplicaveis.");
      return;
    }

    setIsUpdatingDetail(true);
    setDetailError("");
    setDetailStatusFieldError("");
    setDetailExpenseDepartmentsFieldErrors({});
    setDetailApplicableCostsFieldErrors({});

    const totalPriceToPersist = detailFinalPriceWithExpenses;

    try {
      const updated = mapBudgetFromApi(
        await updateBudget(selectedBudget.id, {
          clientName: detailForm.clientName.trim(),
          category: detailForm.category,
          description: detailForm.description.trim(),
          deliveryDate: null,
          estimatedDeliveryBusinessDays:
            parsedDetailEstimatedDeliveryBusinessDays,
          notes: detailForm.notes.trim() ? detailForm.notes.trim() : null,
          paymentTerms: detailForm.paymentTerms.trim()
            ? detailForm.paymentTerms.trim()
            : DEFAULT_BUDGET_PDF_PAYMENT_TERMS,
          status: detailForm.status,
          totalPrice: totalPriceToPersist,
          finalPrice: totalPriceToPersist,
          profitMargin: normalizedDetailProfitMargin,
          costsApplicableValue: Math.max(
            0,
            Number(detailForm.costsApplicableValue) || 0,
          ),
          materials: selectedBudget.items.map((item) => {
            const payloadItem = {
              productName: item.productName,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
            };

            if (item.productId) {
              return {
                ...payloadItem,
                productId: item.productId,
              };
            }

            return payloadItem;
          }),
          expenseDepartments: detailForm.expenseDepartments.map(
            (department) => ({
              expenseDepartmentId: department.expenseDepartmentId,
              name: department.name.trim(),
              sector: department.sector.trim(),
              amount: Math.max(0, Number(department.amount) || 0),
            }),
          ),
          applicableCosts: detailForm.applicableCosts.map((cost) => ({
            applicableCostId: cost.applicableCostId,
            name: cost.name.trim(),
            amount: Math.max(0, Number(cost.amount) || 0),
          })),
        }),
        clientsCatalog,
      );

      setData((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      await Promise.all([loadBudgetsFromApi(), loadProductsForForm()]);
      closeDetailModal();
    } catch (error) {
      const apiFieldErrors = extractExpenseDepartmentsFieldErrors(error);
      const apiApplicableCostsErrors = extractApplicableCostsFieldErrors(error);
      const apiStatusError = extractStatusFieldError(error);

      if (Object.keys(apiFieldErrors).length > 0) {
        setDetailExpenseDepartmentsFieldErrors(apiFieldErrors);
      }

      if (Object.keys(apiApplicableCostsErrors).length > 0) {
        setDetailApplicableCostsFieldErrors(apiApplicableCostsErrors);
      }

      if (apiStatusError) {
        setDetailStatusFieldError(apiStatusError);
      }

      setDetailError(
        normalizeBudgetError(error, "Não foi possível atualizar o orçamento."),
      );
    } finally {
      setIsUpdatingDetail(false);
    }
  };

  const confirmApproveBudget = async () => {
    if (!selectedToApprove || approvingId) {
      return;
    }

    const budgetId = selectedToApprove.id;

    setApprovingId(budgetId);
    setRequestError("");
    clearApprovalFeedback();

    try {
      const approved = mapBudgetFromApi(
        await approveBudget(budgetId),
        clientsCatalog,
      );
      setData((current) =>
        current.map((item) => (item.id === approved.id ? approved : item)),
      );
      closeApproveModal(true);

      dispatchInventoryDataChanged({
        source: "budget-approve",
        referenceId: budgetId,
      });

      await loadBudgetsFromApi();
    } catch (error) {
      if (error instanceof ApproveBudgetError) {
        setApprovalError(error.message);
        setApprovalDetails(error.details);
        return;
      }

      setApprovalError(
        normalizeBudgetError(error, "Não foi possível aprovar o orçamento."),
      );
    } finally {
      setApprovingId(null);
    }
  };

  const addClause = () => {
    setContractForm((current) => {
      const nextNumber = current.clauses.length + 1;

      return {
        ...current,
        clauses: [
          ...current.clauses,
          {
            id: createClauseId(),
            title: `CLÁUSULA ${nextNumber} — NOVA CLÁUSULA`,
            content: "",
          },
        ],
      };
    });
  };

  const updateClause = (clauseId: string, patch: Partial<ContractClause>) => {
    setContractForm((current) => ({
      ...current,
      clauses: current.clauses.map((clause) =>
        clause.id === clauseId ? { ...clause, ...patch } : clause,
      ),
    }));
  };

  const removeClause = (clauseId: string) => {
    setContractForm((current) => {
      if (current.clauses.length <= 1) {
        return current;
      }

      return {
        ...current,
        clauses: current.clauses.filter((clause) => clause.id !== clauseId),
      };
    });
  };

  const closeContractModal = () => {
    setContractModalOpen(false);
    setSelectedBudgetForContract(null);
    setContractFormError("");
  };

  const openContractModal = (budget: BudgetRow) => {
    const linkedClient =
      clientsCatalog.find((client) => client.id === budget.clientId) ||
      findClientByName(clientsCatalog, budget.clientName);
    const itemsBaseTotal = budget.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const marginPercentage = normalizeMarginPercentage(budget.profitMargin);
    const fallbackFinalPrice =
      itemsBaseTotal > 0
        ? itemsBaseTotal * (1 + marginPercentage / 100)
        : Number(budget.finalPrice) || 0;
    const contractValue = Math.max(
      0,
      Number(budget.finalPrice) > 0
        ? Number(budget.finalPrice)
        : fallbackFinalPrice,
    );

    setSelectedBudgetForContract(budget);
    setContractFormError("");
    setContractForm({
      contratanteName: linkedClient?.name || budget.clientName || "",
      operationName: budget.clientName || linkedClient?.name || "",
      projectAddress: buildClientAddress(linkedClient),
      kioskWidthMeters: 3,
      kioskDepthMeters: 4,
      contractValue: Number(contractValue.toFixed(2)),
      signatureCity: "São Paulo",
      signatureDate: getTodayInputDate(),
      clauses: createDefaultContractClauses(),
    });
    setContractModalOpen(true);
  };

  const generateBudgetPdf = async (budget: BudgetRow) => {
    setGeneratingPdfId(budget.id);

    // ── Constantes da empresa (molde 4D EMBALAGENS) ──────────────────────────
    const COMPANY_NAME = "4D EMBALAGENS LTDA";
    const COMPANY_ADDRESS = "Rua Benedito Passos, 160 - Vila Matilde - SP";
    const COMPANY_CNPJ = "CNPJ: 62.728.414/0001-99";
    const COMPANY_TEL = "Tel: (11) 2651-4292 | Cel: (11) 95266-1751";
    const COMPANY_CONTACT = "Daniel Visnardi";
    const COMPANY_DEPT = "Dpto Comercial";
    const COMPANY_CELL = "(11) 95266-1751";
    const COMPANY_EMAIL = "daniel@4dembalagens.com.br";

    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const PW = pdf.internal.pageSize.getWidth(); // 210
      const PH = pdf.internal.pageSize.getHeight(); // 297
      const MX = 14; // margem horizontal
      const CW = PW - MX * 2; // largura útil ≈ 182
      const bottomLimit = PH - 14;
      let y = 12;

      // ── 1. CABEÇALHO: logo + dados empresa ─────────────────────────────────
      const logoDataUrl = await loadLogoDataUrl();
      const LOGO_W = 28;
      const LOGO_H = 28;
      if (logoDataUrl) {
        pdf.addImage(logoDataUrl, "PNG", MX, y, LOGO_W, LOGO_H);
      }

      // Dados empresa alinhados à direita
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

      // ── 2. TÍTULO ────────────────────────────────────────────────────────────
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text("Orcamento", PW / 2, y, { align: "center" });
      y += 10;

      // ── 3. CAIXA CLIENTE / PROPOSTA ──────────────────────────────────────────
      const BOX_H = 26;
      const HALF = CW / 2;
      pdf.setFillColor(242, 242, 242);
      pdf.rect(MX, y, CW, BOX_H, "FD");
      pdf.setDrawColor(221, 221, 221);
      pdf.setLineWidth(0.5);
      pdf.line(MX + HALF, y, MX + HALF, y + BOX_H);

      const fieldLine = (
        label: string,
        value: string,
        fx: number,
        fy: number,
        fw: number,
      ) => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(0, 0, 0);
        const labelW = pdf.getTextWidth(`${label}: `);
        pdf.text(`${label}: `, fx, fy);
        pdf.setFont("helvetica", "normal");
        const maxW = fw - labelW;
        const val = pdf.splitTextToSize(value || "", maxW) as string[];
        pdf.text(val[0] ?? "", fx + labelW, fy);
      };

      const lX = MX + 3;
      const rX = MX + HALF + 3;
      const colW = HALF - 6;
      let bY = y + 6;
      fieldLine("Cliente", budget.clientName, lX, bY, colW);
      bY += 5;
      fieldLine("Responsavel", "", lX, bY, colW);
      bY += 5;
      fieldLine("E-mail", "", lX, bY, colW);
      bY += 5;
      fieldLine("Telefone", "", lX, bY, colW);

      let rY = y + 6;
      fieldLine(
        "No da Proposta",
        budget.id.slice(0, 8).toUpperCase(),
        rX,
        rY,
        colW,
      );
      rY += 5;
      fieldLine(
        "Data da Entrega",
        budget.deliveryDate
          ? new Date(budget.deliveryDate).toLocaleDateString("pt-BR")
          : "",
        rX,
        rY,
        colW,
      );
      rY += 5;
      if (budget.paymentTerms?.trim()) {
        fieldLine("Pagamento", budget.paymentTerms.trim(), rX, rY, colW);
        rY += 5;
      }
      if (budget.estimatedDeliveryBusinessDays) {
        fieldLine(
          "Prazo (d.u.)",
          `${budget.estimatedDeliveryBusinessDays} dia(s)`,
          rX,
          rY,
          colW,
        );
      }

      y += BOX_H + 8;

      // ── 4. TABELA DE PRODUTOS ────────────────────────────────────────────────
      const ensureSpace = (need: number) => {
        if (y + need > bottomLimit) {
          pdf.addPage();
          y = 14;
        }
      };

      const descW = CW - 60;
      const qtyX = MX + descW;
      const unitX = qtyX + 20;
      const totX = unitX + 20;
      const numW = 20;
      let tableTotal = 0;

      // Cabeçalho da tabela
      ensureSpace(10);
      pdf.setFillColor(242, 242, 242);
      pdf.rect(MX, y, CW, 8, "FD");
      pdf.setDrawColor(221, 221, 221);
      pdf.rect(MX, y, CW, 8, "S");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(26, 26, 26);
      pdf.text("Descricao dos Produtos", MX + 3, y + 5.5);
      pdf.text("Qtd.", qtyX, y + 5.5, { align: "center" });
      pdf.text("R$ Unid.", unitX + numW, y + 5.5, { align: "right" });
      pdf.text("R$ TOTAL", totX + numW, y + 5.5, { align: "right" });
      y += 8;

      if (budget.items.length > 0) {
        // Linhas dos produtos do estoque
        budget.items.forEach((item, idx) => {
          ensureSpace(8);
          if (idx % 2 === 0) {
            pdf.setFillColor(255, 255, 255);
          } else {
            pdf.setFillColor(242, 242, 242);
          }
          pdf.rect(MX, y, CW, 8, "FD");
          pdf.setDrawColor(221, 221, 221);
          pdf.rect(MX, y, CW, 8, "S");

          const total = item.quantity * item.unitPrice;
          tableTotal += total;
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7.8);
          pdf.setTextColor(0, 0, 0);
          const descText = pdf.splitTextToSize(
            item.productName,
            descW - 6,
          ) as string[];
          pdf.text(descText[0] ?? "", MX + 3, y + 5.5);
          pdf.text(String(item.quantity), qtyX, y + 5.5, { align: "center" });
          pdf.text(
            item.unitPrice.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            }),
            unitX + numW,
            y + 5.5,
            { align: "right" },
          );
          pdf.text(
            total.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
            totX + numW,
            y + 5.5,
            { align: "right" },
          );
          y += 8;
        });
      } else {
        // Orçamento via CLA: busca a config e exibe uma linha descritiva
        let claConfig: PaperboardConfig | null = null;
        try {
          claConfig = await getPaperboardConfig(budget.id);
        } catch {
          // ignora se não encontrar
        }

        if (claConfig) {
          const claDesc = `Caixa de papelao ${claConfig.length}x${claConfig.width}x${claConfig.height}mm | ${claConfig.gramatura}g/m²`;
          const unitPriceCla = claConfig.suggestedPrice;
          const totalCla = unitPriceCla * claConfig.quantity;
          tableTotal = totalCla;

          ensureSpace(8);
          pdf.setFillColor(255, 255, 255);
          pdf.rect(MX, y, CW, 8, "FD");
          pdf.setDrawColor(221, 221, 221);
          pdf.rect(MX, y, CW, 8, "S");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7.8);
          pdf.setTextColor(0, 0, 0);
          const claDescLines = pdf.splitTextToSize(
            claDesc,
            descW - 6,
          ) as string[];
          pdf.text(claDescLines[0] ?? "", MX + 3, y + 5.5);
          pdf.text(String(claConfig.quantity), qtyX, y + 5.5, {
            align: "center",
          });
          pdf.text(
            unitPriceCla.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
            unitX + numW,
            y + 5.5,
            { align: "right" },
          );
          pdf.text(
            totalCla.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
            totX + numW,
            y + 5.5,
            { align: "right" },
          );
          y += 8;
        } else {
          // Sem itens e sem config CLA: linha vazia
          ensureSpace(8);
          pdf.setFillColor(255, 255, 255);
          pdf.rect(MX, y, CW, 8, "FD");
          pdf.setDrawColor(221, 221, 221);
          pdf.rect(MX, y, CW, 8, "S");
          pdf.setFont("helvetica", "italic");
          pdf.setFontSize(7.5);
          pdf.setTextColor(120, 120, 120);
          pdf.text("Ver detalhes do orcamento", MX + 3, y + 5.5);
          pdf.text(
            budget.finalPrice.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            }),
            totX + numW,
            y + 5.5,
            { align: "right" },
          );
          tableTotal = budget.finalPrice;
          y += 8;
        }
      }

      const marginPercentage = normalizeMarginPercentage(budget.profitMargin);
      const marginAppliedTotal = Math.max(
        0,
        tableTotal > 0
          ? tableTotal * (1 + marginPercentage / 100)
          : Number(budget.finalPrice) || 0,
      );

      // Célula "Total R$"
      ensureSpace(8);
      const totalBoxX = totX - 14;
      const totalBoxW = numW + 14;
      pdf.setFillColor(242, 242, 242);
      pdf.rect(totalBoxX, y, totalBoxW, 8, "FD");
      pdf.setDrawColor(221, 221, 221);
      pdf.rect(totalBoxX, y, totalBoxW, 8, "S");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(26, 26, 26);
      pdf.text("Total R$", totalBoxX + 2, y + 5.5);
      pdf.text(
        marginAppliedTotal.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        }),
        totalBoxX + totalBoxW - 2,
        y + 5.5,
        { align: "right" },
      );
      y += 8;

      // ── 5. TOTAIS + DADOS ADICIONAIS ─────────────────────────────────────────
      y += 8;
      ensureSpace(30);
      const totalsX = MX;
      const totalsW = CW / 2 - 5;
      const dadosX = MX + CW / 2 + 5;
      const dadosW = CW / 2 - 5;
      const totalsStartY = y;

      // "Totais" sublinhado
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.text("Totais", totalsX, y);
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.6);
      pdf.line(totalsX, y + 1.5, totalsX + 22, y + 1.5);
      y += 7;

      const totalRow = (label: string, value: string) => {
        ensureSpace(6);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        const lw = pdf.getTextWidth(`${label} `);
        pdf.text(`${label} `, totalsX, y);
        pdf.setFont("helvetica", "normal");
        pdf.text(value, totalsX + lw, y);
        y += 6;
      };

      totalRow("Valor do Frete:", "");
      totalRow(
        "Valor Total:",
        marginAppliedTotal.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        }),
      );

      // "Dados Adicionais" sublinhado
      let dY = totalsStartY;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.text("Dados Adicionais", dadosX, dY);
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.6);
      pdf.line(dadosX, dY + 1.5, dadosX + 55, dY + 1.5);
      dY += 7;

      if (budget.notes?.trim()) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(85, 85, 85);
        const notesLines = pdf.splitTextToSize(
          budget.notes.trim(),
          dadosW,
        ) as string[];
        pdf.text(notesLines, dadosX, dY);
      }

      // ── 6. ASSINATURA ────────────────────────────────────────────────────────
      y = Math.max(y, dY) + 14;
      ensureSpace(24);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.text("Att", MX, y);
      y += 4.5;
      pdf.setFont("helvetica", "bold");
      pdf.text(COMPANY_CONTACT, MX, y);
      y += 4.5;
      pdf.setFont("helvetica", "normal");
      pdf.text(COMPANY_DEPT, MX, y);
      y += 4.5;
      pdf.text(COMPANY_CELL, MX, y);
      y += 4.5;
      pdf.text(COMPANY_EMAIL, MX, y);

      const safeClientName = sanitizeFileName(budget.clientName) || "cliente";
      pdf.save(`orcamento-${budget.id}-${safeClientName}.pdf`);
    } catch {
      window.alert(
        "Não foi possível gerar o PDF deste orçamento. Tente novamente.",
      );
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const generateContractPdf = async () => {
    if (!selectedBudgetForContract) {
      return;
    }

    if (!contractForm.contratanteName.trim()) {
      setContractFormError("Informe o nome da contratante.");
      return;
    }

    if (!contractForm.operationName.trim()) {
      setContractFormError("Informe o nome da operação/cliente final.");
      return;
    }

    if (contractForm.contractValue <= 0) {
      setContractFormError("Informe um valor válido para o contrato.");
      return;
    }

    if (
      contractForm.kioskWidthMeters <= 0 ||
      contractForm.kioskDepthMeters <= 0
    ) {
      setContractFormError(
        "Informe dimensões válidas para o projeto de papelão.",
      );
      return;
    }

    if (!contractForm.signatureDate) {
      setContractFormError("Informe a data de assinatura.");
      return;
    }

    if (contractForm.clauses.length === 0) {
      setContractFormError(
        "Adicione ao menos uma cláusula para gerar o contrato.",
      );
      return;
    }

    const invalidClause = contractForm.clauses.find(
      (clause) => !clause.title.trim() || !clause.content.trim(),
    );

    if (invalidClause) {
      setContractFormError("Todas as cláusulas devem ter nome e conteúdo.");
      return;
    }

    setIsGeneratingContract(true);
    setContractFormError("");

    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = 162;
      const marginX = (pageWidth - contentWidth) / 2;
      const bottomLimit = pageHeight - 18;
      const lineHeight = 4.3;

      let y = 14;

      const ensureSpace = (requiredHeight: number) => {
        if (y + requiredHeight <= bottomLimit) {
          return;
        }

        pdf.addPage();
        y = 16;
      };

      const writeLine = (
        text: string,
        opts: { bold?: boolean; size?: number; indent?: number } = {},
      ) => {
        const { bold = false, size = 10, indent = 0 } = opts;
        const x = marginX + indent;
        const wrapped = pdf.splitTextToSize(
          text,
          contentWidth - indent,
        ) as string[];
        ensureSpace(wrapped.length * lineHeight + 1);
        pdf.setFont("helvetica", bold ? "bold" : "normal");
        pdf.setFontSize(size);
        pdf.text(wrapped, x, y);
        y += wrapped.length * lineHeight;
      };

      const addGap = (value = 2) => {
        y += value;
      };

      const separator = () => {
        ensureSpace(4);
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.8);
        pdf.line(marginX, y, marginX + contentWidth, y);
        y += 5;
      };

      const logoDataUrl = await loadLogoDataUrl();
      const logoMaxW = 34;
      const logoMaxH = 24;
      let logoW = logoMaxW;
      let logoH = logoMaxH;

      if (logoDataUrl) {
        try {
          const logoProps = pdf.getImageProperties(logoDataUrl);
          const ratio = logoProps.width / logoProps.height;

          logoW = logoMaxW;
          logoH = logoW / ratio;

          if (logoH > logoMaxH) {
            logoH = logoMaxH;
            logoW = logoH * ratio;
          }
        } catch {
          logoW = logoMaxW;
          logoH = logoMaxH;
        }

        pdf.addImage(logoDataUrl, "PNG", marginX, y, logoW, logoH);
      }

      const titleX = marginX + logoW + 8;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.8);
      pdf.text("CONTRATO DE PRESTACAO DE SERVICOS", titleX, y + 8);
      pdf.text("DE PRODUCAO DE EMBALAGENS DE PAPELAO", titleX, y + 14);

      y += logoH + 6;
      separator();

      writeLine(
        `CONTRATANTE: ${contractForm.contratanteName}, inscrita no CPF/CNPJ sob n.o ____________, residente na cidade de ____________, doravante denominada simplesmente CONTRATANTE.`,
        { bold: true },
      );
      addGap(2);
      separator();

      writeLine(
        "CONTRATADA: GIRA KIDS COMERCIO DE DOCES, BRINQUEDOS E JOGOS ELETRONICOS LTDA, pessoa juridica de direito privado, inscrita no CNPJ sob o n.o 07.313.928/0001-75, com sede na Avenida Cachoeira Paulista, 17 - Cidade Patriarca - Cep: 03551-000, doravante denominada simplesmente CONTRATADA.",
        { bold: true },
      );
      addGap(2);
      separator();

      writeLine("Considerando que:", { bold: true });
      addGap(1);
      writeLine(
        "a) A CONTRATANTE deseja contratar os servicos da CONTRATADA para desenvolvimento e producao de embalagens de papelao, conforme especificacoes deste instrumento.",
        { indent: 1 },
      );
      addGap(1);
      writeLine(
        "b) A CONTRATADA declara possuir expertise e capacidade tecnica para a execucao dos servicos ora contratados.",
        { indent: 1 },
      );
      addGap(2);

      writeLine(
        "As partes acima identificadas tem entre si justo e acordado o presente Contrato de Producao de Embalagens de Papelao, mediante as seguintes clausulas e condicoes:",
      );
      addGap(2);

      contractForm.clauses.forEach((clause, index) => {
        const clauseTitle = clause.title.trim() || `Clausula ${index + 1}`;
        writeLine(clauseTitle, { bold: true, size: 11 });
        addGap(1);

        const processedContent = replaceContractPlaceholders(
          clause.content,
          contractForm.contractValue,
        );
        const contentLines = processedContent.split(/\r?\n/);

        contentLines.forEach((rawLine) => {
          const line = rawLine.trim();

          if (!line) {
            addGap(1);
            return;
          }

          if (/^[-*•]/.test(line)) {
            writeLine(`• ${line.replace(/^[-*•]\s*/, "")}`, { indent: 3.5 });
            return;
          }

          writeLine(line, { indent: 1.2 });
        });

        addGap(2);
      });

      if (contractForm.projectAddress.trim()) {
        writeLine(`Endereco da obra: ${contractForm.projectAddress.trim()}`, {
          bold: true,
        });
        addGap(2);
      }

      writeLine(
        `${contractForm.signatureCity}, ${formatLongDate(contractForm.signatureDate)}.`,
        { size: 10.5 },
      );
      addGap(9);

      ensureSpace(24);
      const signatureLineWidth = 72;
      const leftSignatureX = marginX;
      const rightSignatureX = marginX + contentWidth - signatureLineWidth;

      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.35);
      pdf.line(leftSignatureX, y, leftSignatureX + signatureLineWidth, y);
      pdf.line(rightSignatureX, y, rightSignatureX + signatureLineWidth, y);

      y += 5;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.2);
      pdf.text(contractForm.contratanteName, leftSignatureX, y);
      pdf.text("CONTRATANTE", leftSignatureX, y + 4.2);

      pdf.text("GIRA KIDS COMERCIO DE DOCES", rightSignatureX, y);
      pdf.text("CONTRATADA", rightSignatureX, y + 4.2);

      const safeClientName =
        sanitizeFileName(
          contractForm.operationName || selectedBudgetForContract.clientName,
        ) || "cliente";
      pdf.save(
        `contrato-${selectedBudgetForContract.id}-${safeClientName}.pdf`,
      );
      closeContractModal();
    } catch {
      setContractFormError(
        "Não foi possível gerar o contrato em PDF. Tente novamente.",
      );
    } finally {
      setIsGeneratingContract(false);
    }
  };

  const detailClientOptions = clientsCatalog.map((client) => ({
    value: client.name,
    label: client.companyName
      ? `${client.name} • ${client.companyName}`
      : client.name,
  }));

  const resolveItemStockStatus = (item: BudgetItemRow) => {
    const matchingProduct = item.productId
      ? productsCatalog.find((product) => product.id === item.productId)
      : productsCatalog.find(
          (product) =>
            normalizeName(product.name) === normalizeName(item.productName),
        );

    const stockQuantity = matchingProduct?.stockQuantity ?? 0;
    return getStockBadge(stockQuantity);
  };

  const removeDetailItem = (idx: number) => {
    setSelectedBudget((current) => {
      if (!current) {
        return current;
      }

      const nextItems = current.items.filter(
        (_, itemIndex) => itemIndex !== idx,
      );
      setDetailForm((detailCurrent) => ({
        ...detailCurrent,
        items: nextItems,
      }));

      return {
        ...current,
        items: nextItems,
      };
    });
  };

  if (
    detailForm.clientName &&
    !detailClientOptions.some(
      (option) => option.value === detailForm.clientName,
    )
  ) {
    detailClientOptions.unshift({
      value: detailForm.clientName,
      label: `${detailForm.clientName} (não cadastrado)`,
    });
  }

  const columns = [
    { key: "createdAt", header: "Data", mono: true },
    { key: "clientName", header: "Cliente" },
    {
      key: "category",
      header: "Categoria",
      render: (b: BudgetRow) => (
        <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-secondary text-secondary-foreground">
          {formatCategory(b.category)}
        </span>
      ),
    },
    { key: "description", header: "Descrição" },
    {
      key: "costsAppliedValue",
      header: "Custos aplicados",
      render: (b: BudgetRow) => formatCurrency(b.costsAppliedValue),
    },
    {
      key: "finalPrice",
      header: "Preço Final",
      mono: true,
      render: (b: BudgetRow) => `R$ ${b.finalPrice.toFixed(2)}`,
    },
    {
      key: "estimatedDeliveryBusinessDays",
      header: "Prazo estimado",
      mono: true,
      render: (b: BudgetRow) =>
        formatBusinessDaysLabel(b.estimatedDeliveryBusinessDays),
    },
    {
      key: "status",
      header: "Status",
      render: (b: BudgetRow) => <StatusBadge status={b.status} />,
    },
    {
      key: "actions",
      header: "",
      render: (b: BudgetRow) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              void openBudgetDetail(b.id);
            }}
            className="px-2 py-1 text-[11px] font-bold rounded border border-border text-foreground hover:bg-secondary transition-colors"
          >
            DETALHE
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              void generateBudgetPdf(b);
            }}
            disabled={generatingPdfId === b.id}
            className="px-2 py-1 text-[11px] font-bold rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {generatingPdfId === b.id ? "GERANDO..." : "PDF"}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              openContractModal(b);
            }}
            className="px-2 py-1 text-[11px] font-bold rounded border border-border text-foreground hover:bg-secondary transition-colors"
          >
            CONTRATO
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleDeleteBudget(b);
            }}
            className="px-2 py-1 text-[11px] font-bold rounded border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
          >
            EXCLUIR
          </button>

          {(b.status === "draft" || b.status === "pending") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openPreApproveModal(b);
              }}
              disabled={Boolean(preApprovingId) || Boolean(approvingId)}
              className="px-2 py-1 text-[11px] font-bold rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {preApprovingId === b.id ? "APLICANDO..." : "PRÉ-APROVAR"}
            </button>
          )}

          {b.status === "pre_approved" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openApproveModal(b);
              }}
              disabled={Boolean(approvingId)}
              className="px-2 py-1 text-[11px] font-bold rounded bg-success/20 text-success hover:bg-success/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {approvingId === b.id ? "APROVANDO..." : "APROVAR OFICIALMENTE"}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout
      title="Orçamentos"
      action={
        <button
          onClick={openCreateModal}
          className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> NOVO ORÇAMENTO
        </button>
      }
    >
      <div className="animate-fade-in space-y-4">
        <div className="w-full md:w-80">
          <FormField
            label="Filtrar por categoria"
            as="select"
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(event.target.value as "all" | BudgetCategory)
            }
            options={[
              { value: "all", label: "Todas as categorias" },
              {
                value: "arquitetonico",
                label: formatCategory("arquitetonico"),
              },
              { value: "executivo", label: formatCategory("executivo") },
            ]}
          />
        </div>

        {requestError && (
          <div className="border border-destructive/40 bg-destructive/10 rounded px-3 py-2 text-sm text-destructive flex items-center justify-between gap-3">
            <span>{requestError}</span>
            <button
              onClick={() =>
                void loadBudgetsFromApi(clientsCatalog, categoryFilter)
              }
              className="px-2 py-1 text-[11px] font-bold rounded border border-destructive/30 hover:bg-destructive/20"
            >
              TENTAR NOVAMENTE
            </button>
          </div>
        )}

        <DataTable
          columns={columns}
          data={data}
          onRowClick={(row) => {
            void openBudgetDetail(row.id);
          }}
          emptyMessage={
            isLoading
              ? "Carregando orçamentos..."
              : "Nenhum orçamento encontrado."
          }
        />
      </div>

      <Modal
        open={modal}
        onClose={closeCreateModal}
        title="Novo Orçamento"
        width="max-w-5xl"
      >
        <div className="flex max-h-[72dvh] flex-col">
          <div className="space-y-6 overflow-y-auto pr-1">
            {clientsError && (
              <div className="mb-3 border border-destructive/40 bg-destructive/10 rounded px-3 py-2 text-sm text-destructive flex items-center justify-between gap-3">
                <span>{clientsError}</span>
                <button
                  onClick={() => void loadClientsForForms()}
                  className="px-2 py-1 text-[11px] font-bold rounded border border-destructive/30 hover:bg-destructive/20"
                >
                  TENTAR NOVAMENTE
                </button>
              </div>
            )}

            <FormField
              label="Cliente"
              as="select"
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              options={clientsCatalog.map((client) => ({
                value: client.id,
                label: client.companyName
                  ? `${client.name} • ${client.companyName}`
                  : client.name,
              }))}
            />

            <FormField
              label="Categoria do orcamento"
              as="select"
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value as BudgetCategory })
              }
              options={[
                {
                  value: "arquitetonico",
                  label: formatCategory("arquitetonico"),
                },
                { value: "executivo", label: formatCategory("executivo") },
              ]}
            />

            <FormField
              label="Status"
              as="select"
              value={form.status}
              onChange={(e) =>
                requestStatusChange("create", e.target.value as BudgetStatus)
              }
              error={statusFieldError}
              options={[
                { value: "draft", label: "Rascunho" },
                {
                  value: "pre_approved",
                  label: "Pre-aprovado (aplica somente custos aplicaveis)",
                },
                {
                  value: "approved",
                  label: "Aprovado (oficial, aplica custos restantes)",
                },
                { value: "pending", label: "Pendente (administrativo)" },
                { value: "rejected", label: "Rejeitado (administrativo)" },
              ]}
            />

            {!isLoadingClients && clientsCatalog.length === 0 && (
              <p className="text-xs text-destructive">
                Nenhum cliente cadastrado no banco para selecionar.
              </p>
            )}

            <FormField
              label="Descrição"
              as="textarea"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder={PROPOSAL_DESCRIPTION_PLACEHOLDER}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Prazo estimado de entrega (dias úteis previstos)"
                type="number"
                min={1}
                step="1"
                value={form.estimatedDeliveryBusinessDays}
                onChange={(e) =>
                  setForm({
                    ...form,
                    estimatedDeliveryBusinessDays: e.target.value,
                  })
                }
              />
              <FormField
                label="Observações"
                as="textarea"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={PROPOSAL_NOTES_PLACEHOLDER}
              />
            </div>

            <FormField
              label="Condições comerciais para PDF"
              as="textarea"
              value={form.paymentTerms}
              onChange={(e) =>
                setForm({ ...form, paymentTerms: e.target.value })
              }
              placeholder={DEFAULT_BUDGET_PDF_PAYMENT_TERMS}
            />

            <div className="flex flex-wrap gap-2 -mt-2">
              {[
                "Ato",
                "Boleto 15 dias",
                "Boleto 30 dias",
                "Boleto 45 dias",
                "Ato + boleto 15/30/45 dias",
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      paymentTerms: current.paymentTerms.trim()
                        ? `${current.paymentTerms}\n${preset}`
                        : preset,
                    }))
                  }
                  className="px-2.5 py-1 text-[11px] font-bold rounded border border-border text-muted-foreground hover:bg-secondary"
                >
                  {preset}
                </button>
              ))}
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3">
                Itens / Produto
              </p>

              {/* Toggle: Estoque vs CLA */}
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCreateUseCla(false)}
                  className={`px-3 py-1 text-[11px] font-bold rounded border transition-colors ${
                    !createUseCla
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  Produtos do estoque
                </button>
                <button
                  type="button"
                  onClick={() => setCreateUseCla(true)}
                  className={`px-3 py-1 text-[11px] font-bold rounded border transition-colors ${
                    createUseCla
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  Cálculo CLA (Papelão)
                </button>
              </div>

              {/* ── MODO ESTOQUE ── */}
              {!createUseCla && (
                <>
                  {productsError && (
                    <div className="mb-3 border border-destructive/40 bg-destructive/10 rounded px-3 py-2 text-sm text-destructive flex items-center justify-between gap-3">
                      <span>{productsError}</span>
                      <button
                        onClick={() => void loadProductsForForm()}
                        className="px-2 py-1 text-[11px] font-bold rounded border border-destructive/30 hover:bg-destructive/20"
                      >
                        TENTAR NOVAMENTE
                      </button>
                    </div>
                  )}

                  {form.items.length > 0 && (
                    <div className="border border-border rounded mb-3 divide-y divide-border/50">
                      {form.items.map((item, i) => (
                        <div
                          key={i}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span>
                              {item.productName} × {item.quantity} {item.unit}
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${resolveItemStockStatus(item).className}`}
                            >
                              {resolveItemStockStatus(item).label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs">
                              R$ {item.subtotal.toFixed(2)}
                            </span>
                            <button
                              onClick={() => removeItem(i)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setNewItem((current) => ({
                          ...createEmptyMaterialInput("existing"),
                          mode: "existing",
                        }))
                      }
                      className={`px-3 py-1 text-[11px] font-bold rounded border transition-colors ${
                        newItem.mode === "existing"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      Selecionar produto existente
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewItem((current) => ({
                          ...createEmptyMaterialInput("new"),
                          mode: "new",
                        }))
                      }
                      className={`px-3 py-1 text-[11px] font-bold rounded border transition-colors ${
                        newItem.mode === "new"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      Cadastrar material novo
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="flex-1">
                      {newItem.mode === "existing" ? (
                        <FormField
                          label="Produto"
                          as="select"
                          value={newItem.productId}
                          onChange={(e) =>
                            setNewItem({
                              ...newItem,
                              productId: e.target.value,
                            })
                          }
                          options={productsCatalog.map((product) => ({
                            value: product.id,
                            label: `${product.name} (Saldo: ${product.stockQuantity})`,
                          }))}
                        />
                      ) : (
                        <FormField
                          label="Novo material"
                          value={newItem.productName}
                          onChange={(e) =>
                            setNewItem({
                              ...newItem,
                              productName: e.target.value,
                            })
                          }
                          placeholder="Ex.: MDF Branco 15mm"
                        />
                      )}
                    </div>
                    <div className="w-full md:w-24">
                      <FormField
                        label="Qtd."
                        type="number"
                        min={1}
                        value={newItem.quantity}
                        onChange={(e) =>
                          setNewItem({
                            ...newItem,
                            quantity: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="w-full md:w-28">
                      <FormField
                        label="Unid."
                        value={newItem.unit}
                        onChange={(e) =>
                          setNewItem({ ...newItem, unit: e.target.value })
                        }
                      />
                    </div>
                    <div className="w-full md:w-32">
                      <FormField
                        label="Vlr Unit."
                        type="number"
                        min={0}
                        step="0.01"
                        value={newItem.unitPrice}
                        onChange={(e) =>
                          setNewItem({
                            ...newItem,
                            unitPrice: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={addItem}
                        disabled={
                          newItem.mode === "existing" &&
                          (isLoadingProducts || productsCatalog.length === 0)
                        }
                        className="px-3 py-2 text-xs font-bold rounded border border-border hover:bg-secondary transition-colors text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {newItem.mode === "existing" && isLoadingProducts
                          ? "CARREGANDO..."
                          : "ADICIONAR"}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ── MODO CLA ── */}
              {createUseCla && (
                <div className="space-y-3 border border-border rounded p-3 bg-secondary/10">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    Dimensões da caixa (mm)
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      label="Comprimento (C)"
                      type="number"
                      min={0}
                      step="1"
                      value={createClaForm.length || ""}
                      onChange={(e) =>
                        setCreateClaForm((f) => ({
                          ...f,
                          length: Number(e.target.value),
                        }))
                      }
                    />
                    <FormField
                      label="Largura (L)"
                      type="number"
                      min={0}
                      step="1"
                      value={createClaForm.width || ""}
                      onChange={(e) =>
                        setCreateClaForm((f) => ({
                          ...f,
                          width: Number(e.target.value),
                        }))
                      }
                    />
                    <FormField
                      label="Altura (A)"
                      type="number"
                      min={0}
                      step="1"
                      value={createClaForm.height || ""}
                      onChange={(e) =>
                        setCreateClaForm((f) => ({
                          ...f,
                          height: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      label="Gramatura (g/m²)"
                      type="number"
                      min={0}
                      step="1"
                      value={createClaForm.gramatura || ""}
                      onChange={(e) =>
                        setCreateClaForm((f) => ({
                          ...f,
                          gramatura: Number(e.target.value),
                        }))
                      }
                    />
                    <FormField
                      label="Quantidade"
                      type="number"
                      min={1}
                      step="1"
                      value={createClaForm.quantity || ""}
                      onChange={(e) =>
                        setCreateClaForm((f) => ({
                          ...f,
                          quantity: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      label="Folhas por fardo"
                      type="number"
                      min={0}
                      step="1"
                      value={createClaForm.sheetsPerBundle ?? ""}
                      onChange={(e) =>
                        setCreateClaForm((f) => ({
                          ...f,
                          sheetsPerBundle: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        }))
                      }
                    />
                    <FormField
                      label="Custo por folha (R$)"
                      type="number"
                      min={0}
                      step="0.0001"
                      value={createClaForm.sheetUnitCost ?? ""}
                      onChange={(e) =>
                        setCreateClaForm((f) => ({
                          ...f,
                          sheetUnitCost: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      label="Perda (%)"
                      type="number"
                      min={0}
                      step="0.1"
                      value={createClaForm.lossPercentage ?? 0}
                      onChange={(e) =>
                        setCreateClaForm((f) => ({
                          ...f,
                          lossPercentage: Number(e.target.value),
                        }))
                      }
                    />
                    <FormField
                      label="Markup (%)"
                      type="number"
                      min={0}
                      step="0.1"
                      value={createClaForm.markupPercentage ?? 35}
                      onChange={(e) =>
                        setCreateClaForm((f) => ({
                          ...f,
                          markupPercentage: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createClaForm.isFirstPurchase ?? false}
                        onChange={(e) =>
                          setCreateClaForm((f) => ({
                            ...f,
                            isFirstPurchase: e.target.checked,
                          }))
                        }
                      />
                      Primeira compra (inclui clichê)
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createClaForm.usesFullSheet ?? false}
                        onChange={(e) =>
                          setCreateClaForm((f) => ({
                            ...f,
                            usesFullSheet: e.target.checked,
                          }))
                        }
                      />
                      Usa folha inteira
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createClaForm.outsourcedCut ?? false}
                        onChange={(e) =>
                          setCreateClaForm((f) => ({
                            ...f,
                            outsourcedCut: e.target.checked,
                          }))
                        }
                      />
                      Corte terceirizado
                    </label>
                  </div>
                  {createClaForm.isFirstPurchase && (
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        label="Custo clichê (R$)"
                        type="number"
                        min={0}
                        step="0.01"
                        value={createClaForm.clicheCost ?? ""}
                        onChange={(e) =>
                          setCreateClaForm((f) => ({
                            ...f,
                            clicheCost: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          }))
                        }
                      />
                      <FormField
                        label="Preço clichê (R$)"
                        type="number"
                        min={0}
                        step="0.01"
                        value={createClaForm.clichePrice ?? ""}
                        onChange={(e) =>
                          setCreateClaForm((f) => ({
                            ...f,
                            clichePrice: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          }))
                        }
                      />
                    </div>
                  )}

                  {/* Preview CLA */}
                  {createClaPreview ? (
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 border border-border rounded p-2 bg-background">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Custo unit.
                        </p>
                        <p className="font-bold text-sm">
                          {formatCurrency(createClaPreview.estimatedCost)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Preço unit.
                        </p>
                        <p className="font-bold text-sm text-green-600">
                          {formatCurrency(createClaPreview.suggestedPrice)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Total ({createClaForm.quantity} un.)
                        </p>
                        <p className="font-bold text-sm">
                          {formatCurrency(
                            createClaPreview.suggestedPrice *
                              (createClaForm.quantity || 1),
                          )}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Folhas
                        </p>
                        <p className="font-bold text-sm">
                          {createClaPreview.totalSheets}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Preencha C, L, A, gramatura e quantidade para ver o
                      preview.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Margem de lucro (%)"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.profitMargin}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    profitMargin: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
              <FormField
                label="Preço final (R$)"
                type="number"
                value={Number(finalPriceWithExpenses.toFixed(2))}
                disabled
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                label="Custo aplicavel (R$)"
                type="number"
                min={0}
                step="0.01"
                value={form.costsApplicableValue ?? 0}
                onChange={(e) =>
                  setForm({
                    ...form,
                    costsApplicableValue: Math.max(
                      0,
                      Number(e.target.value) || 0,
                    ),
                  })
                }
                disabled={!isAdmin}
              />
            </div>

            {!isAdmin && (
              <p className="text-xs text-muted-foreground -mt-2">
                Campo de custo aplicável é editável apenas por admin.
              </p>
            )}

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </div>

          <div className="sticky bottom-0 z-10 mt-4 pt-3 border-t border-border bg-card/95 backdrop-blur flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <button
              onClick={closeCreateModal}
              className="w-full sm:w-auto px-4 py-2 text-sm rounded border border-border hover:bg-secondary transition-colors text-muted-foreground"
            >
              Cancelar
            </button>
            <button
              onClick={() => void saveBudget()}
              disabled={
                isSaving ||
                isLoadingProducts ||
                isLoadingClients ||
                clientsCatalog.length === 0
              }
              className="w-full sm:w-auto px-4 py-2 text-sm rounded bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? "Salvando..." : "Criar Orçamento"}
            </button>
          </div>
        </div>
      </Modal>

      {pendingStatusChange && (
        <Modal
          open={Boolean(pendingStatusChange)}
          onClose={cancelPreApprovedStatusChange}
          title="Aplicar custos aplicaveis agora?"
          width="max-w-lg"
        >
          <div className="space-y-4">
            <p className="text-sm text-foreground/90">
              Ao pre-aprovar, somente os custos aplicaveis deste orcamento serao
              aplicados como gasto.
            </p>
            <p className="text-xs text-muted-foreground">
              Materiais, departamentos de gasto e mao de obra serao aplicados
              apenas na aprovacao oficial.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={cancelPreApprovedStatusChange}
                className="px-4 py-2 text-sm rounded border border-border hover:bg-secondary transition-colors text-muted-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={confirmPreApprovedStatusChange}
                className="px-4 py-2 text-sm rounded bg-blue-500 text-white font-medium hover:opacity-90 transition-opacity"
              >
                Confirmar pre-aprovacao
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedToPreApprove && (
        <Modal
          open={Boolean(selectedToPreApprove)}
          onClose={closePreApproveModal}
          title="Pre-aprovar e aplicar custos aplicaveis?"
          width="max-w-xl"
        >
          <div className="space-y-4">
            <p className="text-sm text-foreground/90">
              Ao pre-aprovar, somente os custos aplicaveis serao aplicados
              agora.
            </p>
            <p className="text-xs text-muted-foreground">
              Materiais, departamentos de gasto e mao de obra serao aplicados
              somente na aprovacao oficial.
            </p>

            <div className="rounded border border-border bg-secondary/20 px-3 py-2 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Cliente:</span>{" "}
                {selectedToPreApprove.clientName}
              </p>
              <p>
                <span className="text-muted-foreground">Descricao:</span>{" "}
                {selectedToPreApprove.description}
              </p>
              <p>
                <span className="text-muted-foreground">
                  Custos aplicaveis (agora):
                </span>{" "}
                {formatCurrency(selectedToPreApprove.costsApplicableValue)}
              </p>
              <p>
                <span className="text-muted-foreground">
                  Custo restante (apos pre-aprovacao):
                </span>{" "}
                {formatCurrency(selectedToPreApprove.remainingCostToApply)}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closePreApproveModal}
                disabled={preApprovingId === selectedToPreApprove.id}
                className="px-4 py-2 text-sm rounded border border-border hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={() => void confirmPreApproveBudget()}
                disabled={preApprovingId === selectedToPreApprove.id}
                className="px-4 py-2 text-sm rounded bg-blue-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {preApprovingId === selectedToPreApprove.id
                  ? "Aplicando..."
                  : "Pre-aprovar e aplicar custos aplicaveis"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedToApprove && (
        <Modal
          open={Boolean(selectedToApprove)}
          onClose={() => closeApproveModal()}
          title="Aprovar oficialmente"
          width="max-w-xl"
        >
          <div className="space-y-4">
            <p className="text-sm text-foreground/90">
              Esta acao finaliza o orcamento como aprovado/oficial e aplica os
              custos restantes (materiais, departamentos de gasto e mao de
              obra).
            </p>
            <p className="text-xs text-muted-foreground">
              Os custos aplicaveis ja lancados na pre-aprovacao serao mantidos.
            </p>

            <div className="rounded border border-border bg-secondary/20 px-3 py-2 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Cliente:</span>{" "}
                {selectedToApprove.clientName}
              </p>
              <p>
                <span className="text-muted-foreground">Descricao:</span>{" "}
                {selectedToApprove.description}
              </p>
              <p>
                <span className="text-muted-foreground">Itens:</span>{" "}
                {selectedToApprove.items.length}
              </p>
              <p>
                <span className="text-muted-foreground">
                  Custo restante para aplicar:
                </span>{" "}
                {formatCurrency(selectedToApprove.remainingCostToApply)}
              </p>
            </div>

            {approvalError && (
              <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive space-y-2">
                <p>{approvalError}</p>

                {approvalDetails.length > 0 && (
                  <ul className="list-disc pl-4 space-y-1 text-xs">
                    {approvalDetails.map((detail, index) => (
                      <li key={`${detail.productId}-${index}`}>
                        {formatApproveBudgetDetailMessage(detail)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => closeApproveModal()}
                disabled={approvingId === selectedToApprove.id}
                className="px-4 py-2 text-sm rounded border border-border hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={() => void confirmApproveBudget()}
                disabled={approvingId === selectedToApprove.id}
                className="px-4 py-2 text-sm rounded bg-success text-success-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {approvingId === selectedToApprove.id
                  ? "Aprovando..."
                  : "Confirmar aprovacao oficial"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <Modal
        open={detailModalOpen}
        onClose={closeDetailModal}
        title={`Detalhe do Orçamento ${selectedBudget ? `#${selectedBudget.id}` : ""}`}
        width="max-w-2xl"
      >
        {isLoadingDetail ? (
          <p className="text-sm text-muted-foreground">
            Carregando detalhes...
          </p>
        ) : (
          <div className="space-y-4">
            {detailError && (
              <div className="border border-destructive/40 bg-destructive/10 rounded px-3 py-2 text-sm text-destructive">
                {detailError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Cliente"
                as="select"
                value={detailForm.clientName}
                onChange={(e) =>
                  setDetailForm((current) => ({
                    ...current,
                    clientName: e.target.value,
                  }))
                }
                options={detailClientOptions}
              />

              <FormField
                label="Categoria do orcamento"
                as="select"
                value={detailForm.category}
                onChange={(e) =>
                  setDetailForm((current) => ({
                    ...current,
                    category: e.target.value as BudgetCategory,
                  }))
                }
                options={[
                  {
                    value: "arquitetonico",
                    label: formatCategory("arquitetonico"),
                  },
                  { value: "executivo", label: formatCategory("executivo") },
                ]}
              />
            </div>

            {selectedBudget && (
              <div className="rounded border border-border bg-secondary/20 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Categoria:</span>{" "}
                <span className="font-medium text-foreground">
                  {formatCategory(detailForm.category)}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Status"
                as="select"
                value={detailForm.status}
                onChange={(e) =>
                  requestStatusChange("detail", e.target.value as BudgetStatus)
                }
                error={detailStatusFieldError}
                options={[
                  { value: "draft", label: "Rascunho" },
                  {
                    value: "pre_approved",
                    label: "Pre-aprovado (aplica somente custos aplicaveis)",
                  },
                  {
                    value: "approved",
                    label: "Aprovado (oficial, aplica custos restantes)",
                  },
                  { value: "pending", label: "Pendente" },
                  { value: "rejected", label: "Rejeitado" },
                ]}
              />
            </div>

            {selectedBudget && selectedBudget.costsAppliedAt && (
              <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                Custos aplicaveis ja aplicados em{" "}
                {formatDateTime(selectedBudget.costsAppliedAt)} com base no
                valor salvo em Custo aplicavel. Alteracoes devem considerar o
                impacto financeiro ja registrado.
              </div>
            )}

            {selectedBudget && (
              <div className="rounded border border-border bg-secondary/20 p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
                  Indicadores de custos aplicados
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">
                      Custo aplicavel (base)
                    </p>
                    <p className="font-mono font-bold text-foreground">
                      {formatCurrency(selectedBudget.costsApplicableValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Custos aplicados</p>
                    <p className="font-mono font-bold text-foreground">
                      {formatCurrency(selectedBudget.costsAppliedValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data da aplicacao</p>
                    <p className="font-medium text-foreground">
                      {formatDateTime(selectedBudget.costsAppliedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      Custo restante para aplicar
                    </p>
                    <p className="font-mono font-bold text-foreground">
                      {formatCurrency(selectedBudget.remainingCostToApply)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedBudget && (
              <div className="rounded border border-border bg-secondary/20 p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
                  Validade do orçamento
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">
                      Prazo estimado de entrega
                    </p>
                    <p className="font-medium text-foreground">
                      {formatBusinessDaysLabel(
                        selectedBudget.estimatedDeliveryBusinessDays,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Validade</p>
                    <p className="font-medium text-foreground">
                      {selectedBudget.validityBusinessDays} dias uteis
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      Dias úteis decorridos
                    </p>
                    <p className="font-medium text-foreground">
                      {selectedBudget.elapsedBusinessDays}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      Dias úteis restantes
                    </p>
                    <p
                      className={
                        selectedBudget.isExpired
                          ? "font-medium text-destructive"
                          : "font-medium text-success"
                      }
                    >
                      {selectedBudget.remainingValidityBusinessDays} •{" "}
                      {selectedBudget.isExpired
                        ? "Expirado"
                        : "Dentro da validade"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <FormField
              label="Descrição"
              as="textarea"
              value={detailForm.description}
              onChange={(e) =>
                setDetailForm((current) => ({
                  ...current,
                  description: e.target.value,
                }))
              }
              placeholder={PROPOSAL_DESCRIPTION_PLACEHOLDER}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Prazo estimado de entrega (dias úteis previstos)"
                type="number"
                min={1}
                step="1"
                value={detailForm.estimatedDeliveryBusinessDays}
                onChange={(e) =>
                  setDetailForm((current) => ({
                    ...current,
                    estimatedDeliveryBusinessDays: e.target.value,
                  }))
                }
              />

              <FormField
                label="Margem de lucro (%)"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={detailForm.profitMargin}
                onChange={(e) =>
                  setDetailForm((current) => ({
                    ...current,
                    profitMargin: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <FormField
                label="Custo aplicavel (R$)"
                type="number"
                min={0}
                step="0.01"
                value={detailForm.costsApplicableValue ?? 0}
                onChange={(e) =>
                  setDetailForm((current) => ({
                    ...current,
                    costsApplicableValue: Math.max(
                      0,
                      Number(e.target.value) || 0,
                    ),
                  }))
                }
              />

              <FormField
                label="Preço final (R$)"
                type="number"
                min={0}
                step="0.01"
                value={Number(detailFinalPriceWithExpenses.toFixed(2))}
                disabled
              />
            </div>

            <FormField
              label="Condições comerciais para PDF"
              as="textarea"
              value={detailForm.paymentTerms}
              onChange={(e) =>
                setDetailForm((current) => ({
                  ...current,
                  paymentTerms: e.target.value,
                }))
              }
              placeholder={DEFAULT_BUDGET_PDF_PAYMENT_TERMS}
            />

            <div className="flex flex-wrap gap-2 -mt-2">
              {[
                "Ato",
                "Boleto 15 dias",
                "Boleto 30 dias",
                "Boleto 45 dias",
                "Ato + boleto 15/30/45 dias",
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    setDetailForm((current) => ({
                      ...current,
                      paymentTerms: current.paymentTerms.trim()
                        ? `${current.paymentTerms}\n${preset}`
                        : preset,
                    }))
                  }
                  className="px-2.5 py-1 text-[11px] font-bold rounded border border-border text-muted-foreground hover:bg-secondary"
                >
                  {preset}
                </button>
              ))}
            </div>

            {selectedBudget && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3">
                  Materiais
                </p>

                {selectedBudget.items.length > 0 && (
                  <div className="border border-border rounded mb-3 divide-y divide-border/50">
                    {selectedBudget.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span>
                            {item.productName} × {item.quantity} {item.unit}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${resolveItemStockStatus(item).className}`}
                          >
                            {resolveItemStockStatus(item).label}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs">
                            R$ {item.subtotal.toFixed(2)}
                          </span>
                          <button
                            onClick={() => removeDetailItem(i)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDetailNewItem((current) => ({
                        ...createEmptyMaterialInput("existing"),
                        mode: "existing",
                      }))
                    }
                    className={`px-3 py-1 text-[11px] font-bold rounded border transition-colors ${
                      detailNewItem.mode === "existing"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    Selecionar produto existente
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDetailNewItem((current) => ({
                        ...createEmptyMaterialInput("new"),
                        mode: "new",
                      }))
                    }
                    className={`px-3 py-1 text-[11px] font-bold rounded border transition-colors ${
                      detailNewItem.mode === "new"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    Cadastrar material novo
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="flex-1">
                    {detailNewItem.mode === "existing" ? (
                      <FormField
                        label="Produto"
                        as="select"
                        value={detailNewItem.productId}
                        onChange={(e) =>
                          setDetailNewItem({
                            ...detailNewItem,
                            productId: e.target.value,
                          })
                        }
                        options={productsCatalog.map((product) => ({
                          value: product.id,
                          label: `${product.name} (Saldo: ${product.stockQuantity})`,
                        }))}
                      />
                    ) : (
                      <FormField
                        label="Novo material"
                        value={detailNewItem.productName}
                        onChange={(e) =>
                          setDetailNewItem({
                            ...detailNewItem,
                            productName: e.target.value,
                          })
                        }
                        placeholder="Ex.: MDF Branco 15mm"
                      />
                    )}
                  </div>
                  <div className="w-full md:w-24">
                    <FormField
                      label="Qtd."
                      type="number"
                      min={1}
                      value={detailNewItem.quantity}
                      onChange={(e) =>
                        setDetailNewItem({
                          ...detailNewItem,
                          quantity: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="w-full md:w-28">
                    <FormField
                      label="Unid."
                      value={detailNewItem.unit}
                      onChange={(e) =>
                        setDetailNewItem({
                          ...detailNewItem,
                          unit: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="w-full md:w-32">
                    <FormField
                      label="Vlr Unit."
                      type="number"
                      min={0}
                      step="0.01"
                      value={detailNewItem.unitPrice}
                      onChange={(e) =>
                        setDetailNewItem({
                          ...detailNewItem,
                          unitPrice: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={addDetailItem}
                      disabled={
                        detailNewItem.mode === "existing" &&
                        (isLoadingProducts || productsCatalog.length === 0)
                      }
                      className="px-3 py-2 text-xs font-bold rounded border border-border hover:bg-secondary transition-colors text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {detailNewItem.mode === "existing" && isLoadingProducts
                        ? "CARREGANDO..."
                        : "ADICIONAR"}
                    </button>
                  </div>
                </div>

                {paperboardConfig && (
                  <p className="mt-6 text-[11px] text-muted-foreground text-center">
                    Custo e preço total calculados automaticamente com base no
                    CLA da configuração de papelão.
                  </p>
                )}
              </div>
            )}

            {/* Paperboard Configuration Section */}
            <div className="border border-border rounded">
              <button
                type="button"
                onClick={togglePaperboardSection}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-secondary/30 transition-colors rounded"
              >
                <span className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    Configuração de Papelão
                  </span>
                  {paperboardConfig && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary">
                      Configurado
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground text-xs">
                  {isPaperboardSectionOpen ? "▲" : "▼"}
                </span>
              </button>

              {isPaperboardSectionOpen && (
                <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
                  {isLoadingPaperboard ? (
                    <p className="text-sm text-muted-foreground">
                      Carregando configuração...
                    </p>
                  ) : (
                    <>
                      {paperboardConfig && (
                        <div className="border border-primary/30 rounded p-3 bg-primary/5 text-sm space-y-1">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
                            Configuração Atual
                          </p>
                          <p>
                            <span className="text-muted-foreground">
                              Dimensões:
                            </span>{" "}
                            {paperboardConfig.length} × {paperboardConfig.width}{" "}
                            × {paperboardConfig.height} cm
                          </p>
                          <p>
                            <span className="text-muted-foreground">
                              Gramatura:
                            </span>{" "}
                            {paperboardConfig.gramatura} g/m²
                          </p>
                          <p>
                            <span className="text-muted-foreground">
                              Quantidade:
                            </span>{" "}
                            {paperboardConfig.quantity}
                          </p>
                          {paperboardConfig.estimatedCost != null && (
                            <p>
                              <span className="text-muted-foreground">
                                Custo estimado:
                              </span>{" "}
                              <strong className="text-primary">
                                {formatCurrency(paperboardConfig.estimatedCost)}
                              </strong>
                            </p>
                          )}
                          {paperboardConfig.suggestedPrice != null && (
                            <p>
                              <span className="text-muted-foreground">
                                Preço sugerido:
                              </span>{" "}
                              <strong>
                                {formatCurrency(
                                  paperboardConfig.suggestedPrice,
                                )}
                              </strong>
                            </p>
                          )}
                          {paperboardConfig.totalBundles > 0 && (
                            <p>
                              <span className="text-muted-foreground">
                                Fardos:
                              </span>{" "}
                              {paperboardConfig.totalBundles.toLocaleString(
                                "pt-BR",
                              )}
                            </p>
                          )}
                          <p>
                            <span className="text-muted-foreground">
                              Folhas estimadas:
                            </span>{" "}
                            {paperboardConfig.totalSheets.toLocaleString(
                              "pt-BR",
                              {
                                maximumFractionDigits: 2,
                              },
                            )}
                          </p>
                          <p>
                            <span className="text-muted-foreground">
                              Custo material:
                            </span>{" "}
                            {formatCurrency(paperboardConfig.materialCost)}
                          </p>
                          {paperboardConfig.area != null && (
                            <p>
                              <span className="text-muted-foreground">
                                Área:
                              </span>{" "}
                              {paperboardConfig.area.toLocaleString("pt-BR")}{" "}
                              cm²
                            </p>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <FormField
                          label="Comprimento (cm)"
                          type="number"
                          min={0}
                          step="0.1"
                          value={paperboardForm.length}
                          onChange={(e) =>
                            setPaperboardForm((f) => ({
                              ...f,
                              length: Number(e.target.value),
                            }))
                          }
                        />
                        <FormField
                          label="Largura (cm)"
                          type="number"
                          min={0}
                          step="0.1"
                          value={paperboardForm.width}
                          onChange={(e) =>
                            setPaperboardForm((f) => ({
                              ...f,
                              width: Number(e.target.value),
                            }))
                          }
                        />
                        <FormField
                          label="Altura (cm)"
                          type="number"
                          min={0}
                          step="0.1"
                          value={paperboardForm.height}
                          onChange={(e) =>
                            setPaperboardForm((f) => ({
                              ...f,
                              height: Number(e.target.value),
                            }))
                          }
                        />
                        <FormField
                          label="Gramatura (g/m²)"
                          type="number"
                          min={0}
                          step="1"
                          value={paperboardForm.gramatura}
                          onChange={(e) =>
                            setPaperboardForm((f) => ({
                              ...f,
                              gramatura: Number(e.target.value),
                            }))
                          }
                        />
                        <FormField
                          label="Quantidade"
                          type="number"
                          min={1}
                          step="1"
                          value={paperboardForm.quantity}
                          onChange={(e) =>
                            setPaperboardForm((f) => ({
                              ...f,
                              quantity: Number(e.target.value),
                            }))
                          }
                        />
                        <FormField
                          label="Folhas por fardo"
                          type="number"
                          min={1}
                          step="1"
                          value={paperboardForm.sheetsPerBundle ?? ""}
                          onChange={(e) =>
                            setPaperboardForm((f) => ({
                              ...f,
                              sheetsPerBundle: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            }))
                          }
                        />
                        <FormField
                          label="Custo por folha (R$)"
                          type="number"
                          min={0}
                          step="0.0001"
                          value={paperboardForm.sheetUnitCost ?? ""}
                          onChange={(e) =>
                            setPaperboardForm((f) => ({
                              ...f,
                              sheetUnitCost: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            }))
                          }
                        />
                        <FormField
                          label="Custo corte/kg (R$)"
                          type="number"
                          min={0}
                          step="0.0001"
                          value={paperboardForm.cuttingCostPerKg ?? ""}
                          onChange={(e) =>
                            setPaperboardForm((f) => ({
                              ...f,
                              cuttingCostPerKg: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            }))
                          }
                        />
                        <FormField
                          label="Custo vinco/kg (R$)"
                          type="number"
                          min={0}
                          step="0.0001"
                          value={paperboardForm.creasingCostPerKg ?? ""}
                          onChange={(e) =>
                            setPaperboardForm((f) => ({
                              ...f,
                              creasingCostPerKg: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            }))
                          }
                        />
                        <FormField
                          label="Perda (%)"
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          value={paperboardForm.lossPercentage ?? 0}
                          onChange={(e) =>
                            setPaperboardForm((f) => ({
                              ...f,
                              lossPercentage: Number(e.target.value),
                            }))
                          }
                        />
                        <FormField
                          label="Markup (%)"
                          type="number"
                          min={0}
                          step="0.1"
                          value={paperboardForm.markupPercentage ?? 35}
                          onChange={(e) =>
                            setPaperboardForm((f) => ({
                              ...f,
                              markupPercentage: Number(e.target.value),
                            }))
                          }
                        />
                      </div>

                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={paperboardForm.usesFullSheet}
                            onChange={(e) =>
                              setPaperboardForm((f) => ({
                                ...f,
                                usesFullSheet: e.target.checked,
                              }))
                            }
                            className="rounded border-border"
                          />
                          Usar folha inteira
                        </label>
                        <label
                          className={`flex items-center gap-2 text-sm cursor-pointer ${paperboardForm.quantity < 500 ? "opacity-50 cursor-not-allowed" : ""}`}
                          title={
                            paperboardForm.quantity < 500
                              ? "Corte terceirizado requer quantidade mínima de 500"
                              : ""
                          }
                        >
                          <input
                            type="checkbox"
                            checked={paperboardForm.outsourcedCut}
                            disabled={paperboardForm.quantity < 500}
                            onChange={(e) =>
                              setPaperboardForm((f) => ({
                                ...f,
                                outsourcedCut: e.target.checked,
                              }))
                            }
                            className="rounded border-border"
                          />
                          Corte terceirizado
                          {paperboardForm.quantity < 500 && (
                            <span className="text-[10px] text-muted-foreground">
                              (mín. 500 unid.)
                            </span>
                          )}
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={paperboardForm.isFirstPurchase}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setPaperboardForm((f) => ({
                                ...f,
                                isFirstPurchase: checked,
                                clicheCost: checked ? f.clicheCost : undefined,
                                clichePrice: checked
                                  ? f.clichePrice
                                  : undefined,
                              }));
                            }}
                            className="rounded border-border"
                          />
                          Primeira compra (clichê)
                        </label>
                      </div>

                      {paperboardForm.isFirstPurchase && (
                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            label="Custo do Clichê (R$)"
                            type="number"
                            min={0}
                            step="0.01"
                            value={paperboardForm.clicheCost ?? ""}
                            onChange={(e) =>
                              setPaperboardForm((f) => ({
                                ...f,
                                clicheCost: e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              }))
                            }
                          />
                          <FormField
                            label="Preço do Clichê (R$)"
                            type="number"
                            min={0}
                            step="0.01"
                            value={paperboardForm.clichePrice ?? ""}
                            onChange={(e) =>
                              setPaperboardForm((f) => ({
                                ...f,
                                clichePrice: e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              }))
                            }
                          />
                        </div>
                      )}

                      {paperboardPreview && (
                        <div className="rounded border border-border bg-secondary/20 p-3 text-sm space-y-1">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
                            Prévia CLA em tempo real
                          </p>
                          <p className="text-[11px] text-muted-foreground mb-2">
                            Estes valores são apenas prévia. O orçamento só é
                            atualizado após clicar em Salvar Configuração.
                          </p>
                          <p>
                            <span className="text-muted-foreground">
                              Custo estimado:
                            </span>{" "}
                            <strong className="text-primary">
                              {formatCurrency(paperboardPreview.estimatedCost)}
                            </strong>
                          </p>
                          <p>
                            <span className="text-muted-foreground">
                              Preço sugerido:
                            </span>{" "}
                            <strong>
                              {formatCurrency(paperboardPreview.suggestedPrice)}
                            </strong>
                          </p>
                          <p>
                            <span className="text-muted-foreground">
                              Margem CLA:
                            </span>{" "}
                            <strong>
                              {detailClaMarginDisplay.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                              %
                            </strong>
                          </p>
                          <p>
                            <span className="text-muted-foreground">
                              Folhas estimadas:
                            </span>{" "}
                            {paperboardPreview.totalSheets.toLocaleString(
                              "pt-BR",
                              { maximumFractionDigits: 2 },
                            )}
                          </p>
                          {paperboardPreview.totalBundles > 0 && (
                            <p>
                              <span className="text-muted-foreground">
                                Fardos estimados:
                              </span>{" "}
                              {paperboardPreview.totalBundles.toLocaleString(
                                "pt-BR",
                              )}
                            </p>
                          )}
                        </div>
                      )}

                      {paperboardError && (
                        <p className="text-sm text-destructive">
                          {paperboardError}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void savePaperboardConfig()}
                          disabled={isSavingPaperboard}
                          className="px-3 py-1.5 text-xs font-bold rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60"
                        >
                          {isSavingPaperboard
                            ? "Salvando..."
                            : paperboardConfig
                              ? "Atualizar Configuração"
                              : "Salvar Configuração"}
                        </button>
                        {paperboardConfig && (
                          <button
                            type="button"
                            onClick={() => void handleDeletePaperboardConfig()}
                            disabled={isSavingPaperboard}
                            className="px-3 py-1.5 text-xs font-bold rounded border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-60"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <FormField
              label="Observações"
              as="textarea"
              value={detailForm.notes}
              onChange={(e) =>
                setDetailForm((current) => ({
                  ...current,
                  notes: e.target.value,
                }))
              }
              placeholder={PROPOSAL_NOTES_PLACEHOLDER}
            />

            <div className="flex justify-end gap-3">
              {selectedBudget &&
                (selectedBudget.status === "draft" ||
                  selectedBudget.status === "pending") && (
                  <button
                    onClick={() => void handleDetailPreApproveClick()}
                    disabled={
                      Boolean(preApprovingId) ||
                      isUpdatingDetail ||
                      isLoadingDetail
                    }
                    className="px-4 py-2 text-sm rounded bg-blue-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {preApprovingId === selectedBudget.id
                      ? "Aplicando custos..."
                      : "Pre-aprovar e aplicar custos aplicaveis"}
                  </button>
                )}

              {selectedBudget && selectedBudget.status === "pre_approved" && (
                <button
                  onClick={() => openApproveModal(selectedBudget)}
                  disabled={
                    Boolean(approvingId) || isUpdatingDetail || isLoadingDetail
                  }
                  className="px-4 py-2 text-sm rounded bg-success text-success-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {approvingId === selectedBudget.id
                    ? "Aprovando..."
                    : "Aprovar oficialmente"}
                </button>
              )}

              <button
                onClick={closeDetailModal}
                className="px-4 py-2 text-sm rounded border border-border hover:bg-secondary transition-colors text-muted-foreground"
              >
                Fechar
              </button>
              <button
                onClick={() => void saveBudgetDetail()}
                disabled={isUpdatingDetail || isLoadingDetail}
                className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isUpdatingDetail ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={contractModalOpen}
        onClose={closeContractModal}
        title={`Contrato • ${selectedBudgetForContract?.clientName || "Cliente"}`}
        width="max-w-3xl"
      >
        <div className="space-y-5 max-h-[72vh] overflow-y-auto pr-1">
          <div className="border border-border rounded p-3 bg-secondary/20">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
              Informações Fixas da Contratada
            </p>
            <p className="text-sm text-foreground">4D EMBALAGENS LTDA</p>
            <p className="text-xs text-muted-foreground">
              Rua Benedito Passos, 160 • Vila Matilde • São Paulo/SP
            </p>
            <p className="text-xs text-muted-foreground">
              CNPJ 62.728.414/0001-99 • (11) 2651-4292 •
              daniel@4dembalagens.com.br
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Assinatura fixa da contratada: Daniel Visnardi (Dpto Comercial).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Nome da Contratante"
              value={contractForm.contratanteName}
              onChange={(e) =>
                setContractForm((current) => ({
                  ...current,
                  contratanteName: e.target.value,
                }))
              }
              placeholder="Ex.: Do Coco ao Cacau LTDA"
            />
            <FormField
              label="Nome da Operação/Cliente"
              value={contractForm.operationName}
              onChange={(e) =>
                setContractForm((current) => ({
                  ...current,
                  operationName: e.target.value,
                }))
              }
              placeholder="Ex.: Do Coco ao Cacau"
            />
          </div>

          <FormField
            label="Endereço da Obra"
            value={contractForm.projectAddress}
            onChange={(e) =>
              setContractForm((current) => ({
                ...current,
                projectAddress: e.target.value,
              }))
            }
            placeholder="Endereço de entrega/instalação"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Largura do Projeto (m)"
              type="number"
              min={0.1}
              step="0.1"
              value={contractForm.kioskWidthMeters}
              onChange={(e) =>
                setContractForm((current) => ({
                  ...current,
                  kioskWidthMeters: Number(e.target.value),
                }))
              }
            />
            <FormField
              label="Profundidade do Projeto (m)"
              type="number"
              min={0.1}
              step="0.1"
              value={contractForm.kioskDepthMeters}
              onChange={(e) =>
                setContractForm((current) => ({
                  ...current,
                  kioskDepthMeters: Number(e.target.value),
                }))
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              label="Valor do Contrato (R$)"
              type="number"
              min={0}
              step="0.01"
              value={contractForm.contractValue}
              onChange={(e) =>
                setContractForm((current) => ({
                  ...current,
                  contractValue: Number(e.target.value),
                }))
              }
            />
            <FormField
              label="Cidade da Assinatura"
              value={contractForm.signatureCity}
              onChange={(e) =>
                setContractForm((current) => ({
                  ...current,
                  signatureCity: e.target.value,
                }))
              }
            />
            <FormField
              label="Data da Assinatura"
              type="date"
              value={contractForm.signatureDate}
              onChange={(e) =>
                setContractForm((current) => ({
                  ...current,
                  signatureDate: e.target.value,
                }))
              }
            />
          </div>

          <div className="border border-border rounded p-3 bg-secondary/20 space-y-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Cláusulas Editáveis
            </p>

            <p className="text-xs text-muted-foreground -mt-2">
              Dica: use {"{{valor_contrato}}"} no conteúdo para inserir
              automaticamente o valor do contrato.
            </p>

            <div className="space-y-4">
              {contractForm.clauses.map((clause, index) => (
                <div
                  key={clause.id}
                  className="rounded border border-border bg-background/60 p-3 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                      Cláusula {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeClause(clause.id)}
                      disabled={contractForm.clauses.length <= 1}
                      className="px-3 py-1 text-xs rounded border border-border text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Excluir
                    </button>
                  </div>

                  <FormField
                    label="Nome da Cláusula"
                    value={clause.title}
                    onChange={(e) =>
                      updateClause(clause.id, { title: e.target.value })
                    }
                  />

                  <FormField
                    as="textarea"
                    rows={6}
                    label="Conteúdo da Cláusula"
                    value={clause.content}
                    onChange={(e) =>
                      updateClause(clause.id, { content: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={addClause}
                className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:bg-secondary transition-colors"
              >
                Adicionar Cláusula
              </button>
            </div>
          </div>

          {contractFormError && (
            <p className="text-sm text-destructive">{contractFormError}</p>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={closeContractModal}
              className="px-4 py-2 text-sm rounded border border-border hover:bg-secondary transition-colors text-muted-foreground"
            >
              Cancelar
            </button>
            <button
              onClick={() => void generateContractPdf()}
              disabled={isGeneratingContract}
              className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isGeneratingContract
                ? "Gerando contrato..."
                : "Gerar Contrato PDF"}
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default BudgetsPage;
