import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/auth/AuthProvider";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { RequireAuth, RequireRoles } from "@/auth/guards";
import Index from "./pages/Index.tsx";
import LoginPage from "./pages/Login.tsx";
import ForbiddenPage from "./pages/Forbidden.tsx";
import NotFound from "./pages/NotFound.tsx";
import ClientsPage from "./pages/Clients.tsx";
import EmployeesPage from "./pages/Employees.tsx";
import ProductsPage from "./pages/Products.tsx";
import StockPage from "./pages/Stock.tsx";
import BudgetsPage from "./pages/Budgets.tsx";
import ProductionPage from "./pages/Production.tsx";
import LogisticsPage from "./pages/Logistics.tsx";
import ProductionTrackingPublicPage from "./pages/ProductionTrackingPublic.tsx";
import OrdersPage from "./pages/Orders.tsx";
import FinancialPage from "./pages/Financial.tsx";
import ClichesPage from "./pages/Cliches.tsx";
import AccountsPayablePage from "./pages/AccountsPayable.tsx";
import DeliveryRoutesPage from "./pages/DeliveryRoutes.tsx";
import WastePage from "./pages/Waste.tsx";
import PurchaseOrdersPage from "./pages/PurchaseOrders.tsx";
import ConsignedStockPage from "./pages/ConsignedStock.tsx";
import PricingPage from "./pages/Pricing.tsx";
import DashboardPage from "./pages/Dashboard.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <LanguageProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/acompanhar-producao/:token"
                element={<ProductionTrackingPublicPage />}
              />

              <Route element={<RequireAuth />}>
                <Route path="/" element={<Index />} />
                <Route path="/production" element={<ProductionPage />} />
                <Route path="/logistics" element={<LogisticsPage />} />
                <Route path="/forbidden" element={<ForbiddenPage />} />

                <Route
                  element={<RequireRoles allowedRoles={["admin", "gerente"]} />}
                >
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/employees" element={<EmployeesPage />} />
                  <Route path="/products" element={<ProductsPage />} />
                  <Route path="/stock" element={<StockPage />} />
                  <Route path="/budgets" element={<BudgetsPage />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/financial" element={<FinancialPage />} />
                  <Route path="/cliches" element={<ClichesPage />} />
                  <Route
                    path="/accounts-payable"
                    element={<AccountsPayablePage />}
                  />
                  <Route
                    path="/delivery-routes"
                    element={<DeliveryRoutesPage />}
                  />
                  <Route path="/waste" element={<WastePage />} />
                  <Route
                    path="/purchase-orders"
                    element={<PurchaseOrdersPage />}
                  />
                  <Route
                    path="/consigned-stock"
                    element={<ConsignedStockPage />}
                  />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </LanguageProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
