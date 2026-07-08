// Buscador dominante del storefront — reemplaza a CatalogSearchBar.
// Misma fuente de verdad (ui.search en Redux); cambia la piel y la invitación:
//  - Glass midnight con foco cyan (borde + halo suave, sin glow neón).
//  - Placeholder "vivo": rota sugerencias reales ("Audífonos KZ"…) solo cuando
//    el input está vacío, sin foco y sin prefers-reduced-motion.
//  - Atajo "/" para enfocar desde el teclado (chip visible solo en desktop).
// Sticky bajo el header (64px) igual que la barra anterior.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { setSearch } from "~/store/slices/uiSlice";
import { cn } from "~/lib/utils";

// Lo que la gente realmente busca en la tienda (invita a escribir).
const SUGERENCIAS = [
  "Audífonos KZ",
  "Adaptadores Bluetooth",
  "Audífonos gamer",
  "Accesorios para PC",
];

export function MegaSearchBar() {
  const dispatch = useAppDispatch();
  const search = useAppSelector((s) => s.ui.search);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [hint, setHint] = useState(0);
  const reduce = useReducedMotion();

  // El placeholder animado solo vive cuando el input está "en reposo".
  const idle = !focused && search === "";
  useEffect(() => {
    if (!idle || reduce) return;
    const t = setInterval(() => setHint((h) => (h + 1) % SUGERENCIAS.length), 3000);
    return () => clearInterval(t);
  }, [idle, reduce]);

  // Atajo "/": enfoca el buscador si no estás escribiendo en otro campo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="sticky top-[64px] z-30 -mx-4 bg-bg/80 px-4 py-3 backdrop-blur-xl">
      <div
        className={cn(
          "ease-expo relative rounded-2xl border bg-white/[0.05] backdrop-blur-md transition duration-300",
          focused
            ? "border-accent/60 shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_14%,transparent)]"
            : "border-border hover:border-accent/30",
        )}
      >
        <Search
          className={cn(
            "pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transition-colors duration-300",
            focused ? "text-accent" : "text-muted",
          )}
        />
        {/* text-base (16px) evita el zoom automático de iOS al enfocar */}
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          value={search}
          onChange={(e) => dispatch(setSearch(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder=""
          aria-label="Buscar productos"
          className="h-14 w-full rounded-2xl bg-transparent pl-12 pr-12 text-base font-medium text-text outline-none sm:pr-16"
        />

        {/* Placeholder vivo: "Buscar" + sugerencia que rota (solo decorativo) */}
        {idle && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-12 right-12 flex items-center gap-1.5 overflow-hidden sm:right-16"
          >
            <span className="shrink-0 text-base font-light text-muted">Buscar</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={hint}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="truncate text-base font-semibold text-text/75"
              >
                {SUGERENCIAS[hint]}
              </motion.span>
            </AnimatePresence>
          </div>
        )}

        {search ? (
          <button
            type="button"
            onClick={() => {
              dispatch(setSearch(""));
              inputRef.current?.focus();
            }}
            aria-label="Limpiar búsqueda"
            className="absolute right-2.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd
            aria-hidden
            className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-border bg-surface-2 px-2 py-1 font-sans text-[11px] font-semibold text-muted sm:block"
          >
            /
          </kbd>
        )}
      </div>
    </div>
  );
}
