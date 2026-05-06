import { ReactNode, useState, createContext, useContext } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { TopNav } from "@/components/TopNav";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

/**
 * When true, DashboardLayout renders only its children (no sidebar/topnav).
 * Hub pages set this to true so embedded sub-pages skip the outer chrome.
 */
export const EmbeddedContext = createContext(false);

export function DashboardLayout({
  children,
  title,
  subtitle,
  action,
}: DashboardLayoutProps) {
  const isEmbedded = useContext(EmbeddedContext);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (isEmbedded) {
    return <>{children}</>;
  }

  return (
    <div className="relative isolate flex min-h-screen text-foreground overflow-hidden">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: "url('/loginimage.jpg')" }}
      />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-white/80 via-blue-100/72 to-orange-50/70" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_0%_0%,rgba(37,99,235,0.22),transparent_42%),radial-gradient(circle_at_100%_100%,rgba(249,115,22,0.18),transparent_40%)]" />

      <AppSidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav
          title={title}
          subtitle={subtitle}
          action={action}
          onToggleSidebar={() => setMobileSidebarOpen((current) => !current)}
        />
        <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
