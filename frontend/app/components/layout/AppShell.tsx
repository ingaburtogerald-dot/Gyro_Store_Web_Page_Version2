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
  ChevronsLeft,
  ChevronsRight,
  Plus,
  ChevronDown,
  ChevronRight,
  KanbanSquare,
  ArrowUpRight,
  Shield,
} from "lucide-react";
import { UserMenu } from "./UserMenu";
import { NotificationsBell } from "./NotificationsBell";
import { CommandPalette } from "./CommandPalette";
import { CartButton } from "./PublicHeader";
import { CartDrawer } from "~/components/cart/CartDrawer";
import { SearchBar } from "~/components/filters/SearchBar";
import { useAuth } from "~/hooks/useAuth";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { selectRoles } from "~/store/slices/authSlice";
import { setSidebar, toggleSidebar, toggleSidebarCollapsed, setSidebarCollapsed, setSearch } from "~/store/slices/uiSlice";
import { hydrate } from "~/store/slices/cartSlice";
import { useGetAgendaQuery } from "~/store/api/contactsApi";
import { useGetSalesPaginatedQuery, useGetPublicOrdersQuery } from "~/store/api/salesApi";
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
    label: "Tienda",
    items: [
      { to: "/", label: "Catálogo", icon: Store, roles: ["public", "admin", "seller", "cashier", "logistics_admin", "logistics_customer"] },
      { to: "/admin/catalogo", label: "Gestión de Catálogo", icon: LayoutGrid, roles: ["admin"] },
      { to: "/admin/pedidos", label: "Pedidos WhatsApp", icon: MessageCircle, roles: ["admin"] },
      { to: "/admin/facturacion", label: "Facturación", icon: Receipt, roles: ["admin", "cashier"] },
    ],
  },
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
  const { data: publicOrders = [] } = useGetPublicOrdersQuery(undefined, { skip: !isAdmin, pollingInterval: 30000 });
  
  return {
    "/admin/ventas": isAdmin ? pending?.total ?? 0 : 0,
    "/admin/crm": agenda.filter(isDue).length,
    "/admin/pedidos": isAdmin ? publicOrders.filter(o => !o.contacted && !o.archived).length : 0,
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const authRoles = useAppSelector(selectRoles);
  const roles = authRoles.length > 0 ? authRoles : ["public"];
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

  // Hidratar carrito
  useEffect(() => {
    dispatch(hydrate());
  }, [dispatch]);

  const search = useAppSelector((s) => s.ui.search);
  const showSearch = location.pathname === "/";
  // El rail de portales es el chrome del Centro de Administración: SOLO debe
  // aparecer en /admin/*. En las páginas públicas (catálogo, ficha, combo,
  // contacto) el shell se comporta como tienda, sin el menú interno — así el
  // storefront no hereda la navegación de admin cuando hay sesión iniciada.
  const isAdminRoute = location.pathname.startsWith("/admin");
  const showSidebar = !!user && isAdminRoute;

  const canSee = (item: NavItem) =>
    roles.includes("global_admin") || item.roles.includes("public") || item.roles.some((r) => roles.includes(r as Role));
  const visibleGroups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(canSee) })).filter(
    (g) => g.items.length > 0,
  );
  const visible = visibleGroups.flatMap((g) => g.items);
  // Match exact para "/" o startswith para otras rutas
  const current = visible.find((item) => item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to));

  // Entrada al Centro de Administración desde el header de una página pública:
  // como el rail se oculta fuera de /admin/*, un usuario con sesión necesita un
  // acceso visible al panel. Apuntamos al primer portal de admin que su rol permite.
  const adminEntry = user && !isAdminRoute ? visible.find((item) => item.to.startsWith("/admin")) : undefined;

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
          En escritorio, cuando está colapsado se reduce a 80px (modo solo-iconos)
          en vez de ocultarse. En móvil siempre es un drawer de ancho completo. */}
      {showSidebar && (
        <aside
          className={cn(
          // Glass SOLO en escritorio: en móvil el sidebar es un drawer sobre un overlay
          // oscuro, así que va sólido (backdrop-blur persistente cuesta repaint en gama baja).
          // El glass (blur + translucidez) se activa en md+ para dejar filtrar el ambiente.
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border bg-surface bg-gradient-to-b from-accent/[0.05] to-transparent p-4 transition-[transform,width] duration-300 md:bg-surface/70 md:backdrop-blur-xl",
          // En escritorio: sticky a la altura del viewport para que siga al usuario al hacer scroll.
          "md:sticky md:top-0 md:bottom-auto md:h-screen md:translate-x-0 md:self-start",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          // Colapsado (solo escritorio): ancho reducido → modo solo-iconos.
          sidebarCollapsed && "md:w-20",
        )}
      >
        <div className="mb-3">
          {/* Controles: cerrar drawer (móvil) / colapsar-expandir (escritorio).
              Al colapsar, el control se centra en el ancho reducido. */}
          <div className={cn("mb-2 flex items-center", sidebarCollapsed ? "md:justify-center" : "justify-end")}>
            <button
              className="grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:hidden"
              onClick={() => dispatch(setSidebar(false))}
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              className="group/toggle hidden h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:grid"
              onClick={() => dispatch(toggleSidebarCollapsed())}
              title={sidebarCollapsed ? "Expandir menú" : "Ocultar menú"}
              aria-label={sidebarCollapsed ? "Expandir menú" : "Ocultar menú"}
            >
              {sidebarCollapsed ? (
                <ChevronsRight className="h-5 w-5 transition-transform duration-300 group-hover/toggle:translate-x-0.5" />
              ) : (
                <ChevronsLeft className="h-5 w-5 transition-transform duration-300 group-hover/toggle:-translate-x-0.5" />
              )}
            </button>
          </div>

          {/* Marca: logo + nombre. La image se achica al colapsar; el texto se oculta. */}
          <div className="flex flex-col items-center">
            <img
              src="/logo_gyro.png"
              alt="Gyro Store"
              className={cn(
                // Emblema circular: rounded-full recorta el fondo cuadrado y luce como badge.
                // El tamaño solo crece en vertical dentro del sidebar (el ancho w-64 no cambia).
                "rounded-full object-cover shadow-lg ring-1 ring-white/10 transition-all duration-300",
                sidebarCollapsed ? "h-24 w-24 md:h-11 md:w-11" : "h-24 w-24",
              )}
            />
            <span
              className={cn(
                "mt-1.5 text-lg font-bold tracking-tight text-text",
                sidebarCollapsed && "md:hidden",
              )}
            >
              Gyro Store
            </span>
          </div>
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
              {/* La etiqueta de sección solo aporta si hay más de un grupo visible.
                  Se oculta en escritorio cuando el menú está colapsado (solo-iconos). */}
              {visibleGroups.length > 1 && (
                <p
                  className={cn(
                    "mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-muted/80",
                    sidebarCollapsed && "md:hidden",
                  )}
                >
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
                        title={sidebarCollapsed ? label : undefined}
                        className={({ isActive }) =>
                          cn(
                            "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-300 ease-out hover:translate-x-0.5 active:scale-[0.97] motion-reduce:hover:translate-x-0",
                            (isActive && to !== "/") ? "font-medium text-accent-2" : "text-muted hover:text-text",
                            // Colapsado (escritorio): icono centrado, sin padding lateral ni desliz.
                            sidebarCollapsed && "md:justify-center md:gap-0 md:px-0 md:hover:translate-x-0",
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {/* Fondo del ítem activo (compartido entre rutas con layoutId). */}
                            {(isActive && to !== "/") && (
                              <motion.span
                                layoutId="admin-nav-active"
                                className="absolute inset-0 rounded-lg bg-accent/10"
                                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                              >
                                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent text-accent shadow-[0_0_8px_currentColor]" />
                              </motion.span>
                            )}
                            {/* Tinte de acento que aparece al hover (solo en inactivos). */}
                            {!(isActive && to !== "/") && (
                              <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-accent/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none" />
                            )}
                            <span className="relative z-10 shrink-0">
                              <Icon
                                className={cn(
                                  "h-[18px] w-[18px] transition-all duration-300",
                                  (isActive && to !== "/")
                                    ? "text-accent-2"
                                    : "group-hover:scale-110 group-hover:-rotate-6 group-hover:text-accent-2",
                                )}
                              />
                              {/* Colapsado: un punto reemplaza al contador para no perder la señal de pendientes. */}
                              {badge > 0 && sidebarCollapsed && (
                                <span className="absolute -right-1 -top-1 hidden h-2 w-2 rounded-full bg-warning ring-2 ring-surface md:block" />
                              )}
                            </span>
                            <span
                              className={cn(
                                "relative z-10 flex-1 truncate",
                                sidebarCollapsed && "md:hidden",
                              )}
                            >
                              {label}
                            </span>
                            {badge > 0 && (
                              <span
                                className={cn(
                                  "relative z-10 rounded-pill bg-warning/15 px-1.5 text-[11px] font-semibold leading-4 text-warning transition-transform duration-300 group-hover:scale-110",
                                  sidebarCollapsed && "md:hidden",
                                )}
                              >
                                {badge}
                              </span>
                            )}
                            {/* Afordancia: chevron que entra deslizándose al hover
                                (expandido y sin badge, para no encimar el contador). */}
                            {badge === 0 && !(isActive && to !== "/") && (
                              <ChevronRight
                                className={cn(
                                  "relative z-10 h-4 w-4 shrink-0 -translate-x-1 text-accent-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:hidden",
                                  sidebarCollapsed && "md:hidden",
                                )}
                              />
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

        {/* Identidad: quién soy y con qué rol estoy operando.
            Colapsado (escritorio): solo el avatar, centrado. */}
        {user && (
          <div
            className={cn(
              "mt-auto flex items-center gap-2.5 border-t border-border pt-3",
              sidebarCollapsed && "md:justify-center md:gap-0",
            )}
            title={sidebarCollapsed ? `${user.name} · ${roleLabel(roles)}` : undefined}
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-accent text-xs font-semibold text-bg">
                {user.name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div className={cn("min-w-0", sidebarCollapsed && "md:hidden")}>
              <p className="truncate text-xs font-medium text-text">{user.name}</p>
              <p className="truncate text-[11px] text-muted">{roleLabel(roles)}</p>
            </div>
          </div>
        )}
      </aside>
      )}
      
      {/* Sidebar Mobile (Overlay) */}
      <AnimatePresence>
        {sidebarOpen && showSidebar && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-surface shadow-2xl md:hidden"
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <img src="/logo_gyro.png" alt="Gyro Store" className="h-8 w-8 rounded-full shadow-sm ring-1 ring-white/10" />
                <span className="text-lg font-bold tracking-tight text-text">Gyro Store</span>
              </div>
              <button
                className="grid h-10 w-10 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                onClick={() => dispatch(setSidebar(false))}
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-6 overflow-y-auto p-4">
              {visibleGroups.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted/80">{group.label}</p>
                  <div className="space-y-1">
                    {group.items.map(({ to, label, icon: Icon }) => {
                      const badge = badges[to] ?? 0;
                      return (
                        <NavLink
                          key={to}
                          to={to}
                          onClick={() => dispatch(setSidebar(false))}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition-colors active:scale-95",
                              (isActive && to !== "/") ? "bg-accent/15 text-accent-2" : "text-muted hover:bg-surface-2 hover:text-text",
                            )
                          }
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="flex-1 truncate">{label}</span>
                          {badge > 0 && (
                            <span className="rounded-pill bg-warning px-2 py-0.5 text-[11px] font-bold text-bg">
                              {badge}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {user && (
              <div className="border-t border-border p-4">
                <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-border" />
                  ) : (
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-accent text-sm font-semibold text-bg shadow-inner">
                      {user.name?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-text">{user.name}</p>
                    <p className="truncate text-xs font-medium text-muted">{roleLabel(roles)}</p>
                  </div>
                </div>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      <div
        className="flex flex-1 min-w-0 min-h-dvh flex-col transition-all duration-300"
      >
        <header className="sticky top-0 z-[60] flex h-16 items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 md:bg-surface/60 md:backdrop-blur-xl">
          {/* Lado izquierdo (Menú / Logo / Breadcrumbs). Sin ancho fijo: usa flex
              para alinearse con el sidebar expandido (256px) o colapsado (80px)
              sin descuadrar el buscador. */}
          <div className="flex min-w-0 shrink items-center gap-2">
            {showSidebar ? (
              <button
                className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text md:hidden"
                onClick={() => dispatch(toggleSidebar())}
              >
                <Menu className="h-5 w-5" />
              </button>
            ) : (
              <Link to="/" className="flex items-center gap-2 mr-2 md:mr-6 shrink-0 transition-transform active:scale-95">
                <img src="/logo_gyro.png" alt="Gyro Store" className="h-8 w-8 shadow-sm ring-1 ring-white/10" />
                <span className="hidden text-lg font-bold tracking-tight text-text sm:block">Gyro Store</span>
              </Link>
            )}
            
            {!showSearch && current ? (
              <div className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
                <span className="text-muted">App</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                <span className="flex min-w-0 items-center gap-1.5 font-medium text-text">
                  <current.icon className="h-4 w-4 shrink-0 text-accent-2" />
                  <span className="truncate">{current.label}</span>
                </span>
              </div>
            ) : null}
          </div>

          {/* Centro (Buscador principal) */}
          {showSearch && (
            <div className="hidden flex-1 justify-center px-4 md:flex max-w-2xl">
              <SearchBar
                value={search}
                onChange={(v) => dispatch(setSearch(v))}
                onClear={() => dispatch(setSearch(""))}
                size="sm"
              />
            </div>
          )}

          {/* Lado derecho (Carrito, Usuario) */}
          <div className="flex shrink-0 items-center gap-2 justify-end">
            <CartButton />
            {canCRM && <NotificationsBell />}
            {adminEntry && (
              <Link
                to={adminEntry.to}
                className="hidden items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-medium text-text transition-colors hover:border-accent/40 hover:text-accent-2 sm:inline-flex"
                title="Ir al Centro de Administración"
              >
                <Shield className="h-4 w-4 text-accent-2" />
                Panel
              </Link>
            )}
            {user ? (
              <UserMenu />
            ) : (
              <Link to="/login" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-2 transition-colors">
                Iniciar Sesión
              </Link>
            )}
          </div>
        </header>
        
        {/* Búsqueda móvil en catálogo */}
        {showSearch && (
          <div className="px-4 pt-3 pb-1 md:hidden bg-surface/95">
            <SearchBar
              value={search}
              onChange={(v) => dispatch(setSearch(v))}
              onClear={() => dispatch(setSearch(""))}
              size="sm"
            />
          </div>
        )}

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
      
      {/* Drawer del carrito global */}
      <CartDrawer />
    </div>
  );
}

