// Shell unificado de Gyro Store. UN SOLO rail persistente a la izquierda sirve
// tanto al storefront público como al Centro de Administración: al iniciar sesión
// NO se salta a "otro sitio", solo aparece la sección "Mi negocio" dentro del mismo
// rail. Colapsado (~76px, solo iconos) por defecto; el botón "Todo" lo expande in
// situ a panel completo. Los controles fijos (carrito, tema, cuenta) viven SIEMPRE
// en el rail — el header queda libre (solo buscador). En móvil el rail se convierte
// en una barra inferior al alcance del pulgar + un drawer para el panel expandido.
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Link, useLocation, useNavigate } from "@remix-run/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Package,
  ShoppingBag,
  BarChart3,
  Truck,
  Users,
  Receipt,
  X,
  MessageCircle,
  CreditCard,
  Settings,
  Store,
  LayoutGrid,
  ChevronsLeft,
  ChevronDown,
  ChevronRight,
  KanbanSquare,
  Home,
  Sun,
  Moon,
  LogIn,
  Shield,
} from "lucide-react";
import { Logo } from "~/components/ui/Logo";
import { UserMenu } from "./UserMenu";
import { NotificationsBell } from "./NotificationsBell";
import { CommandPalette } from "./CommandPalette";
import { CartButton } from "./PublicHeader";
import { CartDrawer } from "~/components/cart/CartDrawer";
import { SearchBar } from "~/components/filters/SearchBar";
import { useAuth } from "~/hooks/useAuth";
import { useTheme } from "~/hooks/useTheme";
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
import { useGetCatalogQuery, type Category } from "~/store/api/catalogApi";
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
      { to: "/admin/catalogo", label: "Gestión de Catálogo", icon: LayoutGrid, roles: ["admin"] },
      { to: "/admin/pedidos", label: "Pedidos WhatsApp", icon: MessageCircle, roles: ["admin"] },
      { to: "/admin/facturacion", label: "Facturación", icon: Receipt, roles: ["admin", "cashier"] },
    ],
  },
  {
    label: "Operación",
    items: [
      { to: "/admin/inventario", label: "Inventario", icon: Package, roles: ["admin"] },
      { to: "/admin/ventas", label: "Ventas", icon: ShoppingBag, roles: ["admin", "seller"] },
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
    "/admin/pedidos": isAdmin ? publicOrders.filter((o) => !o.contacted && !o.archived).length : 0,
  };
}

export function AppShell({ children }: { children: ReactNode }) {
  const authRoles = useAppSelector(selectRoles);
  const roles = authRoles.length > 0 ? authRoles : (["public"] as Role[]);
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const badges = useNavBadges(roles);

  // Estado ÚNICO del panel expandido (mismo flag que usa el chip "Todo" del
  // catálogo). Colapsado por defecto tanto logueado como no logueado.
  const expanded = useAppSelector((s) => s.ui.publicSidebarOpen);
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
  const categories = buildCategoryTree(products);

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
  function goHome() {
    dispatch(resetFilters());
    dispatch(setCategory(null));
    closePanel();
    navigate("/");
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

      {/* ── RAIL DE ESCRITORIO (md+) ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-border bg-surface/95 backdrop-blur-xl transition-[width] duration-300 ease-out md:flex",
          expanded ? "w-80 shadow-premium" : "w-[76px]",
        )}
        style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
      >
        {expanded ? (
          <>
            {/* Cabecera: marca + colapsar */}
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
              <Link to="/" onClick={closePanel} className="transition-transform active:scale-95">
                <Logo size={30} withText textClassName="text-lg" />
              </Link>
              <button
                onClick={closePanel}
                aria-label="Colapsar menú"
                className="group grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <ChevronsLeft className="h-5 w-5 transition-transform duration-300 group-hover:-translate-x-0.5" />
              </button>
            </div>
            <div className="custom-scrollbar flex-1 overflow-y-auto px-3 py-4">
              <RailPanelContent
                categories={categories}
                businessGroups={businessGroups}
                badges={badges}
                authed={Boolean(user)}
                reduce={Boolean(reduce)}
                onGoCategory={goCategory}
                onGoHome={goHome}
                onNavigate={closePanel}
              />
            </div>
          </>
        ) : (
          <>
            {/* Colapsado: logo + botón Explorar */}
            <div className="flex flex-col items-center gap-1.5 border-b border-border py-3">
              <Link to="/" title="Inicio" className="transition-transform active:scale-95">
                <Logo size={40} />
              </Link>
              <button
                onClick={openPanel}
                title="Explorar"
                aria-label="Explorar categorías y menú"
                className="grid h-11 w-11 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
            </div>
            {/* Iconos de portales (solo con sesión) */}
            <nav className="custom-scrollbar flex flex-1 flex-col items-center gap-1 overflow-y-auto py-3">
              {businessItems.map(({ to, label, icon: Icon }) => {
                const badge = badges[to] ?? 0;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    title={label}
                    className={({ isActive }) =>
                      cn(
                        "group relative grid h-11 w-11 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                        isActive ? "bg-accent/12 text-accent-2" : "text-muted hover:bg-surface-2 hover:text-text",
                      )
                    }
                  >
                    <Icon className="h-5 w-5" />
                    {badge > 0 && (
                      <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-warning ring-2 ring-surface" />
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </>
        )}

        {/* Controles fijos SIEMPRE presentes */}
        <RailControls expanded={expanded} canCRM={canCRM} user={user} roles={roles} />
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
            className="fixed inset-y-0 left-0 z-50 flex w-full max-w-[360px] flex-col bg-surface shadow-premium md:hidden"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
              <Link to="/" onClick={closePanel} className="transition-transform active:scale-95">
                <Logo size={30} withText textClassName="text-lg" />
              </Link>
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
                onGoHome={goHome}
                onNavigate={closePanel}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── CONTENIDO ── */}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col pb-16 md:pb-0 md:pl-[76px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur-xl md:px-6">
          {/* En escritorio el rail ya muestra el logo: aquí solo en móvil (evita duplicado). */}
          <Link to="/" className="flex shrink-0 items-center transition-transform active:scale-95 md:hidden">
            <Logo size={30} withText textClassName="text-lg" />
          </Link>

          {showSearch ? (
            <div className="mx-auto hidden w-full max-w-2xl md:block">
              <SearchBar
                value={search}
                onChange={(v) => dispatch(setSearch(v))}
                onClear={() => dispatch(setSearch(""))}
                size="sm"
              />
            </div>
          ) : (
            <div className="flex-1" />
          )}
        </header>

        {/* Buscador móvil (segunda fila) en el catálogo */}
        {showSearch && (
          <div className="bg-surface/95 px-4 pb-1 pt-3 md:hidden">
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
        <CartButton variant="bar" />
        <ThemeToggleButton variant="bar" />
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
          {canCRM && <NotificationsBell />}
          <ThemeToggleButton />
        </div>
      </div>

      {user ? (
        expanded ? (
          <div className="flex items-center gap-2 rounded-lg bg-surface-2 p-2">
            <UserMenu />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-text">{user.name}</p>
              <p className="truncate text-[11px] text-muted">{roleLabel(roles)}</p>
            </div>
          </div>
        ) : (
          <UserMenu />
        )
      ) : (
        <LoginButton expanded={expanded} />
      )}
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

/* Toggle claro/oscuro compacto. `variant="bar"` lo adapta a la barra inferior móvil. */
function ThemeToggleButton({ variant }: { variant?: "bar" }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");
  const Icon = isDark ? Sun : Moon;

  if (variant === "bar") {
    return (
      <button
        onClick={toggle}
        aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
        className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-text"
      >
        <Icon className="h-5 w-5" />
        Tema
      </button>
    );
  }
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
      className="grid h-11 w-11 place-items-center rounded-lg border border-border bg-surface-2/70 text-muted shadow-sm transition-colors hover:border-accent/40 hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Icon className="h-5 w-5" />
    </button>
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
  onGoCategory,
  onGoHome,
  onNavigate,
}: {
  categories: Category[];
  businessGroups: NavGroup[];
  badges: Record<string, number>;
  authed: boolean;
  reduce: boolean;
  onGoCategory: (id: string | null) => void;
  onGoHome: () => void;
  onNavigate: () => void;
}) {
  const [openCat, setOpenCat] = useState<string | null>(null);

  return (
    <div>
      {/* CTA: volver a la tienda */}
      <button
        onClick={onGoHome}
        className="group mb-6 flex w-full items-center justify-between gap-3 rounded-lg bg-accent px-4 py-3 text-[15px] font-bold text-bg transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <span className="flex items-center gap-2.5">
          <Home className="h-[18px] w-[18px]" strokeWidth={2.25} />
          Ir a la tienda
        </span>
        <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </button>

      {/* Categorías */}
      {categories.length > 0 && (
        <section className="mb-6">
          <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Categorías</p>
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
        <section className="mb-6 border-t border-border pt-5">
          <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Mi negocio</p>
          <div className="flex flex-col gap-3">
            {businessGroups.map((group) => (
              <div key={group.label}>
                {businessGroups.length > 1 && (
                  <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider text-muted/70">
                    {group.label}
                  </p>
                )}
                <div className="flex flex-col gap-0.5">
                  {group.items.map(({ to, label, icon: Icon }) => {
                    const badge = badges[to] ?? 0;
                    return (
                      <NavLink
                        key={to}
                        to={to}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          cn(
                            "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                            isActive ? "bg-accent/12 font-medium text-accent-2" : "text-muted hover:bg-surface-2 hover:text-text",
                          )
                        }
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="flex-1 truncate">{label}</span>
                        {badge > 0 && (
                          <span className="rounded-pill bg-warning/15 px-1.5 text-[11px] font-semibold leading-4 text-warning">
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
        <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Ayuda e información</p>
        <div className="flex flex-col">
          <Link
            to="/contacto"
            onClick={onNavigate}
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <MessageCircle className="h-[18px] w-[18px] shrink-0 text-muted transition-colors group-hover:text-accent-2" />
            <span className="transition-transform duration-300 group-hover:translate-x-0.5">Contacto</span>
          </Link>
          {!authed && (
            <Link
              to="/login"
              onClick={onNavigate}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Shield className="h-[18px] w-[18px] shrink-0 text-muted transition-colors group-hover:text-accent-2" />
              <span className="transition-transform duration-300 group-hover:translate-x-0.5">Acceso Colaboradores</span>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
