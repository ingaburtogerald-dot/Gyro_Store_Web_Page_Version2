// Shell unificado de Gyro Store. UN SOLO rail persistente a la izquierda sirve
// tanto al storefront público como al Centro de Administración: al iniciar sesión
// NO se salta a "otro sitio", solo aparece la sección "Mi negocio" dentro del mismo
// rail. Colapsado (~76px, solo iconos) por defecto; el botón "Todo" lo expande in
// situ a panel completo. Los controles fijos (carrito, tema, cuenta) viven SIEMPRE
// en el rail — el header queda libre (solo buscador). En móvil el rail se convierte
// en una barra inferior al alcance del pulgar + un drawer para el panel expandido.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Link, useLocation, useNavigate } from "@remix-run/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ShoppingBag,
  BarChart3,
  Truck,
  Users,
  X,
  MessageCircle,
  CreditCard,
  Settings,
  Store,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  KanbanSquare,
  Home,
  LogIn,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  Boxes,
  ReceiptText,
  ClipboardList,
  Search,
  Lightbulb,
  Ticket,
} from "lucide-react";
import { Logo } from "~/components/ui/Logo";
import { UserMenu } from "./UserMenu";
import { NotificationsBell } from "./NotificationsBell";
import { CommandPalette } from "./CommandPalette";
import { CartButton } from "./PublicHeader";
import { CartDrawer } from "~/components/cart/CartDrawer";
import { SearchBar } from "~/components/filters/SearchBar";
import { useAuth } from "~/hooks/useAuth";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { selectRoles } from "~/store/slices/authSlice";
import {
  setSearch,
  setCategory,
  resetFilters,
  openPublicSidebar,
  closePublicSidebar,
} from "~/store/slices/uiSlice";
import { hydrate } from "~/store/slices/cartSlice";
import { useGetAgendaQuery } from "~/store/api/contactsApi";
import { useGetSalesPaginatedQuery, useGetPublicOrdersQuery } from "~/store/api/salesApi";
import { useGetCatalogQuery, useGetConfigQuery } from "~/store/api/catalogApi";
import type { Category } from "~/types/catalog";
import { buildCategoryTree } from "~/lib/categories";
import { isDue } from "~/components/admin/crm/crmMeta";
import { cn } from "~/lib/utils";
import type { Role } from "~/lib/constants";

// ease-out exponencial del sistema (DESIGN.md §5): un único lenguaje de motion.
const EASE = [0.16, 1, 0.3, 1] as const;

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

// Portales de "Mi negocio" (solo aparecen con sesión y según rol). El catálogo
// público ya no vive aquí: es la propia tienda a la que apunta el logo/categorías.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Tienda",
    items: [
      { to: "/admin/catalogo", label: "Gestión de Catálogo", icon: Boxes, roles: ["admin"] },
      { to: "/admin/codigos-descuento", label: "Códigos de descuento", icon: Ticket, roles: ["admin"] },
      { to: "/admin/facturacion", label: "Facturación", icon: ReceiptText, roles: ["admin", "cashier"] },
    ],
  },
  {
    label: "Operación",
    items: [
      { to: "/admin/inventario", label: "Inventario", icon: ClipboardList, roles: ["admin"] },
      { to: "/admin/ventas", label: "Ventas", icon: ShoppingBag, roles: ["admin", "seller"] },
      { to: "/admin/crm", label: "CRM & Pedidos", icon: KanbanSquare, roles: ["admin", "seller"] },
      { to: "/admin/cuotas", label: "Cuotas", icon: CreditCard, roles: ["admin"] },
    ],
  },
  {
    label: "Análisis y sistema",
    items: [
      { to: "/admin/reportes", label: "Reportes", icon: BarChart3, roles: ["admin"] },
      { to: "/admin/busquedas", label: "Búsquedas", icon: Search, roles: ["admin"] },
      { to: "/admin/feedback", label: "Feedback", icon: Lightbulb, roles: ["admin"] },
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

  const crmCount = agenda.filter(isDue).length;
  const whatsappCount = isAdmin ? publicOrders.filter((o) => !o.contacted && !o.archived).length : 0;

  return {
    "/admin/ventas": isAdmin ? pending?.total ?? 0 : 0,
    "/admin/crm": crmCount + whatsappCount,
  };
}

export function AppShell({ children }: { children: ReactNode }) {
  // Sin sesión, roles = [] → canSee/businessGroups quedan vacíos (no hay portales
  // de admin), que es justo el comportamiento del storefront público.
  const roles = useAppSelector(selectRoles);
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const badges = useNavBadges(roles);

  // Estado ÚNICO del panel expandido (mismo flag que usa el chip "Todo" del
  // catálogo). Colapsado por defecto tanto logueado como no logueado.
  const expanded = useAppSelector((s) => s.ui.publicSidebarOpen);
  const [isHovered, setIsHovered] = useState(false);
  const isSidebarVisible = expanded || isHovered;

  // Intención de hover: pequeño retardo al abrir (evita expandir por un roce) y otro
  // mayor al cerrar (evita el parpadeo si el mouse sale un instante o cruza un hueco).
  const hoverTimers = useRef<{ open?: number; close?: number }>({});
  function handleRailEnter() {
    window.clearTimeout(hoverTimers.current.close);
    hoverTimers.current.open = window.setTimeout(() => setIsHovered(true), 120);
  }
  function handleRailLeave() {
    window.clearTimeout(hoverTimers.current.open);
    hoverTimers.current.close = window.setTimeout(() => setIsHovered(false), 260);
  }
  useEffect(() => () => {
    window.clearTimeout(hoverTimers.current.open);
    window.clearTimeout(hoverTimers.current.close);
  }, []);

  const search = useAppSelector((s) => s.ui.search);
  const showSearch = location.pathname === "/";

  // Hidratar carrito una vez.
  useEffect(() => {
    dispatch(hydrate());
  }, [dispatch]);

  // Cierra el panel al cambiar de ruta (evita que quede abierto tras navegar).
  useEffect(() => {
    dispatch(closePublicSidebar());
  }, [location.pathname, dispatch]);

  // Categorías globales (para el rail). El endpoint es público y cacheado por RTK.
  const { data: products = [] } = useGetCatalogQuery();
  const { data: config } = useGetConfigQuery();
  const categories = buildCategoryTree(products, config?.categories || []);

  // Portales visibles según rol (sin el catálogo público, que es la propia tienda).
  const canSee = (item: NavItem) =>
    roles.includes("global_admin") || item.roles.some((r) => roles.includes(r as Role));
  const businessGroups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(canSee) })).filter(
    (g) => g.items.length > 0,
  );
  const businessItems = businessGroups.flatMap((g) => g.items);
  const canCRM = roles.includes("global_admin") || roles.includes("admin") || roles.includes("seller");

  function openPanel() {
    dispatch(openPublicSidebar());
  }
  function closePanel() {
    dispatch(closePublicSidebar());
  }
  function goCategory(id: string | null) {
    dispatch(setCategory(id));
    closePanel();
    navigate("/");
  }
  function handleGoHome() {
    dispatch(resetFilters());
    dispatch(setCategory(null));
    closePanel();
  }

  return (
    <div className="flex min-h-screen">
      {/* Backdrop del panel expandido: cierra al hacer clic fuera. En móvil oscurece
          el fondo; en escritorio es apenas un velo para enfocar el rail. */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="rail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            onClick={closePanel}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:bg-black/30"
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* ── RAIL DE ESCRITORIO (md+) ──
          UN SOLO árbol de contenido (RailPanelContent): al pasar el hover, el ancho
          se desliza y las ETIQUETAS/encabezados se revelan con fade — los iconos
          quedan fijos a la izquierda (px-3), así que NO saltan. */}
      <aside
        onMouseEnter={handleRailEnter}
        onMouseLeave={handleRailLeave}
        className={cn(
          "fixed inset-y-0 left-0 z-50 hidden flex-col overflow-hidden border-r border-border bg-black transition-[width] duration-300 ease-out md:flex",
          isSidebarVisible ? "w-58 shadow-premium" : "w-[76px]",
        )}
        style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
      >
        {/* Header: título que se revela + botón fijar/colapsar (siempre visible). */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
          <span
            className={cn(
              "min-w-0 flex-1 truncate pl-1 text-sm font-extrabold tracking-tight text-white transition-opacity duration-200",
              isSidebarVisible ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            {user ? "Administración" : <Logo size={30} />}
          </span>
          <button
            onClick={expanded ? closePanel : openPanel}
            aria-label={expanded ? "Colapsar menú" : "Fijar menú"}
            className="group grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border/80 bg-transparent text-muted transition-all duration-300 hover:border-accent-2 hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {expanded ? (
              <PanelLeftClose className="h-4.5 w-4.5 transition-transform duration-300 group-hover:-translate-x-0.5" />
            ) : (
              <PanelLeftOpen className="h-4.5 w-4.5 transition-transform duration-300 group-hover:translate-x-0.5" />
            )}
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          <RailPanelContent
            categories={categories}
            businessGroups={businessGroups}
            badges={badges}
            authed={Boolean(user)}
            reduce={Boolean(reduce)}
            collapsed={!isSidebarVisible}
            hideLogo
            onGoCategory={goCategory}
            onGoHome={handleGoHome}
            onNavigate={closePanel}
          />
        </div>

        {/* Controles fijos SIEMPRE presentes */}
        <RailControls expanded={isSidebarVisible} canCRM={canCRM} user={user} roles={roles} />
      </aside>

      {/* ── DRAWER MÓVIL (panel expandido) ── */}
      <AnimatePresence>
        {expanded && (
          <motion.aside
            key="rail-drawer"
            initial={reduce ? { opacity: 0 } : { x: "-100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "-100%" }}
            transition={reduce ? { duration: 0.2 } : { duration: 0.45, ease: EASE }}
            className="fixed inset-y-0 left-0 z-50 flex w-full max-w-[360px] flex-col bg-black shadow-premium md:hidden"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
              {user ? (
                <span className="truncate text-sm font-extrabold tracking-tight text-white">
                  Administracion
                </span>
              ) : (
                <Link to="/" onClick={closePanel} className="transition-transform active:scale-95">
                  <Logo size={30} />
                </Link>
              )}
              <button
                onClick={closePanel}
                aria-label="Cerrar menú"
                className="group grid h-10 w-10 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <X className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
              </button>
            </div>
            <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4">
              <RailPanelContent
                categories={categories}
                businessGroups={businessGroups}
                badges={badges}
                authed={Boolean(user)}
                reduce={Boolean(reduce)}
                onGoCategory={goCategory}
                onGoHome={handleGoHome}
                onNavigate={closePanel}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── CONTENIDO ── */}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col pb-16 md:pb-0 md:pl-[76px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-black/80 px-4 backdrop-blur-xl md:px-6">
          {/* En escritorio el rail ya muestra el logo: aquí solo en móvil (evita duplicado). */}
          <Link to="/" className="flex shrink-0 items-center transition-transform active:scale-95 md:hidden">
            <Logo size={30} withText textClassName="text-lg" />
          </Link>

          {showSearch ? (
            <div className="flex-1 flex justify-center">
              <div className="w-full max-w-2xl hidden md:block">
                <SearchBar
                  value={search}
                  onChange={(v) => dispatch(setSearch(v))}
                  onClear={() => dispatch(setSearch(""))}
                  size="sm"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div className="flex items-center gap-3">
            {canCRM && <NotificationsBell />}
            {user && (
              <UserMenu align="right" compact={false} />
            )}
          </div>
        </header>

        {/* Buscador móvil (segunda fila) en el catálogo */}
        {showSearch && (
          <div className="bg-black/95 px-4 pb-1 pt-3 md:hidden">
            <SearchBar
              value={search}
              onChange={(v) => dispatch(setSearch(v))}
              onClear={() => dispatch(setSearch(""))}
              size="sm"
            />
          </div>
        )}

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

      {/* ── BARRA INFERIOR MÓVIL (controles al alcance del pulgar) ── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border bg-surface/95 px-2 backdrop-blur-xl md:hidden">
        <button
          onClick={expanded ? closePanel : openPanel}
          aria-label="Menú"
          className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-text"
        >
          <LayoutGrid className="h-5 w-5" />
          Todo
        </button>
        {!user && <CartButton variant="bar" />}
        {user ? (
          <div className="flex flex-col items-center">
            <UserMenu compact />
          </div>
        ) : (
          <Link
            to="/login"
            aria-label="Iniciar sesión"
            className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-accent-2"
          >
            <LogIn className="h-5 w-5" />
            Entrar
          </Link>
        )}
      </nav>

      {/* Paleta de comandos ⌘K (salto rápido entre portales) */}
      <CommandPalette items={businessItems.map(({ to, label, icon }) => ({ to, label, icon }))} />

      {/* Drawer del carrito global */}
      <CartDrawer />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Controles fijos del rail (carrito, tema, cuenta). Siempre visibles, colapsado o
   expandido. En escritorio se apilan al pie del rail.
   ──────────────────────────────────────────────────────────────────────────── */
function RailControls({
  expanded,
  canCRM,
  user,
  roles,
}: {
  expanded: boolean;
  canCRM: boolean;
  user: ReturnType<typeof useAuth>["user"];
  roles: Role[];
}) {
  if (user) return null;

  return (
    <div
      className={cn(
        "shrink-0 border-t border-border p-3",
        expanded ? "flex flex-col gap-2" : "flex flex-col items-center gap-2",
      )}
    >
      <div className={cn("flex items-center gap-2", expanded ? "justify-between" : "flex-col")}>
        <div className={cn("flex items-center gap-2", !expanded && "flex-col")}>
          <CartButton />
        </div>
      </div>

      <LoginButton expanded={expanded} />
    </div>
  );
}

/* Botón "Iniciar Sesión" con acento esmeralda, entrada suave y brillo al hover. */
function LoginButton({ expanded }: { expanded: boolean }) {
  if (!expanded) {
    return (
      <Link
        to="/login"
        title="Iniciar sesión"
        aria-label="Iniciar sesión"
        className="group grid h-11 w-11 place-items-center rounded-lg bg-gradient-to-b from-accent to-accent-hover text-bg shadow-md shadow-accent/25 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <LogIn className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" />
      </Link>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <Link
        to="/login"
        className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-b from-accent to-accent-hover px-4 py-2.5 text-sm font-semibold text-bg shadow-md shadow-accent/25 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {/* Brillo que cruza al hover */}
        <span
          aria-hidden
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
        />
        <LogIn className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        <span className="relative">Iniciar Sesión</span>
      </Link>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Contenido del panel expandido (categorías + Mi negocio + ayuda). Compartido por
   el rail de escritorio y el drawer móvil.
   ──────────────────────────────────────────────────────────────────────────── */
function RailPanelContent({
  categories,
  businessGroups,
  badges,
  authed,
  reduce,
  collapsed = false,
  hideLogo = false,
  onGoCategory,
  onGoHome,
  onNavigate,
}: {
  categories: Category[];
  businessGroups: NavGroup[];
  badges: Record<string, number>;
  authed: boolean;
  reduce: boolean;
  /** Rail de escritorio colapsado: oculta etiquetas/encabezados (los iconos quedan). */
  collapsed?: boolean;
  /** Oculta el logo grande interno (el rail de escritorio ya tiene su propio header). */
  hideLogo?: boolean;
  onGoCategory: (id: string | null) => void;
  onGoHome: () => void;
  onNavigate: () => void;
}) {
  const [openCat, setOpenCat] = useState<string | null>(null);

  // Clase de revelado: en colapsado las etiquetas/encabezados se desvanecen (pero
  // conservan su hueco → los iconos no saltan). whitespace-nowrap evita que el texto
  // haga wrap mientras el ancho se anima.
  const reveal = cn("whitespace-nowrap transition-opacity duration-200", collapsed && "pointer-events-none opacity-0");

  return (
    <div>
      {authed && !hideLogo && (
        <div className="mb-6 px-3">
          <Link to="/" onClick={onNavigate} className="transition-transform active:scale-95 inline-block">
            <Logo size={80} />
          </Link>
        </div>
      )}

      {/* Categorías */}
      {!authed && !collapsed && categories.length > 0 && (
        <section className="mb-6">
          <p className="mb-2 px-3 text-[15px] font-extrabold uppercase tracking-wider text-white">Categorías</p>
          <ul className="flex flex-col">
            {categories.map((c) => {
              const hasSub = Boolean(c.subcategories && c.subcategories.length > 0);
              const isOpen = openCat === c.id;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => (hasSub ? setOpenCat(isOpen ? null : c.id) : onGoCategory(c.id))}
                    aria-expanded={hasSub ? isOpen : undefined}
                    className="group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span
                      className={cn(
                        "text-[15px] font-semibold tracking-tight transition-colors",
                        isOpen ? "text-accent-2" : "text-text group-hover:text-accent-2",
                      )}
                    >
                      {c.name}
                    </span>
                    {hasSub ? (
                      <motion.span
                        aria-hidden
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={reduce ? { duration: 0 } : { duration: 0.3, ease: EASE }}
                        className={cn(
                          "grid h-6 w-6 place-items-center rounded-full transition-colors",
                          isOpen ? "bg-accent/12 text-accent-2" : "text-muted group-hover:text-accent-2",
                        )}
                      >
                        <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
                      </motion.span>
                    ) : (
                      <ChevronRight
                        aria-hidden
                        className="h-4 w-4 -translate-x-2 text-muted opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-accent-2 group-hover:opacity-100"
                      />
                    )}
                  </button>

                  {hasSub && (
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="sub"
                          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                          animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                          transition={
                            reduce
                              ? { duration: 0.15 }
                              : { height: { duration: 0.35, ease: EASE }, opacity: { duration: 0.2, ease: EASE } }
                          }
                          className="overflow-hidden"
                        >
                          <div className="my-1 ml-3 flex flex-col gap-0.5 border-l border-border pb-2 pl-3">
                            <button
                              onClick={() => onGoCategory(c.id)}
                              className="group/all flex items-center justify-between rounded-md px-3 py-2 text-[13px] font-semibold text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                              <span>Ver todo en {c.name}</span>
                              <ChevronRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/all:translate-x-0.5" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Mi negocio (solo con sesión) */}
      {authed && businessGroups.length > 0 && (
        <section className="mb-6">
          <p className={cn("mb-2 px-3 text-[15px] font-black uppercase tracking-wider text-white", reveal)}>Tienda</p>
          <div className="flex flex-col gap-3">
            {businessGroups.map((group) => (
              <div key={group.label}>
                {businessGroups.length > 1 && group.label.toLowerCase() !== "tienda" && (
                  <p className={cn("mb-1 px-3 text-[14px] font-extrabold uppercase tracking-wider text-white", reveal)}>
                    {group.label}
                  </p>
                )}
                <div className="flex flex-col gap-0.5">
                  {group.label.toLowerCase() === "tienda" && (
                    <Link
                      to="/"
                      onClick={onGoHome}
                      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Store className="h-[18px] w-[18px] shrink-0" />
                      <span className={cn("flex-1 text-left truncate", reveal)}>Ir al catálogo</span>
                    </Link>
                  )}
                  {group.items.map(({ to, label, icon: Icon }) => {
                    const badge = badges[to] ?? 0;
                    return (
                      <NavLink
                        key={to}
                        to={to}
                        onClick={onNavigate}
                        title={label}
                        className={({ isActive }) =>
                          cn(
                            "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                            isActive ? "bg-accent/12 font-bold text-accent-2" : "text-white hover:bg-white/10",
                          )
                        }
                      >
                        <span className="relative shrink-0">
                          <Icon className="h-[18px] w-[18px]" />
                          {/* Colapsado: el conteo no cabe → un punto sobre el icono. */}
                          {collapsed && badge > 0 && (
                            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-warning ring-2 ring-black" />
                          )}
                        </span>
                        <span className={cn("flex-1 truncate", reveal)}>{label}</span>
                        {badge > 0 && (
                          <span className={cn("rounded-pill bg-warning/15 px-1.5 text-[11px] font-bold leading-4 text-warning", reveal)}>
                            {badge}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Ayuda e información */}
      <section className="border-t border-border pt-5">
        <p className={cn("mb-2 px-3 text-[15px] font-black uppercase tracking-wider text-white", reveal)}>Ayuda e información</p>
        <div className="flex flex-col">
          <Link
            to="/contacto"
            onClick={onNavigate}
            title="Contacto"
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <MessageCircle className="h-[18px] w-[18px] shrink-0 text-white transition-colors group-hover:text-white" />
            <span className={cn("whitespace-nowrap font-medium transition-all duration-300 group-hover:translate-x-0.5", collapsed && "pointer-events-none opacity-0")}>Contacto</span>
          </Link>
          {!authed && (
            <Link
              to="/login"
              onClick={onNavigate}
              title="Acceso Colaboradores"
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Shield className="h-[18px] w-[18px] shrink-0 text-white transition-colors group-hover:text-white" />
              <span className={cn("whitespace-nowrap font-medium transition-all duration-300 group-hover:translate-x-0.5", collapsed && "pointer-events-none opacity-0")}>Acceso Colaboradores</span>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
