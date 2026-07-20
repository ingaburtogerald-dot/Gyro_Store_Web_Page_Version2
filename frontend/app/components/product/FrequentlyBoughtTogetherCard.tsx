import { Sparkles, Plus } from "lucide-react";
import { Link } from "@remix-run/react";
import { formatCordobas } from "~/lib/utils";
import { Button } from "./../ui/Button";
import type { Combo } from "~/store/api/catalogApi";

interface FrequentlyBoughtTogetherCardProps {
  /** Combo real (backend) que contiene el producto actual — nunca un "relacionado"
   *  arbitrario. El precio mostrado es el del paquete, no una suma cruda. */
  combo: Combo;
  mainProductId: string;
  onAdd: () => void;
}

export function FrequentlyBoughtTogetherCard({ combo, mainProductId, onAdd }: FrequentlyBoughtTogetherCardProps) {
  const mainProduct = combo.products.find((p) => p.id === mainProductId) ?? combo.products[0];
  const crossProduct = combo.products.find((p) => p.id !== mainProductId) ?? combo.products[1];
  if (!mainProduct || !crossProduct) return null;

  const hasImage = !!combo.image;

  return (
    <Link 
      to={`/combo/${combo.id}`}
      className="group relative mb-8 block rounded-2xl border border-border bg-surface-2 p-5 transition-all duration-300 ease-out hover:border-accent/50 hover:shadow-[0_0_20px_rgba(var(--color-accent),0.15)] hover:-translate-y-1"
    >
      <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold text-text">
        <Sparkles className="h-4 w-4 text-accent" />
        Comprados juntos frecuentemente
      </h3>

      {hasImage ? (
        <div className="mb-5 flex justify-center">
          <div className="product-stage h-40 w-full max-w-[200px] rounded-xl p-3">
             <img src={combo.image} alt={combo.name || "Combo"} className="h-full w-full object-contain" />
          </div>
        </div>
      ) : (
        <div className="mb-5 flex items-center justify-center gap-2 sm:gap-4">
          <div className="flex flex-1 flex-col items-center gap-2">
            <div className="product-stage h-20 w-20 rounded-none p-2">
              <img src={mainProduct.image || ""} alt="" className="h-full w-full object-contain" />
            </div>
            <span className="line-clamp-2 text-center text-xs text-muted">{mainProduct.name}</span>
            <span className="text-base font-semibold text-text">{formatCordobas(mainProduct.price)}</span>
          </div>

          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-surface text-muted">
            <Plus className="h-4 w-4" />
          </div>

          <div className="flex flex-1 flex-col items-center gap-2">
            <div className="product-stage h-20 w-20 rounded-none p-2">
              <img src={crossProduct.image || ""} alt="" className="h-full w-full object-contain" />
            </div>
            <span className="line-clamp-2 text-center text-xs text-muted">{crossProduct.name}</span>
            <span className="text-base font-semibold text-text">{formatCordobas(crossProduct.price)}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-0.5 text-xs text-muted">Precio del combo:</p>
          <div className="flex items-baseline gap-2">
            <p className="text-xl font-bold tabular-nums leading-none text-accent">{formatCordobas(combo.price)}</p>
            {combo.savings > 0 && (
              <p className="text-xs text-muted line-through tabular-nums">{formatCordobas(combo.normalTotal)}</p>
            )}
          </div>
        </div>
        <Button 
          size="md" 
          variant="primary" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAdd();
          }} 
          className="w-full sm:w-auto"
        >
          Agregar combo
        </Button>
      </div>
    </Link>
  );
}
