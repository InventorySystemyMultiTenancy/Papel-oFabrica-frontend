import { Bell, Menu, Search } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/i18n/LanguageProvider";

interface TopNavProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  onToggleSidebar?: () => void;
}

export function TopNav({ title, subtitle, action, onToggleSidebar }: TopNavProps) {
  const { user } = useAuth();
  const { isItalian, setLanguage, t } = useLanguage();
  const isAdmin = user?.role === "admin";
  const firstName = user?.name?.trim().split(" ")[0] || "Usuário";
  const welcomeMessage = isItalian
    ? `Benvenuto(a), ${firstName}! Cosa costruiamo oggi?`
    : `Seja bem vindo(a), ${firstName}! O que vamos construir hoje?`;

  return (
    <header className="min-h-14 border-b border-border flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 md:px-6 lg:px-8 py-2 md:bg-background/50 md:backdrop-blur-md bg-orange-500 shrink-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Botão hamburguer mobile — 3 traços em azul */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded hover:bg-white/20 transition-colors text-blue-700"
          aria-label={t("Abrir menu lateral")}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Logo + nome — só no mobile */}
        <div className="md:hidden flex items-center gap-2">
          <img src="/4d.jpg" alt="4D Embalagens" className="h-8 w-8 rounded-full object-cover ring-2 ring-white/40" />
          <span className="font-bold text-sm text-white leading-tight">
            4D Embalagens
          </span>
        </div>

        <div className="hidden md:block min-w-0">
          <h1 className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
            {subtitle && <span>{t(subtitle)} / </span>}
            <span className="text-foreground">{t(title)}</span>
          </h1>
          {user && (
            <p className="text-[11px] text-muted-foreground truncate">{welcomeMessage}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0 w-full sm:w-auto justify-end">
        {isAdmin && (
          <div className="hidden md:flex items-center gap-2 rounded border border-border px-2 py-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {isItalian ? "Italiano" : "Português"}
            </span>
            <Switch
              checked={isItalian}
              onCheckedChange={(checked) => setLanguage(checked ? "it-IT" : "pt-BR")}
              aria-label="Alternar idioma para italiano"
            />
          </div>
        )}

        {action}

        <button className="hidden sm:inline-flex p-2 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <Search className="h-4 w-4" />
        </button>

        <button className="hidden sm:inline-flex p-2 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
        </button>
      </div>
    </header>
  );
}
