// Shell del Centro de Administración: sidebar de portales + header con usuario.
// Cada item se muestra según los roles del usuario.
import { useEffect } from "react";
import { NavLink, Link } from "@remix-run/react";
import { motion } from "framer-motion";
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
  ClipboardList,
  PanelLeftClose,
  PanelLeft,
  Search,
} from "lucide-react";
import { UserMenu } from "./UserMenu";
import { NotificationsBell } from "./NotificationsBell";
import { CommandPalette } from "./CommandPalette";
import { Logo } from "~/components/ui/Logo";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { selectRoles } from "~/store/slices/authSlice";
import { setSidebar, toggleSidebar, toggleSidebarCollapsed, setSidebarCollapsed } from "~/store/slices/uiSlice";
import { cn } from "~/lib/utils";
import type { Role } from "~/lib/constants";

const COLLAPSE_KEY = "adminSidebarCollapsed";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
}

const NAV: NavItem[] = [
  { to: "/admin/inventario", label: "Inventario", icon: Package, roles: ["admin"] },
  { to: "/admin/ventas", label: "Ventas", icon: ShoppingCart, roles: ["admin", "seller"] },
  { to: "/admin/seguimientos", label: "Seguimientos", icon: ClipboardList, roles: ["admin", "seller"] },
  { to: "/admin/cuotas", label: "Cuotas", icon: CreditCard, roles: ["admin"] },
  { to: "/admin/catalogo", label: "Gestión de Catálogo", icon: LayoutGrid, roles: ["admin"] },
  { to: "/admin/pedidos", label: "Pedidos WhatsApp", icon: MessageCircle, roles: ["admin"] },
  { to: "/admin/facturacion", label: "Facturación", icon: Receipt, roles: ["admin", "cashier"] },
  { to: "/admin/reportes", label: "Reportes", icon: BarChart3, roles: ["admin"] },
  {
    to: "/admin/logistica",
    label: "Gyro Logistics",
    icon: Truck,
    roles: ["admin", "logistics_admin", "logistics_customer"],
  },
  { to: "/admin/usuarios", label: "Usuarios", icon: Users, roles: ["admin"] },
  { to: "/admin/configuracion", label: "Configuración", icon: Settings, roles: ["admin"] },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const roles = useAppSelector(selectRoles);
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);
  const sidebarCollapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const dispatch = useAppDispatch();

  // Recuerda la preferencia de escritorio (oculto/visible) entre sesiones.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(COLLAPSE_KEY) === "1") dispatch(setSidebarCollapsed(true));
  }, [dispatch]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(COLLAPSE_KEY, sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  const visible = NAV.filter(
    (item) => roles.includes("global_admin") || item.roles.some((r) => roles.includes(r)),
  );

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
          "fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto border-r border-border bg-surface p-4 transition-transform",
          // En escritorio: sticky a la altura del viewport para que siga al usuario al hacer scroll.
          "md:sticky md:top-0 md:bottom-auto md:h-screen md:translate-x-0 md:self-start",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed && "md:hidden",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <Logo size={52} withText textClassName="text-xl" />
          <button className="md:hidden" onClick={() => dispatch(setSidebar(false))} aria-label="Cerrar menú">
            <X className="h-5 w-5 text-muted" />
          </button>
          <button
            className="hidden text-muted transition-colors hover:text-text md:inline-flex"
            onClick={() => dispatch(toggleSidebarCollapsed())}
            title="Ocultar menú"
            aria-label="Ocultar menú"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>

        {/* Separador con fade de acento — ancla visualmente el logo al nav */}
        <div className="divider-fade mb-4" />

        <nav className="space-y-1">
          {visible.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              viewTransition
              onClick={() => dispatch(setSidebar(false))}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  isActive ? "text-white" : "text-muted hover:bg-surface-2 hover:text-text",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="admin-nav-active"
                      className="absolute inset-0 rounded-xl bg-gradient-accent"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon className="relative z-10 h-[18px] w-[18px]" />
                  <span className="relative z-10">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Contenido — min-w-0 deja que las tablas anchas se encojan/scrolleen
          en vez de empujar el layout y deformar el sidebar. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-bg/80 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <button className="md:hidden" onClick={() => dispatch(toggleSidebar())} aria-label="Abrir menú">
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
          </div>
          <div className="ml-auto flex items-center gap-3">

            {canCRM && <NotificationsBell />}
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-pill border border-accent bg-accent/10 px-4 py-2 text-base font-medium text-accent transition-colors hover:bg-accent hover:text-white"
              title="Ver catálogo"
            >
              <Store className="h-5 w-5 transition-colors" />
              <span className="hidden sm:inline">Ver catálogo</span>
            </Link>
            <UserMenu />
          </div>
        </header>

        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
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
