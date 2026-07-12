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
import { cn } from "~/lib/utils";

// Lo que la gente realmente busca en la tienda (invita a escribir).
const SUGERENCIAS = [
  "Audífonos KZ",
  "Adaptadores Bluetooth",
  "Audífonos gamer",
  "Accesorios para PC",
];

export function SearchBar({
  value,
  onChange,
  onClear,
  size = "md",
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  onClear: () => void;
  /** "md" = fila del header (compacto); "lg" = versión dominante (móvil); "sm" = móvil header */
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [hint, setHint] = useState(0);
  const [isMac, setIsMac] = useState(false);
  const reduce = useReducedMotion();
  const tall = size === "lg";

  // Detecta la plataforma para mostrar el atajo correcto (⌘ en Mac, Ctrl en el resto).
  useEffect(() => {
    setIsMac(/mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent));
  }, []);

  // El placeholder animado solo vive cuando el input está "en reposo".
  const idle = !focused && value === "";
  useEffect(() => {
    if (!idle || reduce) return;
    const t = setInterval(() => setHint((h) => (h + 1) % SUGERENCIAS.length), 3000);
    return () => clearInterval(t);
  }, [idle, reduce]);

  // Atajo ⌘K / Ctrl+K: enfoca el buscador desde cualquier parte (patrón command-palette).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey) || e.altKey) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className={cn(
        // Spotlight/command-palette: superficie de vidrio, esquina suave, y al
        // enfocar un halo de acento contenido (sin neón permanente).
        "ease-expo group relative flex w-full items-stretch overflow-hidden rounded-2xl border bg-surface/60 backdrop-blur-xl transition duration-300",
        focused
          ? "border-accent/60 ring-4 ring-accent/15 shadow-none"
          : "border-border/70 hover:border-border",
        className,
      )}
    >
      {/* Icono de búsqueda a la izquierda (se enciende al enfocar). */}
      <span
        className={cn(
          "pointer-events-none grid shrink-0 place-items-center pl-4 pr-2.5 transition-colors",
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={idle ? "" : "Buscar productos…"}
          aria-label="Buscar productos"
          className={cn(
            "w-full bg-transparent pr-10 text-[15px] font-medium text-text outline-none placeholder:text-muted",
            "[&::-webkit-search-cancel-button]:appearance-none",
            tall ? "h-14" : "h-12",
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

      {value && (
        <button
          type="button"
          onClick={() => {
            onClear();
            inputRef.current?.focus();
          }}
          aria-label="Limpiar búsqueda"
          className="my-auto mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Hint de teclado ⌘K / Ctrl+K — solo en reposo y desktop (la búsqueda es en vivo). */}
      {idle && (
        <kbd className="my-auto mr-1.5 hidden h-7 select-none items-center gap-0.5 rounded-md border border-border bg-surface-2/70 px-2 text-[12px] font-semibold text-muted md:inline-flex">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      )}

      {/* Botón de acento — integrado (cuadrado redondeado, inset). La búsqueda ya
          es en vivo, así que su única acción es enfocar el input. */}
      <button
        type="button"
        aria-label="Buscar"
        onClick={() => inputRef.current?.focus()}
        className="my-1.5 mr-1.5 flex aspect-square shrink-0 items-center justify-center rounded-xl bg-accent text-bg transition-all duration-300 hover:bg-accent-hover active:scale-95"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
