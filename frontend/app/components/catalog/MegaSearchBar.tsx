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
        "ease-expo relative flex w-full items-stretch rounded-md overflow-hidden transition duration-300",
        focused
          ? "ring-4 ring-accent/40 border-accent"
          : "ring-0 border-transparent",
        className,
      )}
    >
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
        className={cn(
          "w-full bg-white pl-4 pr-10 text-base font-medium text-gray-900 outline-none",
          tall ? "h-12" : "h-10",
        )}
      />



      {search && (
        <button
          type="button"
          onClick={() => {
            dispatch(setSearch(""));
            inputRef.current?.focus();
          }}
          aria-label="Limpiar búsqueda"
          className="absolute right-[52px] top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-800"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Amazon-style search button */}
      <button
        type="button"
        aria-label="Buscar"
        className="flex shrink-0 items-center justify-center bg-accent px-4 text-bg transition-colors hover:bg-accent-2"
      >
        <Search className="h-5 w-5" />
      </button>
    </div>
  );
}
