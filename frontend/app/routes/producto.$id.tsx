import { useMemo, useState } from "react";
import { useParams, Link } from "@remix-run/react";
import { motion } from "framer-motion";
import { ArrowLeft, ImageOff, MessageCircle, ShoppingBag, Loader2 } from "lucide-react";
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

export default function ProductDetail() {
  const { id } = useParams();
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
          <ArrowLeft className="h-4 w-4" /> Volver al catálogo
        </Link>

        {isLoading ? (
          <div className="grid place-items-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
        ) : isError || !product ? (
          <p className="py-24 text-center text-muted">Producto no encontrado.</p>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-8 md:grid-cols-2"
          >
            {/* Galería (fotos del color seleccionado) */}
            <div>
              <div className="relative aspect-square overflow-hidden rounded-card border border-border bg-surface-2">
                {gallery[activeImage] ?? gallery[0] ? (
                  <img src={gallery[activeImage] ?? gallery[0]} alt={baseName} className="h-full w-full object-contain" />
                ) : (
                  <div className="grid h-full place-items-center text-muted">
                    <ImageOff className="h-10 w-10" />
                  </div>
                )}
                {!inStock && (
                  <span className="absolute left-3 top-3 rounded-pill bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                    Agotado
                  </span>
                )}
              </div>
              {gallery.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {gallery.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      className={`h-16 w-16 overflow-hidden rounded-lg border ${i === activeImage ? "border-accent" : "border-border"}`}
                    >
                      <img src={img} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div>
              {/* Badges / etiquetas */}
              {product.badges && product.badges.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {product.badges.map((b) => (
                    <span key={b} className="rounded-pill bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent-2">
                      {b}
                    </span>
                  ))}
                </div>
              )}

              <h1 className="text-2xl font-bold">{selectedVariant ? selectedVariant.name : baseName}</h1>

              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <p className="font-heading text-3xl font-bold text-accent-2">{formatCordobas(unitPrice)}</p>
                {tier ? (
                  <span className="text-base text-muted line-through">{formatCordobas(price)}</span>
                ) : onSale ? (
                  <span className="text-base text-muted line-through">{formatCordobas(compareAt)}</span>
                ) : null}
                {tier ? (
                  <span className="rounded-pill bg-whatsapp/15 px-2 py-0.5 text-xs font-semibold text-whatsapp">
                    −{tier.discountPercent}% por {qty} uds
                  </span>
                ) : onSale ? (
                  <span className="rounded-pill bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">
                    En oferta
                  </span>
                ) : null}
              </div>
              {qty > 1 && (
                <p className="mt-1 text-sm text-muted">
                  Total {qty} uds: <span className="font-semibold text-text">{formatCordobas(unitPrice * qty)}</span>
                </p>
              )}
              <p className={`mt-1 text-sm ${inStock ? "text-whatsapp" : "text-red-400"}`}>
                {inStock ? "Disponible" : "Agotado"}
              </p>

              {product.description && <p className="mt-4 text-muted">{product.description}</p>}

              {/* Selector de variantes multi-eje */}
              {product.variants.length > 0 && (
                <VariantPicker
                  variants={product.variants}
                  axisLabels={product.axisLabels}
                  onChange={(s) => {
                    setSelection(s);
                    setActiveImage(0);
                  }}
                />
              )}

              {/* Video de TikTok */}
              {product.tiktokUrl && <TikTokButton url={product.tiktokUrl} className="mt-5" />}

              {/* Especificaciones técnicas (tabla) */}
              {product.specs && product.specs.length > 0 && (
                <div className="mt-6">
                  <p className="mb-2 text-sm font-semibold">Especificaciones</p>
                  <table className="w-full text-sm">
                    <tbody>
                      {product.specs.map((s, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-1.5 pr-4 text-muted">{s.label}</td>
                          <td className="py-1.5 text-right font-medium">{s.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Selector de cantidad */}
              <div className="mt-6">
                <p className="mb-2 text-sm font-medium">Cantidad</p>
                <div className="flex items-center rounded-pill border border-border w-fit">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="px-4 py-1.5 text-lg text-muted hover:text-text"
                    aria-label="Quitar uno"
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-sm font-semibold">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => q + 1)}
                    className="px-4 py-1.5 text-lg text-muted hover:text-text"
                    aria-label="Agregar uno"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Tabla de precios por cantidad (compra de más de 1 unidad) */}
              {tierRows.length > 1 && (
                <div className="mt-4 rounded-xl border border-border p-3">
                  <p className="mb-2 text-sm font-semibold">Precios por cantidad</p>
                  <div className="space-y-1">
                    {tierRows.map((d, i) => {
                      const range =
                        d.maxQty == null
                          ? `${d.minQty}+ uds`
                          : d.minQty === d.maxQty
                            ? `${d.minQty} ud${d.minQty > 1 ? "s" : ""}`
                            : `${d.minQty}–${d.maxQty} uds`;
                      const u = Math.round(price * (1 - d.discountPercent / 100));
                      const active = qty >= d.minQty && (d.maxQty == null || qty <= d.maxQty);
                      return (
                        <button
                          type="button"
                          key={i}
                          onClick={() => setQty(d.minQty)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg px-2 py-1 text-sm transition-colors",
                            active ? "bg-gradient-accent text-white" : "text-muted hover:bg-surface-2",
                          )}
                        >
                          <span>{range}</span>
                          <span className="font-semibold">
                            {formatCordobas(u)} c/u
                            {d.discountPercent > 0 && <span className="ml-1 opacity-70">(−{d.discountPercent}%)</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button className="flex-1" onClick={add} disabled={!inStock}>
                  <ShoppingBag className="h-4 w-4" /> Agregar al carrito
                </Button>
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex-1">
                  <Button variant="whatsapp" className="w-full">
                    <MessageCircle className="h-4 w-4" /> Consultar por WhatsApp
                  </Button>
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      <PublicFooter />
      <CartFab />
      <CartDrawer />
    </div>
  );
}
