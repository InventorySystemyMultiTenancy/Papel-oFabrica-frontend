import {
  LayoutDashboard,
  Users,
  User,
  Box,
  FileText,
  Hammer,
  Truck,
  DollarSign,
  Tag,
  Recycle,
  ShoppingBag,
  Calculator,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/auth/AuthProvider";
import type { UserRole } from "@/auth/types";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: UserRole[];
}

const navItems = [
  {
    title: "Logística",
    url: "/logistics",
    icon: Truck,
    allowedRoles: ["admin", "gerente", "funcionario"],
  },
  {
    title: "Clientes",
    url: "/clients",
    icon: Users,
    allowedRoles: ["admin", "gerente"],
  },
  {
    title: "Funcionários",
    url: "/employees",
    icon: User,
    allowedRoles: ["admin", "gerente"],
  },
  {
    title: "Estoque",
    url: "/products",
    icon: Box,
    allowedRoles: ["admin", "gerente"],
  },
  {
    title: "Orçamentos",
    url: "/budgets",
    icon: FileText,
    allowedRoles: ["admin", "gerente"],
  },
  {
    title: "Produção (Pedidos)",
    url: "/production",
    icon: Hammer,
    allowedRoles: ["admin", "gerente", "funcionario"],
  },
  {
    title: "Financeiro",
    url: "/financial",
    icon: DollarSign,
    allowedRoles: ["admin", "gerente"],
  },
  {
    title: "Clichês",
    url: "/cliches",
    icon: Tag,
    allowedRoles: ["admin", "gerente"],
  },
  {
    title: "Resíduos",
    url: "/waste",
    icon: Recycle,
    allowedRoles: ["admin", "gerente"],
  },
  {
    title: "Pedidos de Compra",
    url: "/purchase-orders",
    icon: ShoppingBag,
    allowedRoles: ["admin", "gerente"],
  },
  {
    title: "Cotação Rápida",
    url: "/pricing",
    icon: Calculator,
    allowedRoles: ["admin", "gerente"],
  },
] satisfies NavItem[];

interface AppSidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function AppSidebar({
  mobileOpen = false,
  onCloseMobile,
}: AppSidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const previousPathRef = useRef(location.pathname);

  const visibleItems = navItems.filter((item) => {
    if (!user) {
      return false;
    }

    return item.allowedRoles.includes(user.role);
  });

  useEffect(() => {
    if (previousPathRef.current !== location.pathname && mobileOpen) {
      onCloseMobile?.();
    }

    previousPathRef.current = location.pathname;
  }, [location.pathname, mobileOpen, onCloseMobile]);

  const handleLogout = () => {
    onCloseMobile?.();
    logout();
  };

  const renderSidebarContent = (isMobile = false) => (
    <>
      <div className="h-14 px-4 sm:px-5 flex items-center gap-3 border-b border-white/10">
        <img
          src="/4d.jpg"
          alt={t("Logo 4d embalagens")}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-sm object-cover"
        />
        <div className="min-w-0">
          <span className="block font-bold tracking-tight text-sm sm:text-base text-orange-400">
            4D Embalagens
          </span>
          <span className="block text-[10px] tracking-widest text-white/45 uppercase">
            Indústria de Papelão
          </span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive =
            item.url === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.url);

          return (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/"}
              onClick={() => {
                if (isMobile) {
                  onCloseMobile?.();
                }
              }}
              className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                isActive
                  ? "bg-white/15 text-white font-semibold"
                  : "text-white/65 hover:text-white hover:bg-white/10"
              }`}
              activeClassName=""
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{t(item.title)}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        {user && (
          <div className="mb-3">
            <p className="text-xs font-medium text-foreground truncate">
              {user.name}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {user.role}
            </p>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="w-full mb-2 px-3 py-2 text-xs rounded border border-white/20 hover:bg-white/10 transition-colors text-white/70 hover:text-white"
        >
          {t("Sair")}
        </button>

        <p className="text-[10px] uppercase tracking-widest text-orange-400/70">
          {t("Indústria de Papelão v1.0")}
        </p>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden md:flex w-60 min-h-screen border-r border-border bg-sidebar flex-col shrink-0">
        {renderSidebarContent()}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={onCloseMobile}
            aria-label="Fechar menu"
          />

          <aside className="relative h-full w-[85vw] max-w-72 border-r border-border bg-sidebar flex flex-col shadow-2xl animate-fade-in">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}
