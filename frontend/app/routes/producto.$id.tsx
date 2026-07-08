import { useMemo, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useParams, Link, useLoaderData } from "@remix-run/react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ImageOff, MessageCircle, ShoppingBag, X, ShieldCheck, Check, Bike, Package, Banknote, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PublicHeader } from "~/components/layout/PublicHeader";
import { PublicFooter } from "~/components/layout/PublicFooter";
import { CartFab } from "~/components/cart/CartFab";
import { CartDrawer } from "~/components/cart/CartDrawer";
import { VariantPicker, type VariantSelection } from "~/components/catalog/VariantPicker";
import { TikTokButton } from "~/components/catalog/TikTokButton";
import { Button } from "~/components/ui/Button";
import { useGetConfigQuery, type CatalogDetail } from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
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
  let product: CatalogDetail | null = null;
  try {
    const res = await fetch(`${origin}/api/catalog/${params.id}`);
    if (res.ok) product = (await res.json()) as CatalogDetail;
  } catch {
    /* product queda null → el componente muestra "no encontrado" */
  }
  return { product, url: request.url, origin };
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

export default function ProductDetail() {
  const { id } = useParams();
  // El producto viene del loader SSR (mejor FCP y meta para compartir). Ya no se
  // re-pide en cliente con RTK Query: era un fetch duplicado.
  const { product } = useLoaderData<typeof loader>();
  const [lightbox, setLightbox] = useState(false);
  const dispatch = useAppDispatch();
  const { data: config } = useGetConfigQuery();

  const [activeImage, setActiveImage] = useState(0);
  const [selection, setSelection] = useState<VariantSelection | null>(null);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const [activeTab, setActiveTab] = useState<"desc" | "specs">("desc");
  const [isAdded, setIsAdded] = useState(false);

  const selectedVariant = selection?.variant ?? product?.variants[0];
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

  // Bundles fijos para "Ahorra comprando más" (Fase 3): el % sale del tier que aplica
  // a esa cantidad según la config de mayoreo.
  const bulkBundles = [
    { label: "Tercios", qty: 3 },
    { label: "Media docena", qty: 6 },
    { label: "Docena", qty: 12 },
  ];

  const nextTier = useMemo(() => {
    return discounts.find((d) => d.minQty > qty) ?? null;
  }, [discounts, qty]);

  // Galería: fotos del color seleccionado; si no hay, las generales del producto.
  const gallery = useMemo(() => {
    const byColor = selection?.color ? product?.imagesByColor?.[selection.color] : undefined;
    return byColor && byColor.length ? byColor : product?.images ?? [];
  }, [selection?.color, product?.imagesByColor, product?.images]);

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

  const whatsappUrl = buildWhatsappUrl(
    config?.whatsapp ?? "50585944758",
    `Hola Gyro Store 👋, me interesa: ${selectedVariant ? selectedVariant.name : baseName}`,
  );

  return (
    // Piel "Midnight Neon" del storefront (misma que _index; ver tailwind.css).
    <div data-skin="store" className="flex min-h-dvh flex-col bg-bg font-sans text-text">
      <PublicHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 md:pb-12">
        {/* Migas de pan (breadcrumbs) minimalistas. La columna de la imagen es sticky,
            así que no hace falta un botón "Volver" flotante. */}
        <nav aria-label="Migas de pan" className="mb-6 flex items-center gap-1.5 text-sm text-muted">
          <Link to="/" className="transition-colors hover:text-text">Inicio</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
          <Link to="/" className="transition-colors hover:text-text">Catálogo</Link>
          {baseName && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
              <span className="max-w-[55vw] truncate font-medium text-text/90" aria-current="page">
                {baseName}
              </span>
            </>
          )}
        </nav>

        {!product ? (
          <p className="py-24 text-center text-muted">Producto no encontrado.</p>
        ) : (
          <div className="grid gap-10 md:grid-cols-2 items-start">
            {/* Galería (sticky) */}
            <div className="md:sticky md:top-24 h-fit">
              <div className="relative w-full group/gallery">
                {/* Ambient Glow */}
                <div className="absolute inset-4 -z-10 overflow-hidden rounded-[2rem] filter blur-3xl opacity-25 pointer-events-none transition-all duration-700 scale-95">
                  {gallery[activeImage] ?? gallery[0] ? (
                    <img
                      src={gallery[activeImage] ?? gallery[0]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => (gallery[activeImage] ?? gallery[0]) && setLightbox(true)}
                  onMouseMove={(e) => {
                    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - left) / width) * 100;
                    const y = ((e.clientY - top) / height) * 100;
                    setZoomPos({ x, y });
                  }}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => {
                    setIsHovered(false);
                    setZoomPos({ x: 50, y: 50 });
                  }}
                  className="product-stage group relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-[2rem] p-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  aria-label="Ampliar imagen"
                >
                  <AnimatePresence mode="wait">
                    {gallery[activeImage] ?? gallery[0] ? (
                      <motion.img
                        key={activeImage}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.3 }}
                        src={gallery[activeImage] ?? gallery[0]}
                        alt={baseName}
                        fetchPriority="high"
                        drag={gallery.length > 1 ? "x" : false}
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.4}
                        onDragEnd={(event, info) => {
                          const swipeThreshold = 50;
                          if (info.offset.x < -swipeThreshold) {
                            setActiveImage((prev) => (prev + 1) % gallery.length);
                          } else if (info.offset.x > swipeThreshold) {
                            setActiveImage((prev) => (prev - 1 + gallery.length) % gallery.length);
                          }
                        }}
                        className="h-full w-full object-contain drop-shadow-2xl select-none transition-transform duration-150 ease-out"
                        style={{
                          viewTransitionName: `vt-product-${id}`,
                          transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                          transform: isHovered ? `scale(1.25)` : `scale(1)`,
                        } as React.CSSProperties}
                      />
                    ) : (
                      <motion.div key="empty" className="grid h-full place-items-center text-muted">
                        <ImageOff className="h-12 w-12 opacity-50" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {!inStock && (
                    <span className="absolute left-4 top-4 rounded-pill bg-black/85 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-md shadow-sm">
                      Agotado
                    </span>
                  )}
                </button>
              </div>

              {/* Pagination Dots (Solo móvil para swipe) */}
              {gallery.length > 1 && (
                <div className="mt-4 flex justify-center gap-1.5 md:hidden">
                  {gallery.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveImage(i)}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        i === activeImage ? "w-4 bg-accent" : "w-1.5 bg-border"
                      )}
                      aria-label={`Ir a imagen ${i + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Thumbnails */}
              {gallery.length > 1 && (
                <div className="mt-5 flex flex-wrap gap-3">
                  {gallery.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      className={cn(
                        "relative h-20 w-20 overflow-hidden rounded-2xl border bg-surface-2 transition-all hover:scale-105",
                        i === activeImage ? "border-accent ring-2 ring-accent ring-offset-2 ring-offset-bg opacity-100" : "border-border hover:border-accent/50 opacity-70 hover:opacity-100"
                      )}
                    >
                      <img src={img} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info Columna Derecha */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="flex flex-col"
            >
              <motion.div variants={itemFade}>
                {/* Badges / etiquetas */}
                {product.badges && product.badges.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {product.badges.map((b) => (
                      <span key={b} className="rounded-pill bg-accent/15 px-3 py-1 text-xs font-bold tracking-wide text-accent-2 shadow-sm shadow-accent/5">
                        {b}
                      </span>
                    ))}
                  </div>
                )}

                <h1 className="font-heading text-[clamp(1.9rem,5vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.02em] text-balance text-text">
                  {selectedVariant ? selectedVariant.name : baseName}
                </h1>
              </motion.div>

              <motion.div variants={itemFade} className="mt-5 flex flex-wrap items-baseline gap-4">
                <p className="font-heading text-[clamp(2rem,5vw,2.5rem)] font-bold tabular-nums leading-none text-text">{formatCordobas(unitPrice)}</p>
                {tier ? (
                  <span className="text-lg text-muted line-through">{formatCordobas(price)}</span>
                ) : onSale ? (
                  <span className="text-lg text-muted line-through">{formatCordobas(compareAt)}</span>
                ) : null}
                {tier ? (
                  <span className="rounded-pill bg-whatsapp/12 px-2.5 py-1 text-xs font-semibold tabular-nums tracking-wide text-whatsapp">
                    −{tier.discountPercent}% por {qty} uds
                  </span>
                ) : onSale ? (
                  <span className="rounded-pill bg-bg/70 px-2.5 py-1 text-xs font-semibold tracking-wide text-accent-2 ring-1 ring-white/10 backdrop-blur-md">
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
                {!inStock
                  ? "Agotado"
                  : stockCount <= 5
                    ? `Últimas ${stockCount} unidades`
                    : "Disponible"}
              </motion.p>

              {/* Selector de variantes multi-eje */}
              {product.variants.length > 0 && (
                <motion.div variants={itemFade} className="mt-8">
                  <VariantPicker
                    variants={product.variants}
                    axisLabels={product.axisLabels}
                    onChange={(s) => {
                      setSelection(s);
                      setActiveImage(0);
                    }}
                  />
                </motion.div>
              )}

              {/* Selector de cantidad */}
              <motion.div variants={itemFade} className="mt-8">
                <p className="mb-3 text-sm font-semibold text-text/80">Cantidad</p>
                <div className="flex items-center rounded-2xl border border-border bg-surface-2 p-1 w-fit shadow-sm">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="flex h-10 w-12 items-center justify-center rounded-xl text-lg text-muted transition-colors hover:bg-surface hover:text-text active:scale-95"
                    aria-label="Quitar uno"
                  >
                    −
                  </button>
                  <span className="w-12 text-center text-base font-bold">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => q + 1)}
                    className="flex h-10 w-12 items-center justify-center rounded-xl text-lg text-muted transition-colors hover:bg-surface hover:text-text active:scale-95"
                    aria-label="Agregar uno"
                  >
                    +
                  </button>
                </div>
              </motion.div>

              {/* Bundles de mayoreo: exactamente 3 cards (Tercios / Media docena / Docena) */}
              {discounts.length > 0 && (
                <motion.div variants={itemFade} className="mt-8">
                  <p className="mb-3 text-sm font-semibold flex items-center gap-2 text-text/80">
                    <ShieldCheck className="h-4 w-4 text-accent" /> Ahorra comprando más
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {bulkBundles.map((b) => {
                      const t = discounts.find((d) => b.qty >= d.minQty && (d.maxQty == null || b.qty <= d.maxQty)) ?? null;
                      const pct = t?.discountPercent ?? 0;
                      const u = Math.round(price * (1 - pct / 100));
                      const saved = Math.round((price - u) * b.qty); // ahorro total del bundle (C$)
                      const active = qty === b.qty;
                      return (
                        <motion.button
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          type="button"
                          key={b.qty}
                          onClick={() => setQty(b.qty)}
                          className={cn(
                            "relative flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all overflow-hidden",
                            active
                              ? "border-accent bg-accent/5 ring-1 ring-accent shadow-md shadow-accent/10"
                              : "border-border hover:border-accent/30 bg-surface-2",
                          )}
                        >
                          <span className={cn("text-xs font-semibold uppercase tracking-wide", active ? "text-accent" : "text-muted")}>{b.label}</span>
                          <span className="mt-0.5 text-[10px] text-muted">{b.qty} unidades</span>
                          <span className="mt-1.5 font-heading text-xl font-bold text-text">{formatCordobas(u)}</span>
                          <span className="text-[10px] font-medium text-muted">por unidad</span>
                          {saved > 0 ? (
                            <div className="mt-2 w-full rounded-md bg-accent/12 py-1 text-[11px] font-bold tabular-nums text-accent-2">
                              Ahorras {formatCordobas(saved)}
                            </div>
                          ) : (
                            <div className="mt-2 w-full py-1 text-[11px] font-medium text-muted/70">Precio normal</div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Banner de Upsell dinámico */}
                  {discounts.length > 0 && (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 flex items-center gap-2.5 rounded-2xl bg-accent/10 border border-accent/20 px-4.5 py-3 text-sm text-accent-2"
                    >
                      <TrendingUp className="h-4 w-4 shrink-0" />
                      <p className="leading-snug font-medium">
                        {nextTier ? (
                          <>
                            Agregá <span className="font-bold text-white">{nextTier.minQty - qty} {nextTier.minQty - qty === 1 ? "unidad" : "unidades"}</span> más para ahorrar un <span className="font-bold text-white">{nextTier.discountPercent}%</span> por unidad.
                          </>
                        ) : (
                          <>
                            ¡Felicidades! Estás aprovechando el descuento máximo del <span className="font-bold text-white">{tier?.discountPercent}%</span> por unidad.
                          </>
                        )}
                      </p>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Botones de acción principales */}
              <motion.div variants={itemFade} className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Button
                  className={cn(
                    "ease-expo flex-1 h-14 rounded-2xl text-base transition duration-300 hover:-translate-y-0.5 active:scale-95",
                    isAdded && "bg-whatsapp hover:bg-whatsapp border-transparent text-white",
                  )}
                  onClick={add}
                  disabled={!inStock}
                >
                  {isAdded ? (
                    <>
                      <Check className="h-5 w-5 mr-2 animate-bounce" /> ¡Agregado con éxito!
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="h-5 w-5 mr-2" /> Agregar al carrito
                    </>
                  )}
                </Button>
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex-1">
                  <Button
                    variant="whatsapp"
                    className="ease-expo w-full h-14 rounded-2xl text-base transition duration-300 hover:-translate-y-0.5 active:scale-95"
                  >
                    <MessageCircle className="h-5 w-5 mr-2" /> Consultar por WhatsApp
                  </Button>
                </a>
              </motion.div>

              {/* Trust Box: envíos y garantía consolidados (reemplaza textos sueltos) */}
              <motion.div variants={itemFade} className="mt-6 space-y-3 rounded-2xl bg-surface-2/50 p-5">
                <div className="flex items-center gap-3">
                  <Bike className="h-5 w-5 shrink-0 text-accent" />
                  <p className="text-sm text-muted">
                    <span className="font-semibold text-text">Delivery en Managua</span> (costo extra)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 shrink-0 text-accent" />
                  <p className="text-sm text-muted">
                    Envíos a departamentos por <span className="font-semibold text-text">Cargo Trans</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Banknote className="h-5 w-5 shrink-0 text-accent" />
                  <p className="text-sm text-muted">
                    <span className="font-semibold text-text">Pago contra entrega</span>: efectivo o transferencia
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-accent" />
                  <p className="text-sm text-muted">
                    <span className="font-semibold text-text">Garantía de 1 mes</span> por defectos de fábrica
                  </p>
                </div>
              </motion.div>

              {/* Contenedor Unificado en Pestañas */}
              <motion.div variants={itemFade} className="mt-12 rounded-3xl border border-border/60 bg-surface-2/40 p-6 sm:p-8">
                {/* Cabecera de pestañas */}
                <div className="flex border-b border-border/40 pb-px mb-6 overflow-x-auto scrollbar-none gap-6">
                  <button
                    type="button"
                    onClick={() => setActiveTab("desc")}
                    className={cn(
                      "relative pb-3 text-sm font-semibold transition-colors focus-visible:outline-none cursor-pointer",
                      activeTab === "desc" ? "text-text" : "text-muted hover:text-text"
                    )}
                  >
                    <span>Descripción</span>
                    {activeTab === "desc" && (
                      <motion.div
                        layoutId="activeTabUnderline"
                        className="absolute bottom-0 inset-x-0 h-0.5 bg-accent"
                      />
                    )}
                  </button>
                  {product.specs && product.specs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("specs")}
                      className={cn(
                        "relative pb-3 text-sm font-semibold transition-colors focus-visible:outline-none cursor-pointer",
                        activeTab === "specs" ? "text-text" : "text-muted hover:text-text"
                      )}
                    >
                      <span>Especificaciones</span>
                      {activeTab === "specs" && (
                        <motion.div
                          layoutId="activeTabUnderline"
                          className="absolute bottom-0 inset-x-0 h-0.5 bg-accent"
                        />
                      )}
                    </button>
                  )}
                </div>

                {/* Contenido de las pestañas con animación de desvanecimiento */}
                <AnimatePresence mode="wait">
                  {activeTab === "desc" && (
                    <motion.div
                      key="desc"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="text-sm md:text-base leading-relaxed text-muted whitespace-pre-wrap focus:outline-none"
                    >
                      {product.description ? (
                        <div dangerouslySetInnerHTML={{ __html: product.description.replace(/\n/g, '<br/>') }} />
                      ) : (
                        "No hay descripción disponible para este producto."
                      )}
                      
                      {product.tiktokUrl && (
                        <div className="mt-8 pt-6 border-t border-border/50">
                          <p className="mb-4 text-xs font-bold text-text uppercase tracking-wider flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" /> Ver en acción
                          </p>
                          <TikTokButton url={product.tiktokUrl} />
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === "specs" && product.specs && product.specs.length > 0 && (
                    <motion.div
                      key="specs"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="focus:outline-none"
                    >
                      <table className="w-full text-sm">
                        <tbody>
                          {product.specs.map((s: any, i: number) => (
                            <tr key={i} className="group border-b border-border/40 last:border-0 hover:bg-surface/40 transition-colors">
                              <td className="py-3.5 pr-4 text-muted whitespace-nowrap">{s.label}</td>
                              <td className="py-3.5 font-semibold text-text text-right break-words">{s.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </motion.div>
                  )}

                </AnimatePresence>
              </motion.div>
            </motion.div>
          </div>
        )}
      </main>

      {/* Barra de compra fija (solo móvil) */}
      {product && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-border bg-bg/95 px-4 py-3 pr-20 backdrop-blur-xl md:hidden shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)]">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-muted">{selectedVariant ? selectedVariant.name : baseName}</p>
            <p className="font-heading text-xl font-bold tabular-nums text-text">{formatCordobas(unitPrice)}</p>
          </div>
          <Button onClick={add} disabled={!inStock} className="shrink-0 rounded-xl px-5">
            <ShoppingBag className="h-4 w-4 mr-1.5" /> {inStock ? "Agregar" : "Agotado"}
          </Button>
        </div>
      )}

      {/* Lightbox de imagen */}
      <AnimatePresence>
        {lightbox && (gallery[activeImage] ?? gallery[0]) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(false)}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm"
          >
            <button
              onClick={() => setLightbox(false)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2.5 text-white transition-all hover:bg-white/20 hover:scale-105 active:scale-95"
            >
              <X className="h-6 w-6" />
            </button>
            <motion.img
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              src={gallery[activeImage] ?? gallery[0]}
              alt={baseName}
              className="max-h-[90vh] max-w-[90vw] object-contain drop-shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <PublicFooter />
      <CartFab />
      <CartDrawer />
    </div>
  );
}
