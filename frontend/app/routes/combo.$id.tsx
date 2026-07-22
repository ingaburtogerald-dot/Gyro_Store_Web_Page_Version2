// Detalle de un combo (/combo/:id). SSR para que el preview al compartir tenga
// foto/título/precio. Muestra los 2 productos del paquete, el ahorro frente a
// comprarlos por separado, y "Agregar combo" (línea atómica en el carrito).
import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useLoaderData, useNavigate } from "@remix-run/react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, ImageOff, Sparkles, ShoppingCart, Check, Bike, Package, Banknote, ShieldCheck, Share2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { CategoriesDrawer } from "~/components/layout/CategoriesDrawer";
import { PublicFooter } from "~/components/layout/PublicFooter";
import { PublicHeader } from "~/components/layout/PublicHeader";
import { ProductCarousel } from "~/components/product/ProductCarousel";
import { MobileStoreActions } from "~/components/layout/MobileStoreActions";
import { SocialLinksStrip } from "~/components/catalog/SocialLinksStrip";
import { Button } from "~/components/ui/Button";
import type { Combo, CatalogProduct, Category } from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
import { comboToCartItem } from "~/lib/combo";
import { formatCordobas, cn, buildWhatsappUrl } from "~/lib/utils";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.471-1.761-1.643-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

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
  let config: any = null;
  try {
    const [cRes, listRes, confRes] = await Promise.all([
      fetch(`${origin}/api/combos/${actualId}`),
      fetch(`${origin}/api/catalog`),
      fetch(`${origin}/api/config`),
    ]);
    if (cRes.ok) combo = (await cRes.json()) as Combo;
    if (listRes.ok) catalog = (await listRes.json()) as CatalogProduct[];
    if (confRes.ok) {
      config = await confRes.json();
      categories = config.categories ?? [];
    }
  } catch {
    /* combo queda null → el componente muestra "no encontrado" */
  }
  return { combo, catalog, categories, config, url: request.url, origin };
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
  const { combo, catalog, categories, config, url } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [isAdded, setIsAdded] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);

  const whatsappUrl = buildWhatsappUrl(
    config?.whatsapp ?? "50585944758",
    `Hola Gyro Store 👋, quiero comprar el combo: ${combo?.name} — Total: ${formatCordobas(combo?.price || 0)}. ${url}`,
  );

  const share = useCallback(async () => {
    if (!combo) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: combo.name, text: `Mira este combo en Gyro Store: ${combo.name}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Enlace copiado al portapapeles");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        await navigator.clipboard.writeText(url);
        toast.success("Enlace copiado al portapapeles");
      }
    }
  }, [combo, url]);

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
    <div className="flex flex-col font-sans text-text">
      <main className="mx-auto w-full max-w-6xl flex-1 px-0 md:px-4 pt-6 pb-0 md:pb-4">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 ml-4 md:ml-0 self-start inline-flex items-center gap-1.5 text-[13px] font-semibold text-text transition-all bg-surface-2/60 hover:bg-surface-2 border border-white/5 rounded-full px-3 py-1.5 shadow-sm hover:shadow-md hover:border-white/10"
        >
          <ChevronLeft className="h-4 w-4 text-accent" />
          Atrás
        </button>

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
              <div className="flex items-start justify-between gap-4">
                <h1 className="font-heading text-2xl sm:text-[clamp(2rem,5.5vw,3.25rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-balance text-text">
                  {combo.name}
                </h1>
                <button
                  type="button"
                  onClick={share}
                  aria-label="Compartir combo"
                  className="mt-2 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2/60 text-muted transition-colors hover:bg-surface hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2/50"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
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

                <div className="mb-0">
                  <Button
                    variant="primary"
                    onClick={addToCart}
                    className={cn("w-full overflow-hidden h-12", isAdded && "bg-whatsapp hover:bg-whatsapp border-transparent text-zinc-950")}
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

                {/* CTA secundario (WhatsApp) */}
                <div className="mb-0 flex">
                  <Button
                    variant="whatsapp"
                    className="w-full h-12"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <WhatsAppIcon className="h-5 w-5 shrink-0" />
                    <span>Comprar combo por WhatsApp</span>
                  </Button>
                </div>

                {/* Trust Box */}
                <div className="mt-0 flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 gap-3 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {TRUST_ITEMS.map((t) => {
                    const Icon = t.icon;
                    return (
                      <div key={t.title} className="flex-shrink-0 w-[85%] sm:w-auto flex flex-col gap-1 sm:gap-1.5 rounded-xl sm:rounded-2xl bg-surface-2/60 p-3 sm:p-4 ring-1 ring-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-colors hover:bg-surface-2 snap-center">
                        <div className="flex items-center gap-1.5 sm:gap-2 text-text font-medium text-[11px] sm:text-sm">
                          <Icon className="h-3 w-3 sm:h-4 sm:w-4 text-accent" /> {t.title}
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted leading-tight sm:leading-relaxed">{t.description}</p>
                      </div>
                    );
                  })}
                </div>

              </div>
            </motion.div>
          </motion.div>
        </div>

        {related.length > 0 && (
          <div className="border-t border-white/5 md:mt-8 -mb-4">
            <div className="md:hidden mt-6 mb-[-1rem]">
              <SocialLinksStrip />
            </div>
            <MobileStoreActions />
            <ProductCarousel
              title="Tal vez te pueda interesar"
              products={related}
              categories={categories}
              variant="showcase"
            />
          </div>
        )}
      </main>

      {/* Botonera flotante inferior (Mobile sticky buy bar) */}
      {!footerVisible && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg/80 border-t border-border/40 p-3 backdrop-blur-md flex gap-2 animate-in fade-in slide-in-from-bottom duration-300">
          <Button
            variant="primary"
            onClick={addToCart}
            className={cn("flex-1 h-10 overflow-hidden", isAdded && "bg-whatsapp hover:bg-whatsapp border-transparent text-[#000000]")}
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

          <Button
            variant="whatsapp"
            size="sm"
            className="shrink-0 h-10 w-10 p-0"
            aria-label="Comprar por WhatsApp"
            onClick={(e) => {
              e.preventDefault();
              window.open(whatsappUrl, "_blank", "noopener,noreferrer");
            }}
          >
            <WhatsAppIcon className="h-5 w-5 shrink-0" />
          </Button>
        </div>
      )}

      <div className="[&>footer]:!mt-4 md:[&>footer]:!mt-8" id="public-footer">
        <PublicFooter />
      </div>
    </div>
  );
}
