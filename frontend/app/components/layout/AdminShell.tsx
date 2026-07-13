// Shell del Centro de Administración: sidebar de portales + header con usuario.
// Cada item se muestra según los roles del usuario.
// Sidebar agrupado por secciones con badges de pendientes; header compacto con
// breadcrumb, quick-create global ("+ Nueva") y acceso al catálogo como ícono.
import { useEffect, useRef, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "@remix-run/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  ShoppingCart,
  BarChart3,
  Truck,
  Users,
  Receipt,
  Menu,
  X,
  MessageCircle,
  CreditCard,
  Settings,
  Store,
  LayoutGrid,
  PanelLeftClose,
  PanelLeft,
  Plus,
  ChevronDown,
  ChevronRight,
  KanbanSquare,
  ArrowUpRight,
} from "lucide-react";
import { UserMenu } from "./UserMenu";
import { NotificationsBell } from "./NotificationsBell";
import { CommandPalette } from "./CommandPalette";
import { Logo } from "~/components/ui/Logo";
import { useAuth } from "~/hooks/useAuth";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { selectRoles } from "~/store/slices/authSlice";
import { setSidebar, toggleSidebar, toggleSidebarCollapsed, setSidebarCollapsed } from "~/store/slices/uiSlice";
import { useGetAgendaQuery } from "~/store/api/contactsApi";
import { useGetSalesPaginatedQuery } from "~/store/api/salesApi";
import { isDue } from "~/components/admin/crm/crmMeta";
import { cn } from "~/lib/utils";
import type { Role } from "~/lib/constants";

const COLLAPSE_KEY = "adminSidebarCollapsed";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Secciones por dominio: qué opero a diario, qué ve el cliente, y análisis/sistema.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operación",
    items: [
      { to: "/admin/inventario", label: "Inventario", icon: Package, roles: ["admin"] },
      { to: "/admin/ventas", label: "Ventas", icon: ShoppingCart, roles: ["admin", "seller"] },
      { to: "/admin/crm", label: "Seguimientos", icon: KanbanSquare, roles: ["admin", "seller"] },
      { to: "/admin/cuotas", label: "Cuotas", icon: CreditCard, roles: ["admin"] },
    ],
  },
  {
    label: "Tienda",
    items: [
      { to: "/admin/catalogo", label: "Gestión de Catálogo", icon: LayoutGrid, roles: ["admin"] },
      { to: "/admin/pedidos", label: "Pedidos WhatsApp", icon: MessageCircle, roles: ["admin"] },
      { to: "/admin/facturacion", label: "Facturación", icon: Receipt, roles: ["admin", "cashier"] },
    ],
  },
  {
    label: "Análisis y sistema",
    items: [
      { to: "/admin/reportes", label: "Reportes", icon: BarChart3, roles: ["admin"] },
      {
        to: "/admin/logistica",
        label: "Gyro Logistics",
        icon: Truck,
        roles: ["admin", "logistics_admin", "logistics_customer"],
      },
      { to: "/admin/usuarios", label: "Usuarios", icon: Users, roles: ["admin"] },
      { to: "/admin/configuracion", label: "Configuración", icon: Settings, roles: ["admin"] },
    ],
  },
];

function roleLabel(roles: Role[]): string {
  if (roles.includes("global_admin") || roles.includes("admin")) return "Admin";
  if (roles.includes("seller")) return "Vendedor";
  if (roles.includes("cashier")) return "Cajero";
  if (roles.includes("logistics_admin")) return "Logística";
  if (roles.includes("logistics_customer")) return "Cliente Logistics";
  return "Usuario";
}

// Conteos de pendientes para los badges del nav (mismas fuentes que la campana).
function useNavBadges(roles: Role[]): Record<string, number> {
  const isAdmin = roles.includes("global_admin") || roles.includes("admin");
  const canCRM = isAdmin || roles.includes("seller");
  const { data: agenda = [] } = useGetAgendaQuery(undefined, { skip: !canCRM });
  const { data: pending } = useGetSalesPaginatedQuery(
    { page: 1, limit: 50, status: "pending_approval", sellerEmail: "all", date: "all" },
    { skip: !isAdmin, pollingInterval: 15000 },
  );
  return {
    "/admin/ventas": isAdmin ? pending?.total ?? 0 : 0,
    "/admin/crm": agenda.filter(isDue).length,
  };
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const roles = useAppSelector(selectRoles);
  const { user } = useAuth();
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);
  const sidebarCollapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const dispatch = useAppDispatch();
  const location = useLocation();
  const badges = useNavBadges(roles);

  // Recuerda la preferencia de escritorio (oculto/visible) entre sesiones.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(COLLAPSE_KEY) === "1") dispatch(setSidebarCollapsed(true));
  }, [dispatch]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(COLLAPSE_KEY, sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  const canSee = (item: NavItem) =>
    roles.includes("global_admin") || item.roles.some((r) => roles.includes(r));
  const visibleGroups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(canSee) })).filter(
    (g) => g.items.length > 0,
  );
  const visible = visibleGroups.flatMap((g) => g.items);
  const current = visible.find((item) => location.pathname.startsWith(item.to));

  // La campana de seguimientos solo aplica a quienes usan el CRM (admin/seller).
  const canCRM = roles.includes("global_admin") || roles.includes("admin") || roles.includes("seller");

  return (
    <div className="flex min-h-screen">
      {/* Overlay para cerrar el sidebar en móvil al tocar fuera */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => dispatch(setSidebar(false))}
        />
      )}

      {/* Sidebar — ancho fijo (shrink-0 evita que el contenido ancho lo encoja).
          En escritorio se oculta con md:hidden cuando está colapsado. */}
      <aside
        className={cn(
          // Glass SOLO en escritorio: en móvil el sidebar es un drawer sobre un overlay
          // oscuro, así que va sólido (backdrop-blur persistente cuesta repaint en gama baja).
          // El glass (blur + translucidez) se activa en md+ para dejar filtrar el ambiente.
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border bg-surface bg-gradient-to-b from-accent/[0.05] to-transparent p-4 transition-transform md:bg-surface/70 md:backdrop-blur-xl",
          // En escritorio: sticky a la altura del viewport para que siga al usuario al hacer scroll.
          "md:sticky md:top-0 md:bottom-auto md:h-screen md:translate-x-0 md:self-start",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed && "md:hidden",
        )}
      >
        <div className="mb-3 flex items-center justify-between">
          <Link
            to="/"
            target="_blank"
            rel="noopener"
            onClick={() => dispatch(setSidebar(false))}
            className="rounded-xl outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent"
            title="Ir al catálogo"
          >
            <Logo size={44} withText textClassName="text-lg" />
          </Link>
          <button
            className="-mr-2 grid h-11 w-11 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:hidden"
            onClick={() => dispatch(setSidebar(false))}
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            className="-mr-2 hidden h-11 w-11 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:grid"
            onClick={() => dispatch(toggleSidebarCollapsed())}
            title="Ocultar menú"
            aria-label="Ocultar menú"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>

        <motion.nav 
          initial="hidden"
          animate="show"
          variants={{
            show: { transition: { staggerChildren: 0.04 } }
          }}
          className="-mx-1 flex-1 space-y-4 overflow-y-auto px-1 pb-2"
        >
          {visibleGroups.map((group) => (
            <div key={group.label}>
              {/* La etiqueta de sección solo aporta si hay más de un grupo visible. */}
              {visibleGroups.length > 1 && (
                <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-muted/80">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon }) => {
                  const badge = badges[to] ?? 0;
                  return (
                    <motion.div
                      key={to}
                      variants={{
                        hidden: { opacity: 0, x: -10 },
                        show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                      }}
                    >
                      <NavLink
                        to={to}
                        viewTransition
                        onClick={() => dispatch(setSidebar(false))}
                        className={({ isActive }) =>
                          cn(
                            "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-300 ease-out active:scale-[0.97]",
                            isActive ? "font-medium text-accent-2" : "text-muted hover:bg-surface-2 hover:text-text",
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <motion.span
                                layoutId="admin-nav-active"
                                className="absolute inset-0 rounded-lg bg-accent/10"
                                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                              >
                                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent text-accent shadow-[0_0_8px_currentColor]" />
                              </motion.span>
                            )}
                            <Icon 
                              className={cn(
                                "relative z-10 h-[18px] w-[18px] transition-all duration-300", 
                                isActive ? "text-accent-2" : "group-hover:scale-110 group-hover:-rotate-3 group-hover:text-text"
                              )} 
                            />
                            <span className="relative z-10 flex-1 truncate transition-transform duration-300 group-hover:translate-x-0.5">
                              {label}
                            </span>
                            {badge > 0 && (
                              <span className="relative z-10 rounded-pill bg-warning/15 px-1.5 text-[11px] font-semibold leading-4 text-warning transition-transform duration-300 group-hover:scale-105">
                                {badge}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </motion.nav>

        {/* Identidad: quién soy y con qué rol estoy operando. */}
        {user && (
          <div className="mt-auto flex items-center gap-2.5 border-t border-border pt-3">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-accent text-xs font-semibold text-white">
                {user.name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-text">{user.name}</p>
              <p className="truncate text-[11px] text-muted">{roleLabel(roles)}</p>
            </div>
          </div>
        )}
      </aside>

      {/* Contenido — min-w-0 deja que las tablas anchas se encojan/scrolleen
          en vez de empujar el layout y deformar el sidebar. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header sticky: sólido en móvil (blur persistente sobre contenido en scroll
            es el efecto más caro), glass en escritorio. */}
        <header className="sticky top-0 z-[60] flex h-16 items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 md:bg-surface/60 md:backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2">
            <button
              className="-ml-2 grid h-11 w-11 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:hidden"
              onClick={() => dispatch(toggleSidebar())}
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Mostrar el menú en escritorio cuando está colapsado */}
            {sidebarCollapsed && (
              <button
                className="hidden items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text md:inline-flex"
                onClick={() => dispatch(toggleSidebarCollapsed())}
                title="Mostrar menú"
                aria-label="Mostrar menú"
              >
                <PanelLeft className="h-4 w-4" />
                <span>Menú</span>
              </button>
            )}
            {/* Breadcrumb del portal activo */}
            {current && (
              <div className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
                <span className="text-muted">Admin</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                <span className="flex min-w-0 items-center gap-1.5 font-medium text-text">
                  <current.icon className="h-4 w-4 shrink-0 text-accent-2" />
                  <span className="truncate">{current.label}</span>
                </span>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {canCRM && <NotificationsBell />}
            <UserMenu />
          </div>
        </header>

        {/* key por ruta = cada portal entra con fade+slide (sin exit: con Remix
            el Outlet ya trae el contenido nuevo y animar la salida lo duplica). */}
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex-1 p-4 md:p-6"
        >
          {children}
        </motion.main>
      </div>

      {/* Paleta de comandos ⌘K (salto rápido entre portales) */}
      <CommandPalette items={visible.map(({ to, label, icon }) => ({ to, label, icon }))} />
    </div>
  );
}

