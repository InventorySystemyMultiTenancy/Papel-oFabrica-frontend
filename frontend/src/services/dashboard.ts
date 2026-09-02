import { request } from "@/services/api";

export interface DashboardSummary {
  revenueThisMonth: number;
  revenueLastMonth: number;
  openOrdersCount: number;
  ordersThisMonth: number;
  budgetsDraftCount: number;
  budgetsPendingCount: number;
  budgetsApprovedCount: number;
  budgetsThisMonth: number;
  receivablePending: number;
  receivableOverdue: number;
  receivablePaid: number;
  payablePending: number;
  payableOverdue: number;
  projectedBalance: number;
  revenueByMonth: Array<{ month: string; revenue: number; cost: number }>;
  lowStockCount: number;
  unpaidClichesTotal: number;
  periodStart: string;
  periodEnd: string;
  periodRevenue: number;
  periodCost: number;
  netProfit: number;
}

export interface DashboardPeriod {
  startDate?: string;
  endDate?: string;
}

export async function getDashboardSummary(
  period?: DashboardPeriod,
): Promise<DashboardSummary> {
  const params = new URLSearchParams();
  if (period?.startDate) params.set("startDate", period.startDate);
  if (period?.endDate) params.set("endDate", period.endDate);
  const query = params.toString();

  const data = await request<{ data: DashboardSummary } | DashboardSummary>(
    `/dashboard/summary${query ? `?${query}` : ""}`,
  );
  const d = (data as { data: DashboardSummary }).data ?? data;
  return d as DashboardSummary;
}
