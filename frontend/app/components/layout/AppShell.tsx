import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@remix-run/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  X,
  LayoutGrid,
  LogIn,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Logo } from "~/components/ui/Logo";
import { UserMenu } from "./UserMenu";
import { NotificationsBell } from "./NotificationsBell";
import { CommandPalette } from "./CommandPalette";
import { CartButton } from "~/components/cart/CartButton";
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
  triggerHeroReplay,
} from "~/store/slices/uiSlice";
import { hydrate } from "~/store/slices/cartSlice";
import { useGetCatalogQuery, useGetConfigQuery } from "~/store/api/catalogApi";
import { buildCategoryTree } from "~/lib/categories";
import { cn } from "~/lib/utils";
import type { Role } from "~/lib/constants";
import { NAV_GROUPS, useNavBadges } from "./app-shell/navigation";
import { RailControls } from "./app-shell/RailControls";
import { RailPanelContent } from "./app-shell/RailPanelContent";
import type { NavItem } from "./app-shell/navigation";

const EASE = [0.16, 1, 0.3, 1] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const roles = useAppSelector(selectRoles);
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const badges = useNavBadges(roles);

  const expanded = useAppSelector((s) => s.ui.publicSidebarOpen);
  const [isHovered, setIsHovered] = useState(false);
  const isSidebarVisible = expanded || isHovered;

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

  useEffect(() => {
    dispatch(hydrate());
  }, [dispatch]);

  useEffect(() => {
    dispatch(closePublicSidebar());
  }, [location.pathname, dispatch]);

  const { data: products = [] } = useGetCatalogQuery();
  const { data: config } = useGetConfigQuery();
  const categories = buildCategoryTree(products, config?.categories || []);

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
    dispatch(setSearch(""));
    dispatch(triggerHeroReplay());
    closePanel();
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div className="flex min-h-screen">
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

      <aside
        onMouseEnter={handleRailEnter}
        onMouseLeave={handleRailLeave}
        className={cn(
          "fixed inset-y-0 left-0 z-50 hidden flex-col overflow-hidden border-r border-border bg-black transition-[width] duration-300 ease-out md:flex",
          isSidebarVisible ? "w-58 shadow-premium" : "w-[76px]",
        )}
        style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
      >
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

        <RailControls expanded={isSidebarVisible} canCRM={canCRM} user={user} roles={roles} />
      </aside>

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

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col pb-16 md:pb-0 md:pl-[76px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-black/80 px-4 backdrop-blur-xl md:px-6">
          <Link to="/" onClick={handleGoHome} className="flex shrink-0 items-center transition-transform active:scale-95 md:hidden">
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

      <CommandPalette items={businessItems.map(({ to, label, icon }) => ({ to, label, icon }))} />

      <CartDrawer />
    </div>
  );
}
