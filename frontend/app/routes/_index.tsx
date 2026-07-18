import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { Container } from "~/components/layout/Container";
import { Hero } from "~/components/catalog/Hero";
import { ProductGrid } from "~/components/catalog/ProductGrid";
import { ProductCarousel } from "~/components/product/ProductCarousel";
import { ComboSection } from "~/components/catalog/ComboSection";
import { SortableCatalogGrid } from "~/components/catalog/SortableCatalogGrid";
import { FilterBar } from "~/components/filters/FilterBar";
import { ActiveFilters } from "~/components/filters/ActiveFilters";
import { FilterFab } from "~/components/catalog/FilterFab";
import { FilterSheet } from "~/components/filters/FilterSheet";
import type { CatalogProduct, Category, Combo, LandingConfig } from "~/store/api/catalogApi";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { selectEditMode, selectIsAdmin, setEditMode } from "~/store/slices/authSlice";

// SSR: catálogo Y categorías se obtienen en el servidor (no en el cliente) para
// mejorar SEO y FCP, y evitar el parpadeo de carga. /api/catalog y /api/config son
// PÚBLICOS (no necesitan el token de Firebase). Express sirve el SSR en el mismo
// proceso, por lo que estos fetch al origin propio son locales (la API cachea).
// Cache HTTP del catálogo público: 60s frescos + 5min de stale-while-revalidate.
// El HTML SSR nunca contiene contenido de admin (el modo edición hidrata en cliente),
// así que es seguro cachearlo en navegador/CDN.
export const headers: HeadersFunction = () => ({
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
});

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = new URL(request.url).origin;
  let products: CatalogProduct[] = [];
  let categories: Category[] = [];
  let combos: Combo[] = [];
  let landing: LandingConfig | null = null;
  try {
    const [pRes, cRes, comboRes, landingRes] = await Promise.all([
      fetch(`${origin}/api/catalog`),
      fetch(`${origin}/api/config`),
      fetch(`${origin}/api/combos`),
      fetch(`${origin}/api/config/landing_page`),
    ]);
    if (pRes.ok) products = (await pRes.json()) as CatalogProduct[];
    if (cRes.ok) categories = ((await cRes.json()) as { categories?: Category[] }).categories ?? [];
    if (comboRes.ok) combos = (await comboRes.json()) as Combo[];
    if (landingRes.ok) landing = (await landingRes.json()) as LandingConfig;
    
    // Categorías de la tienda. FUENTE ÚNICA DE VERDAD: el `id` de cada categoría
    // DEBE ser el valor real de `product.category` que devuelve la API. Así el chip
    // activo, las subcategorías y el filtro de la grilla hablan el mismo idioma
    // (antes los ids inventados no coincidían con ningún producto → filtros vacíos).
    // Valores reales actuales en la API: audifonos-kz, adaptador-bt, accesorios-pc.
    const baseCategories = [
      { id: "audifonos-kz", name: "Audífonos In Ear" },
      { id: "accesorios-kz", name: "Accesorios para audífonos KZ" },
      { id: "adaptador-bt", name: "Adaptador Bluetooth para audífonos KZ" },
      { id: "accesorios-pc", name: "Accesorios Para computadores" },
      { id: "accesorios-moto", name: "Accesorios Para moto" },
      { id: "accesorios-gaming", name: "Accesorios para gaming variados" },
    ];

    // Subcategorías = productos cuya `category` coincide con el id de la categoría
    // (ids ya alineados con los valores reales de la API → coincidencia directa).
    categories = baseCategories
      .map((cat) => {
        const catProducts = products.filter((p) => p.category === cat.id || p.category === cat.name);
        return {
          ...cat,
          subcategories: catProducts.length > 0 ? catProducts.map((p) => ({ id: p.id, name: p.name })) : undefined,
        };
      })
      // Ocultar categorías sin productos: nada que mostrar ni que filtrar.
      .filter((cat) => cat.subcategories);
  } catch {
    // Si la API falla, la página igual renderiza (grilla vacía con su estado vacío).
  }
  return { origin, products, categories, combos, landing };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const origin = data?.origin ?? "";
  const img = `${origin}/logo.jpg`;
  const title = "Gyro Store";
  const description = "Audífonos KZ, adaptadores Bluetooth y accesorios para PC en Managua, Nicaragua.";
  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Gyro Store" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: img },
    { property: "og:url", content: `${origin}/` },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: img },
  ];
};

export default function Index() {
  const { products, categories, combos, landing } = useLoaderData<typeof loader>();
  const dispatch = useAppDispatch();
  const isAdmin = useAppSelector(selectIsAdmin);
  const editMode = useAppSelector(selectEditMode);
  const editing = isAdmin && editMode;
  const [searchParams, setSearchParams] = useSearchParams();

  const searchQuery = useAppSelector((state) => state.ui.search);
  const activeCategory = useAppSelector((state) => state.ui.activeCategory);
  const hasFilters = Boolean(searchQuery.trim() || activeCategory);
  const reduce = useReducedMotion();

  // Colapso elegante de las secciones de "bienvenida" (Hero + carrusel) cuando el
  // usuario filtra. Animar height:auto↔0 + opacity evita el salto brusco de montar/
  // desmontar en seco (la causa del "empuje sin sentido" al elegir categoría).
  const collapse = {
    initial: { height: 0, opacity: 0 },
    animate: { height: "auto" as const, opacity: 1 },
    exit: { height: 0, opacity: 0 },
    transition: { duration: reduce ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] as const },
    style: { overflow: "hidden" as const },
  };

  // "Seguir comprando" desde el carrito navega a /#catalogo: al montar la home
  // (viniendo de una ficha de producto) saltamos directo a la grilla.
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#catalogo") return;
    const t = setTimeout(
      () => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
    return () => clearTimeout(t);
  }, []);

  // Deep-link desde el menú del admin: /?edit=1 activa el modo edición UNA vez y
  // limpia el query param. Es Redux (no la URL) la fuente de verdad del modo edición,
  // porque el botón del header también lo alterna; por eso sincronizamos el deep-link
  // con un efecto (uso correcto de useEffect: sincronizar con un sistema externo, la
  // URL) en vez de derivarlo en render, lo que crearía dos fuentes de verdad.
  useEffect(() => {
    if (isAdmin && searchParams.get("edit") === "1") {
      dispatch(setEditMode(true));
      const next = new URLSearchParams(searchParams);
      next.delete("edit");
      setSearchParams(next, { replace: true });
    }
  }, [isAdmin, searchParams, setSearchParams, dispatch]);

  return (
    <>
      {/* El drawer de categorías (chip "Todo") ahora lo sirve el rail unificado del
          AppShell — fuente única del panel expandido para toda la app. */}
      {!editing && (
        <>
          <FilterFab />
          <FilterSheet />
        </>
      )}
      <AnimatePresence initial={false}>
        {!hasFilters && (
          <motion.div key="hero" {...collapse}>
            <Hero initialLanding={landing} />
          </motion.div>
        )}
      </AnimatePresence>

      <Container as="main" className="flex-1 py-0">
        {/* Marcas y Carrusel destacado (solo en la vista por defecto, sin filtros). */}
        <AnimatePresence initial={false}>
          {!editing && !hasFilters && (
            <motion.div key="brands-and-carousel" {...collapse}>
              <ProductCarousel
                title="Artículos Populares"
                subtitle="Los favoritos de la tienda"
                products={products.filter((p) => p.images?.[0]).slice(0, 12)}
                categories={categories}
                variant="showcase"
              />
              <ComboSection combos={combos} />
            </motion.div>
          )}
        </AnimatePresence>

        {editing ? (
          <SortableCatalogGrid />
        ) : (
          <div id="catalogo" className="scroll-mt-20 pt-3 lg:pt-5">
            <FilterBar products={products} />
            <ActiveFilters categories={categories} />
            <ProductGrid products={products} categories={categories} />
          </div>
        )}
      </Container>
    </>
  );
}
