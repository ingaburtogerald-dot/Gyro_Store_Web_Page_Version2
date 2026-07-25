import { AnimatePresence, motion } from "framer-motion";
import { Check, ShoppingCart, ShieldCheck } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { VolumePriceCard } from "~/components/product/VolumePriceCard";
import { FrequentlyBoughtTogetherCard } from "~/components/product/FrequentlyBoughtTogetherCard";
import { TrustBox } from "./TrustBox";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { cn } from "~/lib/utils";
import type { CatalogDetail, Combo } from "~/store/api/catalogApi";

const itemFade = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0 }
};

interface ProductPurchasePanelProps {
  product: CatalogDetail;
  qty: number;
  setQty: (qty: number | ((q: number) => number)) => void;
  price: number;
  unitPrice: number;
  inStock: boolean;
  isAdded: boolean;
  discounts: any[];
  bulkBundles: { label: string; qty: number }[];
  whatsappUrl: string;
  combo: Combo | null;
  add: () => void;
  onAddCombo: () => void;
}

export function ProductPurchasePanel({
  product,
  qty,
  setQty,
  price,
  unitPrice,
  inStock,
  isAdded,
  discounts,
  bulkBundles,
  whatsappUrl,
  combo,
  add,
  onAddCombo
}: ProductPurchasePanelProps) {
  return (
    <motion.div variants={itemFade} className="card-premium mt-4 flex flex-col gap-6 rounded-2xl p-4 sm:gap-10 sm:p-8">
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

        {/* Venta cruzada */}
        {combo && (
          <div className="mb-0">
            <FrequentlyBoughtTogetherCard
              combo={combo}
              mainProductId={product.id}
              onAdd={onAddCombo}
            />
          </div>
        )}

        {/* Trust Box */}
        <TrustBox />
      </div>
    </motion.div>
  );
}
