import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { PublicHeader } from "~/components/layout/PublicHeader";
import { PublicFooter } from "~/components/layout/PublicFooter";
import { Hero } from "~/components/catalog/Hero";
import { ProductGrid } from "~/components/catalog/ProductGrid";
import { ProductCarousel } from "~/components/catalog/ProductCarousel";
import { SortableCatalogGrid } from "~/components/catalog/SortableCatalogGrid";
import { BrandStrip } from "~/components/catalog/BrandStrip";
import { CategoryChips } from "~/components/catalog/CategoryChips";
import { CatalogToolbar } from "~/components/catalog/CatalogToolbar";
import { FilterFab } from "~/components/catalog/FilterFab";
import { FilterSheet } from "~/components/catalog/FilterSheet";
import { PublicSidebar } from "~/components/layout/PublicSidebar";
import type { CatalogProduct, Category } from "~/store/api/catalogApi";
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
  try {
    const [pRes, cRes] = await Promise.all([
      fetch(`${origin}/api/catalog`),
      fetch(`${origin}/api/config`),
    ]);
    if (pRes.ok) products = (await pRes.json()) as CatalogProduct[];
    if (cRes.ok) categories = ((await cRes.json()) as { categories?: Category[] }).categories ?? [];
    
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
  return { origin, products, categories };
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
  const { products, categories } = useLoaderData<typeof loader>();
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
    // data-skin="store": activa la piel "Midnight Neon" (tokens con scope en
    // tailwind.css) solo en el storefront; el admin conserva Obsidian/Esmeralda.
    <div data-skin="store" className="flex min-h-dvh flex-col bg-bg font-sans text-text">
      <PublicHeader 
        bottomBar={
          !editing ? (
            <div className="w-full bg-surface-2/80 border-b border-border/50 backdrop-blur-md">
              <div className="flex w-full items-center px-4 md:px-8">
                <CategoryChips categories={categories} />
              </div>
            </div>
          ) : null
        }
      />

      <AnimatePresence initial={false}>
        {!hasFilters && (
          <motion.div key="hero" {...collapse}>
            <Hero productCount={products.length} />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="w-full flex-1 px-4 md:px-8">
        {/* Marcas y Carrusel destacado (solo en la vista por defecto, sin filtros). */}
        <AnimatePresence initial={false}>
          {!editing && !hasFilters && (
            <motion.div key="brands-and-carousel" {...collapse}>
              <BrandStrip />
              <ProductCarousel
                title="Lo Más Nuevo"
                subtitle="Recién llegados a la tienda"
                products={products.filter((p) => p.images?.[0]).slice(0, 12)}
                categories={categories}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {editing ? (
          <SortableCatalogGrid />
        ) : (
          <div className="pt-3 lg:pt-5">
            <CatalogToolbar products={products} />
            <ProductGrid products={products} categories={categories} />
          </div>
        )}
      </main>

      <PublicFooter />

      {/* Filtros móviles: FAB + bottom sheet (ocultos en modo edición) */}
      {!editing && (
        <>
          <FilterFab />
          <FilterSheet />
          <PublicSidebar categories={categories} />
        </>
      )}
    </div>
  );
}
