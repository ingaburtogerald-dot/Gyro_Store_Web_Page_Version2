import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@remix-run/react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, User, X, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "~/components/ui/Logo";
import { IconButton } from "~/components/ui/IconButton";
import { SearchBar } from "~/components/filters/SearchBar";
import { CartDrawer } from "~/components/cart/CartDrawer";
import { CartButton } from "~/components/cart/CartButton";
import { CategoriesDrawer } from "./CategoriesDrawer";
import { UserMenu } from "./UserMenu";
import { DesktopNav } from "./public-header/DesktopNav";
import { MegaMenuPanel } from "./public-header/MegaMenuPanel";
import { useAuth } from "~/hooks/useAuth";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { hydrate } from "~/store/slices/cartSlice";
import {
  setSearch,
  setCategory,
  resetFilters,
  triggerHeroReplay,
} from "~/store/slices/uiSlice";
import { selectIsAdmin, selectEditMode } from "~/store/slices/authSlice";
import {
  useGetCatalogQuery,
  useGetLandingConfigQuery,
  useUpdateLandingConfigMutation,
  useGetConfigQuery,
  useGetPopularSearchQuery,
} from "~/store/api/catalogApi";
import { buildCategoryTree } from "~/lib/categories";
import type { Category } from "~/types/catalog";

const EASE = [0.16, 1, 0.3, 1] as const;

export function PublicHeader({ bottomBar }: { bottomBar?: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const search = useAppSelector((s) => s.ui.search);

  const [searchOpen, setSearchOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const [openCat, setOpenCat] = useState<string | null>(null);
  const closeTimer = useRef<number>();

  const isAdmin = useAppSelector(selectIsAdmin);
  const editMode = useAppSelector(selectEditMode);
  const editing = isAdmin && editMode;

  const { data: products = [] } = useGetCatalogQuery();
  const { data: config } = useGetConfigQuery();
  const allCategories = useMemo(() => buildCategoryTree(products, config?.categories || []), [products, config?.categories]);

  const { data: popularSearch } = useGetPopularSearchQuery();
  const popularKeywords = popularSearch?.terms ?? [];
  const featuredProducts = useMemo(() => {
    if (!popularSearch?.productIds?.length || !products.length) return [];
    const byId = new Map(products.map((p) => [p.id, p]));
    return popularSearch.productIds
      .map((id) => byId.get(id))
      .filter((p): p is (typeof products)[number] => Boolean(p))
      .slice(0, 4)
      .map((p) => ({ id: p.id, name: p.name, price: p.price, image: p.images?.[0] }));
  }, [popularSearch, products]);

  const { data: landing } = useGetLandingConfigQuery();
  const [updateLanding, { isLoading: savingHeader }] = useUpdateLandingConfigMutation();
  const headerOrder = landing?.headerCategories ?? [];

  const categories = useMemo<Category[]>(() => {
    if (!headerOrder.length) return allCategories;
    const byId = new Map(allCategories.map((c) => [c.id, c]));
    return headerOrder.map((id) => byId.get(id)).filter(Boolean) as Category[];
  }, [headerOrder, allCategories]);

  const availableToAdd = useMemo<Category[]>(() => {
    const shown = new Set(categories.map((c) => c.id));
    return allCategories.filter((c) => !shown.has(c.id));
  }, [categories, allCategories]);

  const [addOpen, setAddOpen] = useState(false);

  async function saveHeaderOrder(ids: string[]) {
    try {
      await updateLanding({
        headerCategories: ids,
        heroSlides: landing?.heroSlides ?? [],
      }).unwrap();
    } catch (e) {
      const msg = (e as { data?: { error?: string } })?.data?.error;
      toast.error(msg || "No se pudo guardar el orden del header.");
    }
  }

  const currentIds = categories.map((c) => c.id);

  function moveCategory(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= currentIds.length) return;
    const next = [...currentIds];
    [next[idx], next[target]] = [next[target], next[idx]];
    saveHeaderOrder(next);
  }

  function removeCategory(id: string) {
    saveHeaderOrder(currentIds.filter((x) => x !== id));
  }

  function addCategory(id: string) {
    saveHeaderOrder([...currentIds, id]);
    setAddOpen(false);
  }

  function handleAddClick() {
    if (availableToAdd.length === 0) {
      toast.info("No hay más etiquetas disponibles.");
      return;
    }
    setAddOpen((v) => !v);
  }

  const productsByCat = useMemo(() => {
    const map: Record<string, typeof products> = {};
    for (const c of categories) {
      map[c.id] = products.filter((p) => p.category === c.id || p.category === c.name);
    }
    return map;
  }, [categories, products]);

  const activeCat = openCat ? categories.find((c) => c.id === openCat) : null;
  const activeList = openCat ? productsByCat[openCat] ?? [] : [];

  useEffect(() => {
    dispatch(hydrate());
  }, [dispatch]);

  useEffect(() => {
    if (!searchOpen && !openCat) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setOpenCat(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, openCat]);

  function openMenu(id: string) {
    window.clearTimeout(closeTimer.current);
    setOpenCat(id);
  }
  function scheduleCloseMenu() {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenCat(null), 140);
  }
  function cancelCloseMenu() {
    window.clearTimeout(closeTimer.current);
  }
  function toggleMenu(id: string) {
    window.clearTimeout(closeTimer.current);
    setOpenCat((cur) => (cur === id ? null : id));
  }

  function goCategory(id: string) {
    dispatch(setCategory(id));
    setOpenCat(null);
    navigate("/");
  }

  function openSearch() {
    setOpenCat(null);
    setSearchOpen((v) => !v);
  }

  function closeSearch() {
    setSearchOpen(false);
  }

  function submitSearch() {
    setSearchOpen(false);
    setOpenCat(null);
    navigate("/");
  }

  function handleGoHome() {
    dispatch(resetFilters());
    dispatch(setCategory(null));
    dispatch(setSearch(""));
    dispatch(triggerHeroReplay());
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-black pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 sm:h-17 w-full max-w-[1600px] items-center gap-3 sm:gap-4 px-3 sm:px-4 md:px-8">
          <Logo asLink onClick={handleGoHome} size={50} className="shrink-0" />

          <div className="relative flex h-11 flex-1 items-center justify-center">
            <AnimatePresence initial={false}>
              {searchOpen ? (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="absolute inset-x-0 mx-auto hidden w-full max-w-3xl md:block"
                >
                  <SearchBar
                    value={search}
                    onChange={(v) => dispatch(setSearch(v))}
                    onClear={() => dispatch(setSearch(""))}
                    onSubmit={submitSearch}
                    variant="pill"
                    withPanel
                    autoFocus
                    size="md"
                    popularKeywords={popularKeywords}
                    featuredProducts={featuredProducts}
                  />
                </motion.div>
              ) : (
                <DesktopNav
                  categories={categories}
                  availableToAdd={availableToAdd}
                  editing={editing}
                  savingHeader={savingHeader}
                  openCat={openCat}
                  moveCategory={moveCategory}
                  removeCategory={removeCategory}
                  addCategory={addCategory}
                  openMenu={openMenu}
                  scheduleCloseMenu={scheduleCloseMenu}
                  toggleMenu={toggleMenu}
                  handleAddClick={handleAddClick}
                  addOpen={addOpen}
                />
              )}
            </AnimatePresence>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <div className="md:hidden">
              <IconButton label="Menú" onClick={() => setCategoriesOpen(true)}>
                <LayoutGrid className="h-[18px] w-[18px] sm:h-[22px] sm:w-[22px]" />
              </IconButton>
            </div>
            <IconButton
              label={searchOpen ? "Cerrar búsqueda" : "Buscar"}
              onClick={openSearch}
              active={searchOpen}
            >
              {searchOpen ? <X className="h-[18px] w-[18px] sm:h-[22px] sm:w-[22px]" /> : <Search className="h-[18px] w-[18px] sm:h-[22px] sm:w-[22px]" />}
            </IconButton>
            <CartButton />
            {user ? (
              <UserMenu />
            ) : (
              <Link
                to="/login"
                aria-label="Iniciar sesión"
                className="grid h-9 w-9 sm:h-11 sm:w-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <User className="h-[18px] w-[18px] sm:h-[22px] sm:w-[22px]" />
              </Link>
            )}
          </div>
        </div>

        <AnimatePresence>
          {searchOpen && (
            <motion.div
              key="mobile-search-panel"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: EASE }}
              className="absolute inset-x-0 top-full z-40 border-b border-border/50 bg-bg/95 px-4 py-4 shadow-premium backdrop-blur-xl md:hidden"
            >
              <SearchBar
                value={search}
                onChange={(v) => dispatch(setSearch(v))}
                onClear={() => dispatch(setSearch(""))}
                onSubmit={submitSearch}
                variant="pill"
                withPanel
                autoFocus
                size="lg"
                popularKeywords={popularKeywords}
                featuredProducts={featuredProducts}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <MegaMenuPanel
          activeCat={activeCat ?? null}
          searchOpen={searchOpen}
          activeList={activeList}
          goCategory={goCategory}
          setOpenCat={setOpenCat}
          cancelCloseMenu={cancelCloseMenu}
          scheduleCloseMenu={scheduleCloseMenu}
        />

        {bottomBar}
      </header>

      <AnimatePresence>
        {activeCat && !searchOpen && (
          <motion.button
            key="mega-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            onClick={() => setOpenCat(null)}
            aria-label="Cerrar menú"
            className="fixed inset-0 top-16 z-30 hidden cursor-default bg-black/40 md:block"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {searchOpen && (
          <motion.button
            key="search-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            onClick={closeSearch}
            aria-label="Cerrar búsqueda"
            className="fixed inset-0 top-16 z-30 cursor-default bg-black/50"
          />
        )}
      </AnimatePresence>

      <CategoriesDrawer open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />

      <CartDrawer />
    </>
  );
}
