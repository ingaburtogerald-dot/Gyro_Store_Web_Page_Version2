import { useMemo, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useParams, Link, useLoaderData } from "@remix-run/react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ImageOff, MessageCircle, ShoppingCart, ShoppingBag, X, ShieldCheck, Check, Bike, Package, Banknote, TrendingUp, Share2, Sparkles, List } from "lucide-react";
import { toast } from "sonner";
import { PublicHeader } from "~/components/layout/PublicHeader";
import { PublicFooter } from "~/components/layout/PublicFooter";
import { VariantPicker, type VariantSelection } from "~/components/product/VariantPicker";
import { TikTokButton } from "~/components/product/TikTokButton";
import { Button } from "~/components/ui/Button";
import { VolumePriceCard } from "~/components/product/VolumePriceCard";
import { FrequentlyBoughtTogetherCard } from "~/components/product/FrequentlyBoughtTogetherCard";
import { ProductGalleryGrid } from "~/components/catalog/ProductGalleryGrid";
import { ProductSpecs } from "~/components/catalog/ProductSpecs";
import { InfoCard } from "~/components/product/InfoCard";
import { ProductCarousel } from "~/components/product/ProductCarousel";
import { useGetConfigQuery, type CatalogDetail, type CatalogProduct, type Category } from "~/store/api/catalogApi";
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

export default function ProductDetail() {
  const { id } = useParams();
  // El producto viene del loader SSR (mejor FCP y meta para compartir). Ya no se
  // re-pide en cliente con RTK Query: era un fetch duplicado.
  const { product, catalog, categories } = useLoaderData<typeof loader>();
  const dispatch = useAppDispatch();
  const { data: config } = useGetConfigQuery();

  // Estado UI
  const [selection, setSelection] = useState<VariantSelection | null>(null);
  const [activeTab, setActiveTab] = useState<"opciones" | "desc" | "specs">("opciones");
  const [isAdded, setIsAdded] = useState(false);

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

  // Relacionados ("Tal vez te pueda interesar"): misma categoría, excluyendo el
  // producto actual; si hay pocos, se rellena con otros del catálogo.
  const related = useMemo(() => {
    if (!product) return [];
    const others = catalog.filter((p) => p.id !== product.id);
    const sameCat = others.filter((p) => p.category === product.category);
    return (sameCat.length >= 4 ? sameCat : others).slice(0, 12);
  }, [catalog, product]);

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

  const handleShare = async () => {
    const shareData = {
      title: baseName,
      text: `Mira este producto en Gyro Store: ${selectedVariant ? selectedVariant.name : baseName}`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Enlace copiado al portapapeles");
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Enlace copiado al portapapeles");
      }
    }
  };

  const whatsappUrl = buildWhatsappUrl(
    config?.whatsapp ?? "50585944758",
    `Hola Gyro Store 👋, me interesa: ${selectedVariant ? selectedVariant.name : baseName}`,
  );

  return (
    <div className="flex min-h-dvh flex-col bg-bg font-sans text-text">
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
            {/* Galería */}
            <ProductGalleryGrid
              gallery={gallery}
              baseName={baseName}
              inStock={inStock}
              productId={id!}
            />

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
                      <span key={b} className="rounded-pill bg-accent/15 px-3 py-1 text-xs font-bold tracking-wide text-accent-2 ring-1 ring-accent/20">
                        {b}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-start justify-between gap-4">
                  <h1 className="font-heading text-[clamp(2rem,5.5vw,3.25rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-balance text-text">
                    {selectedVariant ? selectedVariant.name : baseName}
                  </h1>
                  <button
                    onClick={handleShare}
                    className="mt-1 shrink-0 rounded-full p-2.5 text-muted transition-colors hover:bg-surface-2 hover:text-text"
                    title="Compartir producto"
                  >
                    <Share2 className="h-6 w-6" />
                  </button>
                </div>
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
                    ? `Últimas ${stockCount} unidade${stockCount === 1 ? '' : 's'}`
                    : `${stockCount} unidades disponibles`}
              </motion.p>

              {/* Contenedor Unificado: Diseño Apilado */}
              <motion.div variants={itemFade} className="card-premium mt-8 flex flex-col gap-10 rounded-none p-6 sm:p-8">
                
                {/* 1. Opciones de Compra */}
                <div className="flex flex-col focus:outline-none">
                  {/* Selector de variantes multi-eje */}
                  {product.variants?.length > 0 && (
                    <div className="mb-8">
                      <VariantPicker
                        variants={product.variants}
                        axisLabels={product.axisLabels}
                        colorAxisIndex={product.colorAxisIndex}
                        onChange={(s) => {
                          setSelection(s);
                        }}
                      />
                    </div>
                  )}

                  {/* Selector de cantidad */}
                  <div className="mb-8">
                    <p className="mb-3 text-sm font-semibold text-text/80">Cantidad</p>
                    <div className="flex items-center rounded-none border border-border bg-surface-2 p-1 w-fit shadow-sm">
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        className="flex h-10 w-12 items-center justify-center rounded-none text-lg text-muted transition-colors hover:bg-surface hover:text-text active:scale-95"
                        aria-label="Quitar uno"
                      >
                        −
                      </button>
                      <span className="w-12 text-center text-base font-bold">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty((q) => q + 1)}
                        className="flex h-10 w-12 items-center justify-center rounded-none text-lg text-muted transition-colors hover:bg-surface hover:text-text active:scale-95"
                        aria-label="Agregar uno"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Bundles de mayoreo */}
                  {discounts.length > 0 && (
                    <div className="mb-8 flex flex-col gap-3">
                      <p className="text-sm font-semibold flex items-center gap-2 text-text">
                        <ShieldCheck className="h-4 w-4 text-accent" /> Ahorra comprando más
                      </p>
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        {bulkBundles.map((b) => {
                          const t = discounts.find((d) => b.qty >= d.minQty && (d.maxQty == null || b.qty <= d.maxQty)) ?? null;
                          return (
                            <div key={b.qty} className="flex-1">
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

                      {nextTier ? (
                        <InfoCard
                          icon={TrendingUp}
                          title="Descuento por volumen"
                          description={`Agregá ${nextTier.minQty - qty} ${nextTier.minQty - qty === 1 ? "unidad" : "unidades"} más para ahorrar un ${nextTier.discountPercent}% por unidad.`}
                          variant="highlight"
                        />
                      ) : tier ? (
                        <InfoCard
                          icon={TrendingUp}
                          title="Descuento máximo"
                          description={`¡Felicidades! Estás aprovechando el descuento máximo del ${tier.discountPercent}% por unidad.`}
                          variant="highlight"
                        />
                      ) : null}
                    </div>
                  )}

                  <div className="mb-6 grid grid-cols-1 sm:grid-cols-5 gap-3">
                    <Button
                      variant="primary"
                      onClick={add}
                      disabled={!inStock}
                      className={cn("sm:col-span-2", isAdded && "bg-whatsapp hover:bg-whatsapp border-transparent text-[#000000]")}
                    >
                      {isAdded ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
                      {isAdded ? "¡Agregado!" : "Agregar"}
                    </Button>
                    
                    <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex sm:col-span-3">
                      <Button
                        variant="whatsapp"
                        className="w-full"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.471-1.761-1.643-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>
                        Comprar al por mayor
                      </Button>
                    </a>
                  </div>

                  {/* Venta Cruzada (Bundle) */}
                  {related[0] && (
                    <div className="mb-4">
                      <FrequentlyBoughtTogetherCard
                        mainProduct={product}
                        mainVariant={selectedVariant}
                        mainUnitPrice={unitPrice}
                        mainQty={qty}
                        crossProduct={related[0]}
                        onAddBoth={() => {
                          add();
                          dispatch(addItem({
                            catalogId: related[0].id,
                            name: related[0].name,
                            variantName: "Estándar",
                            price: related[0].price,
                            image: related[0].images?.[0] || "",
                            quantity: 1,
                          }));
                          toast.success("Ambos productos agregados al carrito");
                        }}
                      />
                    </div>
                  )}

                  {/* Trust Box */}
                  <div className="flex flex-col gap-3 mt-4">
                    <InfoCard
                      icon={Bike}
                      title="Delivery en Managua"
                      description="Servicio con costo extra para recibir tu producto."
                    />
                    <InfoCard
                      icon={Package}
                      title="Envíos a departamentos por Cargo Trans"
                      description="Envíos seguros a todo el país."
                    />
                    <InfoCard
                      icon={Banknote}
                      title="Pago contra entrega"
                      description="Paga en efectivo o transferencia al recibir tu producto."
                    />
                    <InfoCard
                      icon={ShieldCheck}
                      title="Garantía de 1 mes"
                      description="Cobertura por defectos de fábrica."
                    />
                  </div>
                </div>

                {/* 2. Descripción Comercial */}
                <div className="border-t border-border/40 pt-10 mt-2 focus:outline-none">
                  <h3 className="text-lg font-bold mb-6 text-text flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-accent" />
                    Acerca del producto
                  </h3>
                  
                  {product.description ? (
                    <div className="max-w-[65ch] space-y-6">
                      {(Array.isArray(product.description) ? product.description : String(product.description).split(/\n+/)).filter(Boolean).map((paragraph: string, idx: number) => (
                        <p 
                          key={idx} 
                          className={cn(
                            "text-pretty",
                            idx === 0 
                              ? "text-xl sm:text-2xl font-bold leading-snug tracking-tight text-text" 
                              : "text-base sm:text-lg font-medium leading-relaxed text-muted"
                          )}
                          dangerouslySetInnerHTML={{ __html: paragraph }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">No hay descripción disponible para este producto.</p>
                  )}
                  
                  {product.tiktokUrl && (
                    <div className="mt-8 pt-6 border-t border-border/50">
                      <p className="mb-4 text-xs font-bold text-text uppercase tracking-wider flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-accent animate-pulse" /> Ver en acción
                      </p>
                      <TikTokButton url={product.tiktokUrl} />
                    </div>
                  )}
                </div>

                {/* 3. Especificaciones Técnicas */}
                <ProductSpecs specs={product.specs} />
              </motion.div>
            </motion.div>
          </div>
        )}

        {/* Relacionados: reusa el carrusel del home. */}
        {product && related.length > 0 && (
          <div className="mt-16 border-t border-white/5 pt-8">
            <ProductCarousel
              title="Tal vez te pueda interesar"
              products={related}
              categories={categories}
            />
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
          <Button onClick={add} disabled={!inStock} className="shrink-0 rounded-none px-5">
            <ShoppingBag className="h-4 w-4 mr-1.5" /> {inStock ? "Agregar" : "Agotado"}
          </Button>
        </div>
      )}



      <PublicFooter />
    </div>
  );
}
