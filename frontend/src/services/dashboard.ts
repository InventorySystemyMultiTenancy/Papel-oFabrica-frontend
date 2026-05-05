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
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const data = await request<{ data: DashboardSummary } | DashboardSummary>(
    "/dashboard/summary",
  );
  const d = (data as { data: DashboardSummary }).data ?? data;
  return d as DashboardSummary;
}
