import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  Inbox,
  Settings,
  Plug,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import clerivoLogo from "@/assets/clerivo-logo.svg";
import clerivoWordmark from "@/assets/clerivo-wordmark.svg";
import clerivoWordmarkWhite from "@/assets/clerivo-wordmark-white.svg";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Route = createFileRoute("/app")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    return { email: data.session.user.email ?? "" };
  },
  component: AppLayout,
});

const navMain = [
  { to: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/app/create", icon: Bot, label: "Agente IA" },
  { to: "/app/simulator", icon: MessageSquare, label: "Simulador" },
  { to: "/app/chats", icon: Inbox, label: "Chats" },
  { to: "/app/integrations", icon: Plug, label: "Integraciones" },
  { to: "/app/settings", icon: Settings, label: "Configuración" },
];

const SIDEBAR_STATE_KEY = "clerivo:sidebar-collapsed";

function SidebarNav({
  path,
  collapsed,
}: {
  path: string;
  collapsed: boolean;
}) {
  return (
    <>
      <Link
        to="/"
        className={`flex h-16 items-center gap-2 border-b border-border ${
          collapsed ? "justify-center px-2" : "px-5"
        }`}
      >
        <img
          src={clerivoLogo}
          alt="Clerivo"
          className="h-8 w-8 shrink-0 rounded-lg"
        />
        <span
          className={`flex items-center transition-[opacity,width] duration-200 ${
            collapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
          }`}
        >
          <img
            src={clerivoWordmark}
            alt="clerivo"
            className="h-5 w-auto dark:hidden"
          />
          <img
            src={clerivoWordmarkWhite}
            alt="clerivo"
            className="hidden h-5 w-auto dark:block"
          />
        </span>
      </Link>

      <nav
        className={`scrollbar-clerivo flex-1 overflow-y-auto py-5 ${
          collapsed ? "px-2" : "px-3"
        }`}
      >
        {!collapsed && (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Operación
          </p>
        )}
        <ul className="space-y-1">
          {navMain.map((item) => {
            const active = path === item.to;
            const linkEl = (
              <Link
                to={item.to}
                aria-label={item.label}
                className={`group relative flex min-h-10 items-center rounded-lg text-sm font-medium transition-all duration-200 ${
                  collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2"
                } ${
                  active
                    ? "border border-primary/20 bg-accent text-accent-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                } ${active && collapsed ? "shadow-glow" : ""}`}
              >
                {active && !collapsed && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-x-3 -translate-y-1/2 rounded-full bg-primary" />
                )}
                <item.icon className="h-4 w-4 shrink-0" />
                <span
                  className={`overflow-hidden whitespace-nowrap transition-[opacity,width] duration-200 ${
                    collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );

            return (
              <li key={item.to}>
                {collapsed ? (
                  <Tooltip delayDuration={150}>
                    <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  linkEl
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

function AppLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { email } = Route.useRouteContext();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Restore collapsed preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STATE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed]);

  // Cerrar el menú mobile al navegar
  useEffect(() => {
    setMobileNavOpen(false);
  }, [path]);

  const handleLogout = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/login" });
  };

  return (
    <TooltipProvider>
      <div className="flex min-h-screen w-full bg-surface">
        {/* Sidebar desktop */}
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-out md:flex ${
            collapsed ? "w-16" : "w-64"
          }`}
        >
          <div className="relative flex h-full flex-col">
            <SidebarNav path={path} collapsed={collapsed} />
          </div>
        </aside>

        {/* Sidebar mobile (drawer) */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="relative flex h-full w-72 max-w-[85%] flex-col border-r border-border bg-sidebar shadow-xl animate-in slide-in-from-left duration-200">
              <button
                onClick={() => setMobileNavOpen(false)}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                aria-label="Cerrar menú"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarNav path={path} collapsed={false} />
            </aside>
          </div>
        )}

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b border-border bg-background/86 px-3 backdrop-blur-xl sm:px-4 md:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                onClick={() => setMobileNavOpen(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
                aria-label="Abrir menú"
              >
                <Menu className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setCollapsed((v) => !v)}
                aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
                title={collapsed ? "Expandir menú" : "Colapsar menú"}
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition hover:border-primary/40 hover:text-foreground hover:shadow-sm md:inline-flex"
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
              <Link to="/" className="flex items-center gap-2 md:hidden">
                <img
                  src={clerivoLogo}
                  alt="Clerivo"
                  className="h-7 w-7 rounded-lg"
                />
                <img
                  src={clerivoWordmark}
                  alt="clerivo"
                  className="h-4 w-auto dark:hidden"
                />
                <img
                  src={clerivoWordmarkWhite}
                  alt="clerivo"
                  className="hidden h-4 w-auto dark:block"
                />
              </Link>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <ThemeToggle />
              <div className="ml-1 flex items-center gap-2 border-l border-border pl-2 sm:pl-3">
                {(() => {
                  const isInternal = !email || /demo|clerivo\.app$/i.test(email);
                  const display = isInternal ? "Usuario" : email;
                  const initial = (isInternal ? "U" : email[0] || "U").toUpperCase();
                  return (
                    <>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
                        {initial}
                      </div>
                      <div className="hidden text-xs lg:block">
                        <p className="max-w-[140px] truncate font-semibold leading-tight">
                          {display}
                        </p>
                        <p className="text-muted-foreground">Mi cuenta</p>
                      </div>
                    </>
                  );
                })()}
                <button
                  onClick={handleLogout}
                  disabled={signingOut}
                  title="Cerrar sesión"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 animate-fade-in product-shell pb-20 md:pb-0" key={path}>
            <Outlet />
          </main>

          {/* Bottom nav mobile */}
          <nav
            className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around border-t border-border bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
            aria-label="Navegación inferior"
          >
            {[
              { to: "/app/dashboard", icon: LayoutDashboard, label: "Inicio" },
              { to: "/app/create", icon: Bot, label: "Agente" },
              { to: "/app/simulator", icon: MessageSquare, label: "Probar" },
              { to: "/app/chats", icon: Inbox, label: "Chats" },
              { to: "/app/settings", icon: Settings, label: "Ajustes" },
            ].map((item) => {
              const active = path === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span
                    className={`flex h-9 w-14 items-center justify-center rounded-full transition-all duration-300 ${
                      active ? "bg-accent text-accent-foreground shadow-sm" : ""
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </TooltipProvider>
  );
}
