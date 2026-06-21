// Selector de opciones multi-eje (Conexión / Micrófono / Color) estilo Amazon.
// Recibe las combinaciones de la plantilla (campo `variants` del detalle, generado
// en el backend): una opción se muestra "agotada" si no existe ninguna combinación
// con stock=1 (encendida) que coincida con lo ya elegido en los otros ejes.
import { useEffect, useMemo, useState } from "react";
import { cn } from "~/lib/utils";
import type { CatalogVariant } from "~/store/api/catalogApi";

export interface VariantSelection {
  variant: CatalogVariant | null; // combo exacto resuelto (puede estar agotado)
  color: string | null; // valor del último eje (para la galería por color)
  inStock: boolean; // el combo resuelto tiene stock > 0
}

function val(v: CatalogVariant, i: number): string | null {
  return v.axisValues?.[i] ?? null;
}

export function VariantPicker({
  variants,
  axisLabels,
  onChange,
}: {
  variants: CatalogVariant[];
  axisLabels: string[];
  onChange: (s: VariantSelection) => void;
}) {
  const axisCount = axisLabels.length;

  // Opciones distintas por eje, en orden de aparición.
  const options = useMemo(() => {
    const opts: string[][] = Array.from({ length: axisCount }, () => []);
    for (const v of variants) {
      for (let i = 0; i < axisCount; i++) {
        const value = val(v, i);
        if (value && !opts[i].includes(value)) opts[i].push(value);
      }
    }
    return opts;
  }, [variants, axisCount]);

  // Selección inicial: los ejes de la primera variante con más stock.
  const initial = useMemo(() => {
    const base = [...variants].sort((a, b) => (b.stock || 0) - (a.stock || 0))[0];
    return Array.from({ length: axisCount }, (_, i) => val(base, i) ?? options[i][0] ?? null);
  }, [variants, axisCount, options]);

  const [selected, setSelected] = useState<(string | null)[]>(initial);
  useEffect(() => setSelected(initial), [initial]);

  // ¿Existe una variante con stock que matchee `sel`, ignorando un eje?
  function available(sel: (string | null)[], ignore: number, axis: number, value: string) {
    return variants.some((v) => {
      if (val(v, axis) !== value || (v.stock || 0) <= 0) return false;
      for (let i = 0; i < axisCount; i++) {
        if (i === ignore || i === axis) continue;
        if (sel[i] != null && val(v, i) !== sel[i]) return false;
      }
      return true;
    });
  }

  function isOptionAvailable(sel: (string | null)[], axis: number, value: string) {
    return available(sel, axis, axis, value);
  }

  // Resuelve el combo exacto (todos los ejes elegidos coinciden con una variante).
  function resolve(sel: (string | null)[]): VariantSelection {
    const variant =
      variants.find((v) => sel.every((s, i) => s == null || val(v, i) === s)) ?? null;
    return {
      variant,
      color: sel[axisCount - 1] ?? null,
      inStock: !!variant && (variant.stock || 0) > 0,
    };
  }

  // Al elegir una opción, repara los otros ejes que queden sin stock (evita callejones).
  function pick(axis: number, value: string) {
    setSelected((prev) => {
      const next = [...prev];
      next[axis] = value;
      for (let j = 0; j < axisCount; j++) {
        if (j === axis) continue;
        if (next[j] != null && !isOptionAvailable(next, j, next[j]!)) {
          const fallback = options[j].find((o) => isOptionAvailable(next, j, o));
          next[j] = fallback ?? next[j];
        }
      }
      return next;
    });
  }

  useEffect(() => {
    onChange(resolve(selected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(selected), variants]);

  return (
    <div className="mt-5 space-y-4">
      {axisLabels.map((label, axis) =>
        options[axis].length === 0 ? null : (
          <div key={label}>
            <p className="mb-2 text-sm font-medium">{label}</p>
            <div className="flex flex-wrap gap-2">
              {options[axis].map((opt) => {
                const isSel = selected[axis] === opt;
                const enabled = isOptionAvailable(selected, axis, opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={!enabled && !isSel}
                    onClick={() => pick(axis, opt)}
                    className={cn(
                      "rounded-pill border px-3 py-1.5 text-sm transition-colors",
                      isSel
                        ? "border-transparent bg-gradient-accent text-white"
                        : enabled
                          ? "border-border text-muted hover:text-text"
                          : "cursor-not-allowed border-border/50 text-muted/40 line-through",
                    )}
                  >
                    {opt}
                    {!enabled && !isSel && <span className="ml-1 text-xs">· agotado</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ),
      )}
    </div>
  );
}
