// Detalle de un combo (/combo/:id). SSR para que el preview al compartir tenga
// foto/título/precio. Muestra los 2 productos del paquete, el ahorro frente a
// comprarlos por separado, y "Agregar combo" (línea atómica en el carrito).
import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useState, useMemo, useEffect } from "react";
import { Link, useLoaderData } from "@remix-run/react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ImageOff, Sparkles, ShoppingCart, Check, Bike, Package, Banknote, ShieldCheck, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { CategoriesDrawer } from "~/components/layout/CategoriesDrawer";
import { PublicFooter } from "~/components/layout/PublicFooter";
import { ProductTopNav } from "~/components/catalog/ProductTopNav";
import { ProductCarousel } from "~/components/product/ProductCarousel";
import { Button } from "~/components/ui/Button";
import type { Combo, CatalogProduct, Category } from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
import { comboToCartItem } from "~/lib/combo";
import { formatCordobas, cn } from "~/lib/utils";

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemFade = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0 }
};

const TRUST_ITEMS: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: Bike, title: "Delivery en Managua", description: "Servicio con costo extra para recibir tu producto." },
  { icon: Package, title: "Envíos a departamentos por Cargo Trans", description: "Envíos seguros a todo el país." },
  { icon: Banknote, title: "Pago contra entrega", description: "Paga en efectivo o transferencia al recibir tu producto." },
  { icon: ShieldCheck, title: "Garantía de 1 mes", description: "Cobertura por defectos de fábrica." },
];

export const headers: HeadersFunction = () => ({
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
});

export async function loader({ params, request }: LoaderFunctionArgs) {
  const origin = new URL(request.url).origin;
  const rawId = params.id || "";
  const idParts = rawId.split("--");
  const actualId = idParts[idParts.length - 1];

  let combo: Combo | null = null;
  let catalog: CatalogProduct[] = [];
  let categories: Category[] = [];
  try {
    const [cRes, listRes, confRes] = await Promise.all([
      fetch(`${origin}/api/combos/${actualId}`),
      fetch(`${origin}/api/catalog`),
      fetch(`${origin}/api/config`),
    ]);
    if (cRes.ok) combo = (await cRes.json()) as Combo;
    if (listRes.ok) catalog = (await listRes.json()) as CatalogProduct[];
    if (confRes.ok) categories = ((await confRes.json()) as { categories?: Category[] }).categories ?? [];
  } catch {
    /* combo queda null → el componente muestra "no encontrado" */
  }
  return { combo, catalog, categories, url: request.url, origin };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const c = data?.combo;
  if (!c) return [{ title: "Combo · Gyro Store" }];
  const img = c.image || c.products?.[0]?.image || `${data!.origin}/logo.jpg`;
  const title = `${c.name} · Gyro Store`;
  const description = `Combo: ${c.products.map((p) => p.name).join(" + ")} por ${formatCordobas(c.price)} en Gyro Store, Managua.`;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "product" },
    { property: "og:site_name", content: "Gyro Store" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: img },
    { property: "og:url", content: data!.url },
    { property: "product:price:amount", content: String(c.price ?? "") },
    { property: "product:price:currency", content: "NIO" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:image", content: img },
  ];
};

export default function ComboDetail() {
  const { combo, catalog, categories } = useLoaderData<typeof loader>();
  const dispatch = useAppDispatch();
  const [isAdded, setIsAdded] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById("public-footer");
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      setFooterVisible(entry.isIntersecting);
    }, { rootMargin: "0px 0px 50px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const related = useMemo(() => {
    if (!combo) return [];
    const others = catalog.filter(p => !combo.products.some(cp => cp.id === p.id));
    return others.slice(0, 12);
  }, [catalog, combo]);

  if (!combo) {
    return (
      <div className="flex min-h-dvh flex-col bg-bg font-sans text-text">
        <main className="grid flex-1 place-items-center px-4 py-20 text-center">
          <div>
            <p className="text-lg font-semibold">Combo no encontrado</p>
            <p className="mt-1 text-sm text-muted">Puede que ya no esté disponible.</p>
            <Link to="/" className="mt-4 inline-block text-accent hover:underline">
              Volver a la tienda
            </Link>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  function addToCart() {
    dispatch(addItem(comboToCartItem(combo!)));
    dispatch(openCart());
    toast.success("Combo agregado al carrito");
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg font-sans text-text">
      <ProductTopNav
        title={combo.name || "Combo"}
        productId={combo.id}
        onOpenCategories={() => setCategoriesOpen(true)}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-0 md:pb-4">
        <CategoriesDrawer open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />

        <div className="grid gap-4 md:gap-10 md:grid-cols-[1.1fr_1fr] lg:grid-cols-[1.3fr_1fr] items-start">
          {/* Columna Izquierda: Galería/Productos */}
          <div className="flex flex-col gap-6 min-w-0">
            {combo.image ? (
              <div className="product-stage w-full overflow-hidden rounded-2xl bg-surface-2/40 aspect-square md:aspect-auto md:h-[500px]">
                <img src={combo.image} alt={combo.name} className="h-full w-full object-contain p-8 md:p-12 drop-shadow-2xl" />
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
                {combo.products.map((p, i) => (
                  <div key={p.id} className="flex flex-1 flex-col sm:flex-row sm:items-center">
                    <div className="card-premium flex flex-1 flex-col overflow-hidden rounded-2xl p-4">
                      <Link
                        to={`/producto/${p.id}`}
                        prefetch="intent"
                        className="product-stage aspect-square w-full overflow-hidden rounded-xl"
                      >
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="h-full w-full object-contain p-6 hover:scale-105 transition-transform duration-500 ease-out" />
                        ) : (
                          <div className="grid h-full place-items-center text-muted">
                            <ImageOff className="h-8 w-8" />
                          </div>
                        )}
                      </Link>
                      <div className="mt-3">
                        <Link to={`/producto/${p.id}`} prefetch="intent" className="font-bold leading-snug hover:text-accent-2">
                          {p.name}
                        </Link>
                        <p className="mt-1 text-sm text-muted tabular-nums">{formatCordobas(p.price)}</p>
                        {p.description && (
                          <p className="mt-2 line-clamp-2 text-sm font-light leading-relaxed text-muted">
                            {String(p.description).replace(/<[^>]*>?/gm, "")}
                          </p>
                        )}
                      </div>
                    </div>
                    {i === 0 && (
                      <div className="grid shrink-0 place-items-center py-2 text-3xl font-light text-muted sm:px-3">+</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Columna Derecha: Info y Compra */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="flex flex-col md:sticky md:top-24 pb-0 md:pb-8 min-w-0"
          >
            <motion.div variants={itemFade}>
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="rounded-pill bg-accent/15 px-3 py-1 text-xs font-bold tracking-wide text-accent-2 ring-1 ring-accent/20 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Combo
                </span>
              </div>
              <h1 className="font-heading text-2xl sm:text-[clamp(2rem,5.5vw,3.25rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-balance text-text">
                {combo.name}
              </h1>
            </motion.div>

            <motion.div variants={itemFade} className="mt-5 flex flex-wrap items-baseline gap-4">
              <p className="font-heading text-3xl sm:text-[clamp(2.5rem,6vw,3rem)] font-extrabold tabular-nums leading-none text-accent">
                {formatCordobas(combo.price)}
              </p>
              {combo.savings > 0 && (
                <span className="text-lg text-muted line-through">
                  {formatCordobas(combo.normalTotal)}
                </span>
              )}
              {combo.savings > 0 && (
                <span className="rounded-pill bg-whatsapp/12 px-2.5 py-1 text-xs font-semibold tabular-nums tracking-wide text-whatsapp">
                  Ahorras {formatCordobas(combo.savings)}
                </span>
              )}
            </motion.div>

            <motion.p variants={itemFade} className="mt-3 inline-flex items-center gap-2 text-[12px] sm:text-sm font-medium text-whatsapp">
              <span className="h-1.5 w-1.5 rounded-full bg-whatsapp" />
              <span>Disponible para entrega inmediata</span>
            </motion.p>

            {/* Caja de Acción */}
            <motion.div variants={itemFade} className="card-premium mt-6 flex flex-col gap-6 rounded-2xl p-4 sm:p-8">
              <div className="flex flex-col focus:outline-none">
                
                <div className="mb-6">
                  <p className="mb-3 text-[12px] sm:text-sm font-semibold text-text">Incluye:</p>
                  <ul className="space-y-2 text-[12px] sm:text-sm">
                    {combo.products.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                        <span className="min-w-0 flex-1 truncate text-muted">{p.name}</span>
                        <span className="tabular-nums text-muted">{formatCordobas(p.price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mb-4">
                  <Button
                    variant="primary"
                    onClick={addToCart}
                    className={cn("w-full overflow-hidden", isAdded && "bg-whatsapp hover:bg-whatsapp border-transparent text-zinc-950")}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={isAdded ? "added" : "idle"}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="inline-flex items-center gap-2"
                      >
                        {isAdded ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
                        {isAdded ? "¡Agregado!" : "Agregar combo"}
                      </motion.span>
                    </AnimatePresence>
                  </Button>
                </div>

                {/* Trust Box */}
                <div className="mt-2 flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 gap-3 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {TRUST_ITEMS.map((t) => {
                    const Icon = t.icon;
                    return (
                      <div key={t.title} className="flex-shrink-0 w-[85%] sm:w-auto flex flex-col gap-1.5 rounded-2xl bg-surface-2/60 p-4 ring-1 ring-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-colors hover:bg-surface-2 snap-center">
                        <div className="flex items-center gap-2 text-text font-medium text-[12px] sm:text-sm">
                          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-accent" /> {t.title}
                        </div>
                        <p className="text-[11px] sm:text-xs text-muted leading-relaxed">{t.description}</p>
                      </div>
                    );
                  })}
                </div>

              </div>
            </motion.div>
          </motion.div>
        </div>

        {related.length > 0 && (
          <div className="mt-12 md:mt-20">
            <ProductCarousel
              title="Tal vez te pueda interesar"
              products={related}
              categories={categories}
              variant="showcase"
            />
          </div>
        )}
      </main>

      <div className="[&>footer]:!mt-4 md:[&>footer]:!mt-8">
        <PublicFooter />
      </div>
    </div>
  );
}
