import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useParams, useLoaderData, useNavigate } from "@remix-run/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ShoppingCart,
  ShieldCheck,
  Check,
  Bike,
  Package,
  Banknote,
  Share2,
  Sparkles,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PublicFooter } from "~/components/layout/PublicFooter";
import { CategoriesDrawer } from "~/components/layout/CategoriesDrawer";
import { PublicHeader } from "~/components/layout/PublicHeader";
import { VariantPicker, type VariantSelection } from "~/components/product/VariantPicker";
import { TikTokButton } from "~/components/product/TikTokButton";
import { Button } from "~/components/ui/Button";
import { VolumePriceCard } from "~/components/product/VolumePriceCard";
import { FrequentlyBoughtTogetherCard } from "~/components/product/FrequentlyBoughtTogetherCard";
import { ProductGalleryGrid } from "~/components/catalog/ProductGalleryGrid";
import { ProductSpecs } from "~/components/catalog/ProductSpecs";
import { MobileStoreActions } from "~/components/layout/MobileStoreActions";
import { SocialLinksStrip } from "~/components/catalog/SocialLinksStrip";
import { ProductCarousel } from "~/components/product/ProductCarousel";
import {
  useGetConfigQuery,
  useGetCombosByProductQuery,
  type CatalogDetail,
  type CatalogProduct,
  type Category,
} from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
import { comboToCartItem } from "~/lib/combo";
import { formatCordobas, buildWhatsappUrl, cn } from "~/lib/utils";

// Carga el producto en el servidor para que el preview al compartir (WhatsApp/redes)
// tenga foto, título y precio. El bot de WhatsApp no ejecuta JS, así que el meta
// debe estar en el HTML renderizado por el servidor.
// Cache HTTP de la página de producto (pública): 60s + stale-while-revalidate.
export const headers: HeadersFunction = () => ({
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
});

export async function loader({ params, request }: LoaderFunctionArgs) {
  const origin = new URL(request.url).origin;
  const rawId = params.id || "";
  const idParts = rawId.split("--");
  const actualId = idParts[idParts.length - 1]; // Toma solo el ID de Firebase

  let product: CatalogDetail | null = null;
  let catalog: CatalogProduct[] = [];
  let categories: Category[] = [];
  try {
    // Producto + catálogo + categorías en paralelo: el catálogo alimenta el
    // carrusel de relacionados ("Tal vez te pueda interesar").
    const [pRes, listRes, cRes] = await Promise.all([
      fetch(`${origin}/api/catalog/${actualId}`),
      fetch(`${origin}/api/catalog`),
      fetch(`${origin}/api/config`),
    ]);
    if (pRes.ok) product = (await pRes.json()) as CatalogDetail;
    if (listRes.ok) catalog = (await listRes.json()) as CatalogProduct[];
    if (cRes.ok) categories = ((await cRes.json()) as { categories?: Category[] }).categories ?? [];
  } catch {
    /* product queda null → el componente muestra "no encontrado" */
  }
  return { product, catalog, categories, url: request.url, origin };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const p = data?.product;
  if (!p) return [{ title: "Producto · Gyro Store" }];
  const img = p.images?.[0] || `${data!.origin}/logo.jpg`;
  const title = `${p.name} · Gyro Store`;
  const description =
    (p.description && String(p.description).slice(0, 160)) ||
    `Comprá ${p.name} en Gyro Store, Managua. Envío local y pago contra entrega.`;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "product" },
    { property: "og:site_name", content: "Gyro Store" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: img },
    { property: "og:url", content: data!.url },
    { property: "product:price:amount", content: String(p.price ?? "") },
    { property: "product:price:currency", content: "NIO" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: img },
    {
      "script:ld+json": {
        "@context": "https://schema.org/",
        "@type": "Product",
        name: p.name,
        image: p.images ?? [],
        description,
        offers: {
          "@type": "Offer",
          priceCurrency: "NIO",
          price: p.price ?? 0,
          availability: (p.stock ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        },
      },
    },
  ];
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemFade = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0 }
};

// Trust box (delivery/pago/garantía): se renderiza dos veces con distinta
// posición según breakpoint (bajo la galería en desktop, tras el bloque de
// compra en móvil) — un solo arreglo de datos evita duplicar el JSX de cada card.
const TRUST_ITEMS: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: Bike, title: "Delivery en Managua", description: "Servicio con costo extra para recibir tu producto." },
  { icon: Package, title: "Envíos a departamentos por Cargo Trans", description: "Envíos seguros a todo el país." },
  { icon: Banknote, title: "Pago contra entrega", description: "Paga en efectivo o transferencia al recibir tu producto." },
  { icon: ShieldCheck, title: "Garantía de 1 mes", description: "Cobertura por defectos de fábrica." },
];

type ProductTab = "detalles" | "specs";

// Ícono de WhatsApp (trazo propio, no está en lucide-react): reutilizado tanto en
// el CTA inline (desktop) como en la barra fija (móvil) para que ambos se vean
// consistentes — antes estaba duplicado inline en un solo lugar.
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.471-1.761-1.643-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  // El producto viene del loader SSR (mejor FCP y meta para compartir). Ya no se
  // re-pide en cliente con RTK Query: era un fetch duplicado.
  const { product, catalog, categories, url } = useLoaderData<typeof loader>();
  const dispatch = useAppDispatch();
  const { data: config } = useGetConfigQuery();
  // Esta ficha no monta PublicHeader (tiene su propio breadcrumb) — sin esto, un
  // usuario móvil no tenía forma de elegir OTRA categoría desde acá, solo "Catálogo"
  // (todo el catálogo sin filtrar). Mismo drawer que usa PublicHeader.
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // Estado UI
  const [selection, setSelection] = useState<VariantSelection | null>(null);
  const [activeTab, setActiveTab] = useState<ProductTab>("detalles");
  const [isAdded, setIsAdded] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const tabRefs = useRef<Partial<Record<ProductTab, HTMLButtonElement | null>>>({});

  useEffect(() => {
    const el = document.getElementById("public-footer");
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      setFooterVisible(entry.isIntersecting);
    }, { rootMargin: "0px 0px 50px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const selectedVariant = selection?.variant ?? product?.variants?.[0];
  const baseName = product?.name ?? "";
  const price = selectedVariant?.price ?? product?.price ?? 0;
  const inStock = selection ? selection.inStock : (product?.stock ?? 0) > 0;
  const stockCount = selectedVariant?.stock ?? product?.stock ?? 0;
  const compareAt = product?.compareAtPrice ?? 0;
  const onSale = compareAt > price;

  // ── Precio por cantidad (descuento por mayor) ──
  const [qty, setQty] = useState(1);
  const discounts = useMemo(
    () => [...(config?.wholesaleDiscounts ?? [])].sort((a, b) => a.minQty - b.minQty),
    [config],
  );
  const tier = useMemo(
    () => discounts.find((d) => qty >= d.minQty && (d.maxQty == null || qty <= d.maxQty)) ?? null,
    [discounts, qty],
  );
  const unitPrice = Math.round(price * (1 - (tier?.discountPercent ?? 0) / 100));
  const savings = (price - unitPrice) * qty;

  // Bundles fijos para "Ahorra comprando más" (Fase 3): el % sale del tier que aplica
  // a esa cantidad según la config de mayoreo.
  const bulkBundles = [
    { label: "Tercios", qty: 3 },
    { label: "Media docena", qty: 6 },
    { label: "Docena", qty: 12 },
  ];

  // Galería: fotos del color seleccionado; si no hay, las generales del producto.
  const gallery = useMemo(() => {
    const byColor = selection?.color ? product?.imagesByColor?.[selection.color] : undefined;
    return byColor && byColor.length ? byColor : product?.images ?? [];
  }, [selection?.color, product?.imagesByColor, product?.images]);

  // Relacionados ("Tal vez te pueda interesar"): misma categoría, excluyendo el
  // producto actual; si hay pocos, se rellena con otros del catálogo.
  const related = useMemo(() => {
    if (!product) return [];
    const others = catalog.filter((p) => p.id !== product.id);
    const sameCat = others.filter((p) => p.category === product.category);
    return (sameCat.length >= 4 ? sameCat : others).slice(0, 12);
  }, [catalog, product]);

  // Combo real ("Comprados juntos frecuentemente"): solo se muestra si este
  // producto pertenece a un combo publicado — nunca un "relacionado" cualquiera.
  // El endpoint público ya filtra activos y armables (sin productos borrados).
  const { data: productCombos } = useGetCombosByProductQuery(product?.id ?? "", { skip: !product });
  const combo = productCombos?.[0] ?? null;

  // Pestañas Detalles/Especificaciones
  const tabs = useMemo(() => {
    const t: { value: ProductTab; label: string }[] = [{ value: "detalles", label: "Detalles" }];
    const hasSpecs = (product?.specs?.length ?? 0) > 0;
    const hasDesc = !!product?.description;
    const hasTiktok = !!product?.tiktokUrl;
    if (hasSpecs || hasDesc || hasTiktok) {
      t.push({ value: "specs", label: "Especificaciones" });
    }
    return t;
  }, [product?.specs, product?.description, product?.tiktokUrl]);
  const effectiveTab: ProductTab = tabs.some((t) => t.value === activeTab) ? activeTab : "detalles";

  function handleTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (tabs.length < 2 || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    e.preventDefault();
    const idx = tabs.findIndex((t) => t.value === effectiveTab);
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(idx + dir + tabs.length) % tabs.length];
    setActiveTab(next.value);
    tabRefs.current[next.value]?.focus();
  }

  function add() {
    if (!product || !selectedVariant) return;
    dispatch(
      addItem({
        catalogId: product.id,
        variantId: selectedVariant.id,
        name: selectedVariant.name || baseName,
        variantName: selectedVariant.variantName || "Estándar",
        price: unitPrice,
        image: gallery[0] || product.images?.[0] || "",
        quantity: qty,
      }),
    );
    dispatch(openCart());
    toast.success(`Agregado al carrito (${qty} ud${qty > 1 ? "s" : ""})`);
    
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  }

  // Mensaje con precio + link a la ficha: el vendedor cotiza sin ida y vuelta.
  // URL de la página desde el loader (igual en SSR y cliente) — antes usaba
  // window.location.href, que en SSR era "" y en cliente la URL real: eso disparaba
  // un hydration mismatch en el href del link de WhatsApp en cada ficha.
  const pageUrl = url;
  const whatsappUrl = buildWhatsappUrl(
    config?.whatsapp ?? "50585944758",
    `Hola Gyro Store 👋, quiero: ${qty}x ${selectedVariant ? selectedVariant.name : baseName} — Total: ${formatCordobas(unitPrice * qty)}. ${pageUrl}`,
  );

  // Compartir: Web Share API nativa; si no existe, copia el enlace.
  const share = useCallback(async () => {
    const titleToShare = selectedVariant ? selectedVariant.name : baseName;
    try {
      if (navigator.share) {
        await navigator.share({ title: titleToShare, text: `Mira este producto en Gyro Store: ${titleToShare}`, url: pageUrl });
      } else {
        await navigator.clipboard.writeText(pageUrl);
        toast.success("Enlace copiado al portapapeles");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        await navigator.clipboard.writeText(pageUrl);
        toast.success("Enlace copiado al portapapeles");
      }
    }
  }, [selectedVariant, baseName, pageUrl]);

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

        {!product ? (
          <p className="py-24 text-center text-muted">Producto no encontrado.</p>
        ) : (
          <div className="grid gap-4 md:gap-10 md:grid-cols-[1.1fr_1fr] lg:grid-cols-[1.3fr_1fr] items-start">
            {/* Columna izquierda: galería.
                min-w-0: en un grid, los items traen `min-width:auto` y NO encogen bajo
                su min-content. Sin esto, cualquier hijo con min-content ancho (el Trust
                Box con bleed negativo) estira la columna y desborda el viewport en móvil
                (scroll horizontal fantasma). min-w-0 deja que la pista mande. */}
            <div className="flex flex-col gap-6 min-w-0">
              <ProductGalleryGrid
                gallery={gallery}
                baseName={baseName}
                inStock={inStock}
                productId={id!}
              />
            </div>

            {/* Info Columna Derecha (Sticky) */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="flex flex-col md:sticky md:top-24 pb-0 md:pb-8 min-w-0"
            >
              <motion.div variants={itemFade}>
                {/* Badges / etiquetas */}
                {product.badges && product.badges.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {product.badges.map((b) => (
                      <span key={b} className="rounded-pill bg-accent/15 px-3 py-1 text-xs font-bold tracking-wide text-accent-2 ring-1 ring-accent/20">
                        {b}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-start justify-between gap-4">
                  <h1 className="font-heading text-2xl sm:text-[clamp(2rem,5.5vw,3.25rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-balance text-text">
                    {selectedVariant ? selectedVariant.name : baseName}
                  </h1>
                  <button
                    type="button"
                    onClick={share}
                    aria-label="Compartir producto"
                    className="mt-2 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2/60 text-muted transition-colors hover:bg-surface hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2/50"
                  >
                    <Share2 className="h-5 w-5" />
                  </button>
                </div>
              </motion.div>

              <motion.div variants={itemFade} className="mt-5 flex flex-wrap items-baseline gap-4">
                <p className="font-heading text-3xl sm:text-[clamp(2.5rem,6vw,3rem)] font-bold tabular-nums leading-none text-accent drop-shadow-[0_0_15px_rgba(var(--color-accent),0.4)] animate-[pulse_3s_ease-in-out_infinite]">{formatCordobas(unitPrice)}</p>
                {tier ? (
                  <span className="text-base sm:text-lg text-muted line-through">{formatCordobas(price)}</span>
                ) : onSale ? (
                  <span className="text-base sm:text-lg text-muted line-through">{formatCordobas(compareAt)}</span>
                ) : null}
                {tier ? (
                  <span className="rounded-pill bg-whatsapp/12 px-2.5 py-1 text-[11px] sm:text-xs font-semibold tabular-nums tracking-wide text-whatsapp">
                    −{tier.discountPercent}% por {qty} uds
                  </span>
                ) : onSale ? (
                  <span className="rounded-pill bg-bg/70 px-2.5 py-1 text-[11px] sm:text-xs font-semibold tracking-wide text-accent-2 ring-1 ring-white/10 backdrop-blur-md">
                    En oferta
                  </span>
                ) : null}
              </motion.div>

              {qty > 1 && (
                <motion.p variants={itemFade} className="mt-2 text-sm text-muted">
                  Total {qty} uds: <span className="font-bold text-text">{formatCordobas(unitPrice * qty)}</span>
                </motion.p>
              )}
              
              <motion.p
                variants={itemFade}
                className={cn(
                  "mt-3 inline-flex items-center gap-2 text-sm font-medium",
                  !inStock ? "text-danger" : stockCount <= 5 ? "text-warning" : "text-muted",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    !inStock ? "bg-danger" : stockCount <= 5 ? "bg-warning" : "bg-whatsapp",
                  )}
                />
                <span>
                  {!inStock
                    ? "Agotado"
                    : stockCount <= 5
                      ? `Últimas ${stockCount} unidade${stockCount === 1 ? '' : 's'}`
                      : `${stockCount} unidades disponibles`}
                </span>
              </motion.p>

              {/* Selector de variantes multi-eje movido fuera de las pestañas */}
              {product.variants?.length > 0 && (
                <motion.div variants={itemFade} className="mt-6">
                  <VariantPicker
                    variants={product.variants}
                    axisLabels={product.axisLabels}
                    colorAxisIndex={product.colorAxisIndex}
                    templateAxes={product.templateAxes}
                    onChange={(s) => {
                      setSelection(s);
                    }}
                  />
                </motion.div>
              )}

              {/* Pestañas: Compra vs Especificaciones */}
              {tabs.length > 1 && (
                <div
                  role="tablist"
                  aria-label="Navegación del producto"
                  className="mt-8 mb-2 flex items-center gap-6 border-b border-border/60"
                >
                  {tabs.map((t) => (
                    <button
                      key={t.value}
                      ref={(el) => {
                        tabRefs.current[t.value] = el;
                      }}
                      type="button"
                      role="tab"
                      id={`pdp-tab-${t.value}`}
                      aria-selected={effectiveTab === t.value}
                      aria-controls={`pdp-panel-${t.value}`}
                      tabIndex={effectiveTab === t.value ? 0 : -1}
                      onClick={() => setActiveTab(t.value)}
                      onKeyDown={handleTabKeyDown}
                      className={cn(
                        "ease-expo relative pb-3 text-[12px] sm:text-sm font-semibold transition-colors focus-visible:outline-none",
                        effectiveTab === t.value ? "text-text" : "text-muted hover:text-text",
                      )}
                    >
                      {t.label}
                      {effectiveTab === t.value && (
                        <motion.span
                          layoutId="pdp-tab-indicator"
                          className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent"
                          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Pestaña: Detalles (Compra y Variantes) */}
              <div
                id="pdp-panel-detalles"
                role="tabpanel"
                hidden={effectiveTab !== "detalles"}
                className="flex flex-col"
              >
                {/* Contenedor Unificado: Diseño Apilado */}
                <motion.div variants={itemFade} className="card-premium mt-4 flex flex-col gap-6 rounded-2xl p-4 sm:gap-10 sm:p-8">
                  
                  {/* 1. Opciones de Compra */}
                <div className="flex flex-col focus:outline-none">
                  {/* Selector de cantidad y Agregar al carrito */}
                  <div className="mb-6 sm:mb-8">
                    <p className="mb-3 text-[12px] sm:text-sm font-semibold text-text">Cantidad</p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center rounded-lg border border-border bg-surface-2 p-1 w-fit shadow-sm shrink-0">
                        <button
                          type="button"
                          onClick={() => setQty((q) => Math.max(1, q - 1))}
                          className="flex h-8 w-10 sm:h-10 sm:w-12 items-center justify-center rounded-md text-base sm:text-lg text-muted transition-colors hover:bg-surface hover:text-text active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          aria-label="Quitar uno"
                        >
                          −
                        </button>
                        <span className="w-10 sm:w-12 text-center text-sm sm:text-base font-bold">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty((q) => q + 1)}
                          className="flex h-8 w-10 sm:h-10 sm:w-12 items-center justify-center rounded-md text-base sm:text-lg text-muted transition-colors hover:bg-surface hover:text-text active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          aria-label="Agregar uno"
                        >
                          +
                        </button>
                      </div>

                      <Button
                        variant="primary"
                        onClick={add}
                        disabled={!inStock}
                        className={cn("flex-1 h-10 sm:h-12 overflow-hidden", isAdded && "bg-whatsapp hover:bg-whatsapp border-transparent text-[#000000]")}
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
                            {isAdded ? "¡Agregado!" : inStock ? "Agregar al carrito" : "Agotado"}
                          </motion.span>
                        </AnimatePresence>
                      </Button>
                    </div>
                  </div>

                  {/* Bundles de mayoreo */}
                  {discounts.length > 0 && (
                    <div className="mb-6 sm:mb-8 flex flex-col gap-3">
                      <p className="text-[12px] sm:text-sm font-semibold flex items-center gap-2 text-text">
                        <ShieldCheck className="h-4 w-4 text-accent" /> Ahorra comprando más
                      </p>
                      
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {bulkBundles.map((b) => {
                          const t = discounts.find((d) => b.qty >= d.minQty && (d.maxQty == null || b.qty <= d.maxQty)) ?? null;
                          return (
                            <div key={b.qty}>
                              <VolumePriceCard
                                label={b.label}
                                qty={b.qty}
                                active={qty === b.qty}
                                basePrice={price}
                                tier={t}
                                onClick={() => setQty(b.qty)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* CTA secundario (WhatsApp) */}
                  <div className="mb-0 flex">
                    <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex-1">
                      <Button
                        variant="whatsapp"
                        className="w-full h-12"
                      >
                        <WhatsAppIcon className="h-5 w-5 shrink-0" />
                        <span>Comprar al por mayor por WhatsApp</span>
                      </Button>
                    </a>
                  </div>

                  {/* Venta cruzada: SOLO si el producto pertenece a un combo real
                      publicado (nunca un "relacionado" arbitrario), con el precio
                      real del paquete. */}
                  {combo && (
                    <div className="mb-0">
                      <FrequentlyBoughtTogetherCard
                        combo={combo}
                        mainProductId={product.id}
                        onAdd={() => {
                          dispatch(addItem(comboToCartItem(combo)));
                          dispatch(openCart());
                          toast.success("Combo agregado al carrito");
                        }}
                      />
                    </div>
                  )}

                  {/* Trust Box (Móvil Slider, Desktop Grid) */}
                  {/* Bleed a los bordes del card: el margen negativo DEBE igualar el
                      padding del card (p-4 = 1rem en móvil). Antes -mx-6 (1.5rem) contra
                      p-4 sobresalía 0.5rem por lado y, sumado al min-width:auto del grid,
                      empujaba el ancho de la página a 589px. -mx-4 px-4 encaja exacto. */}
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
              </div> {/* Fin de pdp-panel-detalles */}

              {/* Pestaña: Especificaciones */}
              <div
                id="pdp-panel-specs"
                role="tabpanel"
                hidden={effectiveTab !== "specs"}
                className="mt-6 flex flex-col"
              >
                {product?.description && (
                  <div className="mb-10">
                    <h3 className="text-lg font-bold mb-6 text-text flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-accent" />
                      Acerca del producto
                    </h3>
                    <div className="max-w-[65ch] space-y-6">
                      {(Array.isArray(product.description) ? product.description : String(product.description).split(/\n+/)).filter(Boolean).map((paragraph: string, idx: number) => (
                        <div
                          key={idx}
                          className="text-pretty text-sm sm:text-base font-medium leading-relaxed text-muted [&>p]:mb-4 last:[&>p]:mb-0"
                          dangerouslySetInnerHTML={{ __html: paragraph }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {product?.tiktokUrl && (
                  <div className="mb-10 pt-2 border-t border-border/50">
                    <p className="mb-4 text-xs font-bold text-text uppercase tracking-wider flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-accent animate-pulse" /> Ver en acción
                    </p>
                    <TikTokButton url={product.tiktokUrl} />
                  </div>
                )}

                {(product?.specs?.length ?? 0) > 0 && (
                  <div>
                    <ProductSpecs specs={product.specs} />
                  </div>
                )}
              </div>

            </motion.div>
          </div>
        )}

        {product && related.length > 0 && (
          <div className="border-t border-white/5 md:mt-8 -mb-4">
            <div className="md:hidden mt-6 mb-[-1rem]">
              <SocialLinksStrip />
            </div>
            {/* The mobile action buttons (moved from footer) */}
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

      {/* Ajustamos los márgenes del footer con Tailwind arbitrario para:
          1. Eliminar el espacio muerto arriba (!mt-4) */}
      <div className="[&>footer]:!mt-4 md:[&>footer]:!mt-8">
        <PublicFooter />
      </div>
    </div>
  );
}
