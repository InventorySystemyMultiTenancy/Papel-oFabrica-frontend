import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
import StockHub from "./pages/StockHub.tsx";
import BudgetsPage from "./pages/Budgets.tsx";
import ProductionPage from "./pages/Production.tsx";
import LogisticsHub from "./pages/LogisticsHub.tsx";
import ProductionTrackingPublicPage from "./pages/ProductionTrackingPublic.tsx";
import OrdersPage from "./pages/Orders.tsx";
import FinancialHub from "./pages/FinancialHub.tsx";
import ClichesPage from "./pages/Cliches.tsx";
import WastePage from "./pages/Waste.tsx";
import PurchaseOrdersPage from "./pages/PurchaseOrders.tsx";
import PricingPage from "./pages/Pricing.tsx";
import DashboardPage from "./pages/Dashboard.tsx";
import { useAuth } from "@/auth/AuthProvider";

const queryClient = new QueryClient();

const DefaultAuthenticatedHome = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Navigate
      to={
        user.role === "funcionario"
          ? "/production"
          : user.role === "gerente"
            ? "/budgets"
            : "/financial"
      }
      replace
    />
  );
};

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
                <Route path="/" element={<DefaultAuthenticatedHome />} />
                <Route path="/production" element={<ProductionPage />} />
                <Route path="/forbidden" element={<ForbiddenPage />} />

                <Route
                  element={
                    <RequireRoles allowedRoles={["admin", "funcionario"]} />
                  }
                >
                  <Route path="/logistics" element={<LogisticsHub />} />
                </Route>

                <Route
                  element={<RequireRoles allowedRoles={["admin"]} />}
                >
                  <Route path="/overview" element={<Index />} />
                  <Route path="/products" element={<StockHub />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/financial" element={<FinancialHub />} />
                  <Route path="/cliches" element={<ClichesPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                </Route>

                <Route
                  element={<RequireRoles allowedRoles={["admin", "gerente"]} />}
                >
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/employees" element={<EmployeesPage />} />
                  <Route path="/budgets" element={<BudgetsPage />} />
                  <Route path="/waste" element={<WastePage />} />
                  <Route
                    path="/purchase-orders"
                    element={<PurchaseOrdersPage />}
                  />
                  <Route path="/pricing" element={<PricingPage />} />
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
