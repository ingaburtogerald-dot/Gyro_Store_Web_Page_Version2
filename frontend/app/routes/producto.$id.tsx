import { useMemo, useState } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useParams, Link } from "@remix-run/react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ImageOff, MessageCircle, ShoppingBag, Loader2, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PublicHeader } from "~/components/layout/PublicHeader";
import { PublicFooter } from "~/components/layout/PublicFooter";
import { CartFab } from "~/components/cart/CartFab";
import { CartDrawer } from "~/components/cart/CartDrawer";
import { VariantPicker, type VariantSelection } from "~/components/catalog/VariantPicker";
import { TikTokButton } from "~/components/catalog/TikTokButton";
import { Button } from "~/components/ui/Button";
import { useGetCatalogItemQuery, useGetConfigQuery } from "~/store/api/catalogApi";
import { useAppDispatch } from "~/store/hooks";
import { addItem, openCart } from "~/store/slices/cartSlice";
import { formatCordobas, buildWhatsappUrl, cn } from "~/lib/utils";

// Carga el producto en el servidor para que el preview al compartir (WhatsApp/redes)
// tenga foto, título y precio. El bot de WhatsApp no ejecuta JS, así que el meta
// debe estar en el HTML renderizado por el servidor.
export async function loader({ params, request }: LoaderFunctionArgs) {
  const origin = new URL(request.url).origin;
  let product: any = null;
  try {
    const res = await fetch(`${origin}/api/catalog/${params.id}`);
    if (res.ok) product = await res.json();
  } catch {
    /* el componente vuelve a pedirlo en cliente */
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
  const [lightbox, setLightbox] = useState(false);
  const dispatch = useAppDispatch();
  const { data: product, isLoading, isError } = useGetCatalogItemQuery(id!, { skip: !id });
  const { data: config } = useGetConfigQuery();

  const [activeImage, setActiveImage] = useState(0);
  const [selection, setSelection] = useState<VariantSelection | null>(null);

  const selectedVariant = selection?.variant ?? product?.variants[0];
  const baseName = product?.name ?? "";
  const price = selectedVariant?.price ?? product?.price ?? 0;
  const inStock = selection ? selection.inStock : (product?.stock ?? 0) > 0;
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
  
  // Filas de la tabla de precios (agrega la fila de 1 unidad si no existe).
  const tierRows = useMemo(() => {
    const hasOne = discounts.some((d) => d.minQty <= 1);
    return hasOne ? discounts : [{ minQty: 1, maxQty: 1, discountPercent: 0 }, ...discounts];
  }, [discounts]);

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
  }

  const whatsappUrl = buildWhatsappUrl(
    config?.whatsapp ?? "50585944758",
    `Hola Gyro Store 👋, me interesa: ${selectedVariant ? selectedVariant.name : baseName}`,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 md:pb-12">
        <div className="sticky top-[4.5rem] z-30 mb-6 w-fit">
          <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/90 px-4 py-2 text-sm font-semibold text-muted shadow-lg backdrop-blur-md transition-all hover:border-accent/50 hover:bg-surface hover:text-text">
            <ArrowLeft className="h-4 w-4" /> Volver al catálogo
          </Link>
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : isError || !product ? (
          <p className="py-24 text-center text-muted">Producto no encontrado.</p>
        ) : (
          <div className="grid gap-10 md:grid-cols-2 items-start">
            {/* Galería (sticky) */}
            <div className="md:sticky md:top-24 h-fit">
              <button
                type="button"
                onClick={() => (gallery[activeImage] ?? gallery[0]) && setLightbox(true)}
                className="group relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-[2rem] border border-border bg-surface-2 p-6 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
                      className="h-full w-full object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-105"
                      style={{ viewTransitionName: `vt-product-${id}` } as React.CSSProperties}
                    />
                  ) : (
                    <motion.div key="empty" className="grid h-full place-items-center text-muted">
                      <ImageOff className="h-12 w-12 opacity-50" />
                    </motion.div>
                  )}
                </AnimatePresence>
                {!inStock && (
                  <span className="absolute left-4 top-4 rounded-pill bg-black/80 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-md">
                    Agotado
                  </span>
                )}
              </button>
              
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

                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text/90 leading-tight">
                  {selectedVariant ? selectedVariant.name : baseName}
                </h1>
              </motion.div>

              <motion.div variants={itemFade} className="mt-5 flex flex-wrap items-baseline gap-4">
                <p className="font-heading text-4xl font-bold text-accent-2 drop-shadow-sm">{formatCordobas(unitPrice)}</p>
                {tier ? (
                  <span className="text-lg text-muted line-through">{formatCordobas(price)}</span>
                ) : onSale ? (
                  <span className="text-lg text-muted line-through">{formatCordobas(compareAt)}</span>
                ) : null}
                {tier ? (
                  <span className="rounded-pill bg-whatsapp/15 px-2.5 py-1 text-xs font-bold tracking-wide text-whatsapp">
                    −{tier.discountPercent}% por {qty} uds
                  </span>
                ) : onSale ? (
                  <span className="rounded-pill bg-red-500/15 px-2.5 py-1 text-xs font-bold tracking-wide text-red-400">
                    En oferta
                  </span>
                ) : null}
              </motion.div>

              {qty > 1 && (
                <motion.p variants={itemFade} className="mt-2 text-sm text-muted">
                  Total {qty} uds: <span className="font-bold text-text">{formatCordobas(unitPrice * qty)}</span>
                </motion.p>
              )}
              
              <motion.p variants={itemFade} className={`mt-2 text-sm font-semibold tracking-wide ${inStock ? "text-whatsapp" : "text-red-400"}`}>
                {inStock ? "● Disponible en inventario" : "● Agotado"}
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

              {/* Tarjetas de precios por cantidad */}
              {tierRows.length > 1 && (
                <motion.div variants={itemFade} className="mt-8">
                  <p className="mb-3 text-sm font-semibold flex items-center gap-2 text-text/80">
                    <ShieldCheck className="h-4 w-4 text-accent" /> Ahorra comprando más
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {tierRows.map((d, i) => {
                      const range = d.maxQty == null ? `${d.minQty}+ uds` : d.minQty === d.maxQty ? `${d.minQty} ud` : `${d.minQty}–${d.maxQty} uds`;
                      const u = Math.round(price * (1 - d.discountPercent / 100));
                      const active = qty >= d.minQty && (d.maxQty == null || qty <= d.maxQty);
                      return (
                        <motion.button
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          type="button"
                          key={i}
                          onClick={() => setQty(d.minQty)}
                          className={cn(
                            "relative flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all overflow-hidden",
                            active 
                              ? "border-accent bg-accent/5 ring-1 ring-accent shadow-md shadow-accent/10" 
                              : "border-border hover:border-accent/30 bg-surface-2"
                          )}
                        >
                          {active && (
                            <span className="absolute top-0 right-0 rounded-bl-lg bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                              Activo
                            </span>
                          )}
                          <span className={cn("text-xs font-semibold mb-1.5 uppercase tracking-wide", active ? "text-accent" : "text-muted")}>{range}</span>
                          <span className="font-heading text-xl font-bold text-text">
                            {formatCordobas(u)}
                          </span>
                          <span className="text-[10px] font-medium text-muted">unidad</span>
                          {d.discountPercent > 0 && (
                            <div className="mt-2 w-full rounded-md bg-whatsapp/15 py-1 text-[11px] font-bold text-whatsapp">
                              Ahorras {d.discountPercent}%
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Botones de acción principales */}
              <motion.div variants={itemFade} className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Button 
                  className="flex-1 h-14 rounded-2xl text-base shadow-xl shadow-accent/20 transition-all hover:scale-[1.02] hover:shadow-accent/30 active:scale-95" 
                  onClick={add} 
                  disabled={!inStock}
                >
                  <ShoppingBag className="h-5 w-5 mr-2" /> Agregar al carrito
                </Button>
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex-1">
                  <Button 
                    variant="whatsapp" 
                    className="w-full h-14 rounded-2xl text-base shadow-xl shadow-whatsapp/20 transition-all hover:scale-[1.02] hover:shadow-whatsapp/30 active:scale-95"
                  >
                    <MessageCircle className="h-5 w-5 mr-2" /> Consultar por WhatsApp
                  </Button>
                </a>
              </motion.div>

              {/* Contenedor Unificado: Descripción y Especificaciones */}
              <motion.div variants={itemFade} className="mt-12 rounded-3xl border border-border bg-surface-2 p-6 sm:p-8 shadow-sm">
                
                {/* Descripción y Video */}
                <div className="text-sm md:text-base leading-relaxed text-muted whitespace-pre-wrap">
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
                </div>

                {/* Especificaciones (si existen) */}
                {product.specs && product.specs.length > 0 && (
                  <div className="mt-10 pt-8 border-t border-border/50">
                    <p className="mb-6 text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-accent" /> Especificaciones Técnicas
                    </p>
                    <table className="w-full text-sm">
                      <tbody>
                        {product.specs.map((s: any, i: number) => (
                          <tr key={i} className="group border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors">
                            <td className="py-3.5 pr-4 text-muted whitespace-nowrap">{s.label}</td>
                            <td className="py-3.5 font-semibold text-text text-right break-words">{s.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

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
            <p className="font-heading text-xl font-bold text-accent-2 drop-shadow-sm">{formatCordobas(unitPrice)}</p>
          </div>
          <Button onClick={add} disabled={!inStock} className="shrink-0 rounded-xl px-5 shadow-lg shadow-accent/20">
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
