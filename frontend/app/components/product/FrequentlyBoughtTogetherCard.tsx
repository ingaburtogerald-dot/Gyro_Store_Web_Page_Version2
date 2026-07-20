import { Sparkles, Plus } from "lucide-react";
import { useNavigate } from "@remix-run/react";
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
  const navigate = useNavigate();
  const mainProduct = combo.products.find((p) => p.id === mainProductId) ?? combo.products[0];
  const crossProduct = combo.products.find((p) => p.id !== mainProductId) ?? combo.products[1];
  if (!mainProduct || !crossProduct) return null;

  const hasImage = !!combo.image;

  return (
    <div 
      onClick={() => navigate(`/combo/${combo.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/combo/${combo.id}`);
        }
      }}
      className="group relative mb-4 block cursor-pointer rounded-2xl border border-white/10 bg-surface-2/40 p-3 sm:p-4 transition-all duration-300 ease-out hover:border-accent/40 hover:bg-surface-2/80 hover:shadow-[0_8px_20px_-12px_rgba(var(--color-accent),0.3)] active:scale-[0.98]"
    >
      <h3 className="mb-4 flex items-center gap-2 text-xs sm:text-sm font-bold text-text">
        <Sparkles className="h-4 w-4 text-accent" />
        Comprados juntos frecuentemente
      </h3>

      {hasImage ? (
        <div className="mb-4 flex items-center gap-4">
          <div className="product-stage shrink-0 h-20 w-20 sm:h-24 sm:w-24 rounded-xl p-1.5 sm:p-2 bg-white/5">
             <img src={combo.image} alt={combo.name || "Combo"} className="h-full w-full object-contain" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-text line-clamp-2">{combo.name || "Combo Especial"}</p>
            <p className="mt-1 text-[10px] sm:text-xs text-muted line-clamp-2">{mainProduct.name} <br/>+ {crossProduct.name}</p>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2 sm:gap-3">
          <div className="product-stage h-12 w-12 sm:h-16 sm:w-16 shrink-0 rounded-xl p-1 sm:p-1.5 bg-white/5">
            <img src={mainProduct.image || ""} alt="" className="h-full w-full object-contain" />
          </div>
          <div className="grid h-5 w-5 sm:h-6 sm:w-6 shrink-0 place-items-center rounded-full border border-white/10 bg-surface-2/50 text-muted">
            <Plus className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          </div>
          <div className="product-stage h-12 w-12 sm:h-16 sm:w-16 shrink-0 rounded-xl p-1 sm:p-1.5 bg-white/5">
            <img src={crossProduct.image || ""} alt="" className="h-full w-full object-contain" />
          </div>
          <div className="ml-1 flex flex-col flex-1 min-w-0">
             <span className="truncate text-[10px] sm:text-xs font-medium text-text/90">{mainProduct.name}</span>
             <span className="truncate text-[10px] sm:text-xs text-muted">+ {crossProduct.name}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto">
          <div>
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">Total del combo</p>
            <div className="flex items-baseline gap-2">
              <p className="text-lg sm:text-xl font-bold tabular-nums leading-none text-accent drop-shadow-[0_0_8px_rgba(var(--color-accent),0.3)]">{formatCordobas(combo.price)}</p>
              {combo.savings > 0 && (
                <p className="text-xs text-muted line-through tabular-nums">{formatCordobas(combo.normalTotal)}</p>
              )}
            </div>
          </div>
        </div>
        <Button 
          size="sm" 
          variant="primary" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAdd();
          }} 
          className="w-full sm:w-auto rounded-xl text-xs sm:text-sm h-9 sm:h-10"
        >
          Agregar combo
        </Button>
      </div>
    </div>
  );
}
