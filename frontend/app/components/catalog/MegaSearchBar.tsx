// Buscador dominante del storefront — ahora vive DENTRO del header (Amazon-style).
// Misma fuente de verdad (ui.search en Redux); reusa su piel y su invitación:
//  - Glass midnight con foco cyan (borde + halo suave, sin glow neón).
//  - Placeholder "vivo": rota sugerencias reales ("Audífonos KZ"…) solo cuando
//    el input está vacío, sin foco y sin prefers-reduced-motion.
//  - Atajo "/" para enfocar desde el teclado (chip visible solo en desktop).
// Es un input reusable: el contenedor (header) controla el ancho/posición. El
// prop `size` ajusta la altura para la fila del header (md) vs. el hero móvil (lg).
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

export function MegaSearchBar({
  size = "md",
  className,
}: {
  /** "md" = fila del header (compacto); "lg" = versión dominante (móvil). */
  size?: "md" | "lg";
  className?: string;
}) {
  const dispatch = useAppDispatch();
  const search = useAppSelector((s) => s.ui.search);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [hint, setHint] = useState(0);
  const reduce = useReducedMotion();
  const tall = size === "lg";

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
    <div
      className={cn(
        "ease-expo group relative flex w-full items-stretch overflow-hidden rounded-pill border bg-surface-2/70 backdrop-blur-md transition duration-300",
        focused
          ? "border-accent/70 ring-4 ring-accent/20"
          : "border-border hover:border-white/20",
        className,
      )}
    >
      {/* Icono de búsqueda a la izquierda (se enciende al enfocar). */}
      <span
        className={cn(
          "pointer-events-none grid shrink-0 place-items-center pl-4 pr-2 transition-colors",
          focused ? "text-accent-2" : "text-muted",
        )}
        aria-hidden
      >
        <Search className="h-[18px] w-[18px]" />
      </span>

      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          value={search}
          onChange={(e) => dispatch(setSearch(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={idle ? "" : "Buscar productos…"}
          aria-label="Buscar productos"
          className={cn(
            "w-full bg-transparent pr-10 text-[15px] font-medium text-text outline-none placeholder:text-muted",
            "[&::-webkit-search-cancel-button]:appearance-none",
            tall ? "h-12" : "h-11",
          )}
        />

        {/* Placeholder "vivo": rota sugerencias reales solo cuando el input está en reposo. */}
        {idle && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center overflow-hidden text-[15px] text-muted">
            <span className="mr-1">Buscar</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={hint}
                initial={reduce ? false : { y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduce ? undefined : { y: -14, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="font-semibold text-text/80"
              >
                {SUGERENCIAS[hint]}
              </motion.span>
            </AnimatePresence>
          </div>
        )}
      </div>

      {search && (
        <button
          type="button"
          onClick={() => {
            dispatch(setSearch(""));
            inputRef.current?.focus();
          }}
          aria-label="Limpiar búsqueda"
          className="my-auto mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-text"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Botón de búsqueda (acento) — texto oscuro sobre cyan para contraste AA. */}
      <button
        type="button"
        aria-label="Buscar"
        className="my-1 mr-1 flex shrink-0 items-center justify-center rounded-pill bg-accent px-5 text-bg transition-colors hover:bg-accent-2"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
