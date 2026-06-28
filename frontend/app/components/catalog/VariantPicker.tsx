// Selector de opciones multi-eje (Conexión / Micrófono / Color) estilo Amazon.
// Recibe las combinaciones de la plantilla (campo `variants` del detalle, generado
// en el backend): una opción se muestra "agotada" si no existe ninguna combinación
// con stock=1 (encendida) que coincida con lo ya elegido en los otros ejes.
import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
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

const COLOR_MAP: Record<string, string> = {
  negro: "#121212",
  black: "#121212",
  blanco: "#ffffff",
  white: "#ffffff",
  turquesa: "#00d4aa",
  turquoise: "#00d4aa",
  gris: "#717a9c", // matching our muted color
  grey: "#717a9c",
  gray: "#717a9c",
  azul: "#3b82f6",
  blue: "#3b82f6",
  rojo: "#ef4444",
  red: "#ef4444",
  verde: "#22c55e",
  green: "#22c55e",
  rosa: "#ec4899",
  rosado: "#ec4899",
  pink: "#ec4899",
  morado: "#a855f7",
  purple: "#a855f7",
  amarillo: "#eab308",
  yellow: "#eab308",
  naranja: "#f97316",
  orange: "#f97316",
  oro: "#d97706",
  dorado: "#d97706",
  gold: "#d97706",
  plata: "#cbd5e1",
  plateado: "#cbd5e1",
  silver: "#cbd5e1",
};

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
    <div className="mt-5 space-y-5">
      {axisLabels.map((label, axis) => {
        if (options[axis].length === 0) return null;
        const isColorAxis = label.toLowerCase().trim() === "color";
        const selectedLabel = selected[axis];

        return (
          <div key={label}>
            <p className="mb-2.5 text-sm font-medium text-text/80">
              {label}
              {selectedLabel && <span className="ml-2 text-muted">· {selectedLabel}</span>}
            </p>

            {isColorAxis ? (
              // ── Color Swatches: círculo con el color aproximado + etiqueta debajo ──
              <div className="flex flex-wrap gap-3">
                {options[axis].map((opt) => {
                  const isSel = selected[axis] === opt;
                  const enabled = isOptionAvailable(selected, axis, opt);
                  const colorKey = opt.toLowerCase().trim();
                  const colorVal = COLOR_MAP[colorKey];
                  const isTransparente = colorKey === "transparente" || colorKey === "clear";
                  // Fallback para colores fuera del mapa: superficie neutra (la etiqueta
                  // debajo siempre dice el nombre, así nunca queda inutilizable).
                  const swatchBg = isTransparente
                    ? "repeating-conic-gradient(#52525b 0% 25%, #a1a1aa 0% 50%) 50% / 8px 8px"
                    : colorVal ?? "var(--color-surface-2)";

                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={!enabled && !isSel}
                      onClick={() => pick(axis, opt)}
                      title={opt}
                      aria-label={opt}
                      aria-pressed={isSel}
                      className="group flex flex-col items-center gap-1.5 active:scale-95 transition-transform disabled:cursor-not-allowed"
                    >
                      <span
                        className={cn(
                          "relative grid h-10 w-10 place-items-center rounded-full border shadow-inner transition-all",
                          isSel
                            ? "border-transparent ring-2 ring-accent ring-offset-2 ring-offset-bg"
                            : "border-white/10 group-hover:border-accent/40",
                          !enabled && !isSel && "opacity-40",
                        )}
                        style={{ background: swatchBg }}
                      >
                        {/* Color desconocido: marca discreta para que no parezca vacío */}
                        {!colorVal && !isTransparente && (
                          <span className="text-[10px] font-bold text-muted">?</span>
                        )}
                        {/* Agotado: línea diagonal sobre el swatch */}
                        {!enabled && !isSel && (
                          <span className="absolute h-px w-[150%] -rotate-45 bg-muted/70" />
                        )}
                      </span>
                      <span
                        className={cn(
                          "max-w-[5rem] truncate text-xs",
                          isSel ? "font-medium text-text" : "text-muted",
                        )}
                      >
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              // ── Radio Cards: cajas seleccionables sólidas (Conexión / Micrófono / etc.) ──
              <div className="flex flex-wrap gap-2.5">
                {options[axis].map((opt) => {
                  const isSel = selected[axis] === opt;
                  const enabled = isOptionAvailable(selected, axis, opt);

                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={!enabled && !isSel}
                      onClick={() => pick(axis, opt)}
                      aria-pressed={isSel}
                      className={cn(
                        "flex min-w-[5rem] items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all active:scale-95",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                        isSel
                          ? "border-accent bg-accent/10 text-text shadow-sm shadow-accent/10 ring-1 ring-accent"
                          : enabled
                            ? "border-border bg-surface-2 text-muted hover:border-accent/40 hover:text-text"
                            : "cursor-not-allowed border-border/30 bg-surface-2/45 text-muted/30 line-through",
                      )}
                    >
                      {isSel && <Check className="h-4 w-4 shrink-0 text-accent" />}
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
