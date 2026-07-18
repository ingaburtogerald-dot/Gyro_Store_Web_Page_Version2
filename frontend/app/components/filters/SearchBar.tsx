// Buscador del storefront. Dos pieles en un solo componente:
//   - variant="default"  → skin clásica (glass, esquina suave). La usan AppShell y
//                           demás llamadas existentes: su comportamiento no cambia.
//   - variant="pill"     → skin limpia tipo "píldora" (Apple/Razer) para el header
//                           desplegable. Con `withPanel` despliega un dropdown de
//                           recomendaciones (keywords populares + productos destacados).
//
// Fuente de verdad compartida: `ui.search` en Redux (el contenedor controla ancho
// y posición). El prop `size` ajusta la altura.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, X, TrendingUp, ArrowUpRight } from "lucide-react";
import { cn } from "~/lib/utils";

// Lo que la gente realmente busca en la tienda (invita a escribir / placeholder vivo).
const SUGERENCIAS = [
  "Audífonos KZ",
  "Adaptadores Bluetooth",
  "Audífonos gamer",
  "Accesorios para PC",
];

// ── Datos de ejemplo del panel de recomendaciones ──
// (placeholders: cámbialos luego por datos reales del catálogo).
const KEYWORDS_POPULARES = [
  "KZ ZSN Pro",
  "Bluetooth 5.3",
  "Cable plata",
  "Espuma memory",
  "Adaptador USB-C",
  "Gaming",
];

const PRODUCTOS_DESTACADOS = [
  { id: "kz-zsn-pro-x", name: "KZ ZSN Pro X", price: "₡18.900", tone: "from-cyan-500/25 to-blue-600/25" },
  { id: "kz-castor", name: "KZ Castor Harman", price: "₡24.500", tone: "from-emerald-500/25 to-teal-600/25" },
  { id: "adaptador-bt", name: "Adaptador BT 5.3", price: "₡12.200", tone: "from-fuchsia-500/25 to-purple-600/25" },
  { id: "cable-plata", name: "Cable Plata 2pin", price: "₡9.800", tone: "from-amber-500/25 to-orange-600/25" },
];

const EASE = [0.16, 1, 0.3, 1] as const;

export function SearchBar({
  value,
  onChange,
  onClear,
  onSubmit,
  size = "md",
  variant = "default",
  withPanel = false,
  autoFocus = false,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  onClear: () => void;
  /** Se dispara al presionar Enter (o al elegir una keyword/producto del panel). */
  onSubmit?: (val: string) => void;
  /** "md" = fila del header; "lg" = versión dominante; "sm" = móvil/compacto */
  size?: "sm" | "md" | "lg";
  /** "default" = glass clásico; "pill" = píldora limpia (Apple/Razer) */
  variant?: "default" | "pill";
  /** Solo con variant="pill": despliega el panel de recomendaciones al enfocar. */
  withPanel?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [hint, setHint] = useState(0);
  const [isMac, setIsMac] = useState(false);
  const reduce = useReducedMotion();
  const pill = variant === "pill";
  const tall = size === "lg";

  // Detecta la plataforma para el atajo correcto (⌘ en Mac, Ctrl en el resto).
  useEffect(() => {
    setIsMac(/mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent));
  }, []);

  // Autofoco al montar (usado cuando el header despliega la búsqueda).
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // El placeholder animado solo vive cuando el input está "en reposo".
  const idle = !focused && value === "";
  useEffect(() => {
    if (!idle || reduce) return;
    const t = setInterval(() => setHint((h) => (h + 1) % SUGERENCIAS.length), 3000);
    return () => clearInterval(t);
  }, [idle, reduce]);

  // Atajo ⌘K / Ctrl+K: enfoca el buscador desde cualquier parte.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey) || e.altKey) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(v: string) {
    onSubmit?.(v);
  }

  function pickKeyword(kw: string) {
    onChange(kw);
    submit(kw);
    inputRef.current?.focus();
  }

  const panelOpen = pill && withPanel && focused;

  return (
    <div className={cn("relative w-full", className)}>
      <div
        className={cn(
          "ease-expo group relative flex w-full items-stretch transition duration-300",
          pill
            ? // Píldora limpia: borde suave, totalmente redondeada, foco con halo contenido.
              cn(
                "rounded-pill border bg-surface/70 backdrop-blur-xl",
                focused ? "border-accent/60 ring-4 ring-accent/15" : "border-border/70 hover:border-border",
              )
            : // Glass clásico (comportamiento previo intacto).
              cn(
                "overflow-hidden rounded-lg border bg-surface/60 backdrop-blur-xl",
                focused ? "border-accent/60 shadow-none ring-4 ring-accent/15" : "border-border/70 hover:border-border",
              ),
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
            // Delay en el blur para que el clic en el panel se registre antes de cerrarlo.
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit(value);
            }}
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
                  transition={{ duration: 0.35, ease: EASE }}
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

        {/* Hint de teclado ⌘K / Ctrl+K — solo en reposo y desktop. */}
        {idle && (
          <kbd className="my-auto mr-1.5 hidden h-7 select-none items-center gap-0.5 rounded-md border border-border bg-surface-2/70 px-2 text-[12px] font-semibold text-muted md:inline-flex">
            {isMac ? "⌘" : "Ctrl"} K
          </kbd>
        )}

        {/* Botón de acento — integrado. Enfoca / envía la búsqueda. */}
        <button
          type="button"
          aria-label="Buscar"
          onClick={() => {
            inputRef.current?.focus();
            submit(value);
          }}
          className={cn(
            "my-1.5 mr-1.5 flex aspect-square shrink-0 items-center justify-center bg-accent text-bg transition-all duration-300 hover:bg-accent-hover active:scale-95",
            pill ? "rounded-full" : "rounded-md",
          )}
        >
          <Search className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* ── Panel de recomendaciones (solo pill + withPanel) ── */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            key="reco-panel"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="absolute left-0 right-0 top-full z-50 mt-3 overflow-hidden rounded-2xl border border-border/70 bg-surface/95 p-5 shadow-premium backdrop-blur-2xl"
            // Evita que el blur del input cierre el panel al hacer clic dentro.
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              {/* Keywords populares */}
              <div>
                <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  <TrendingUp className="h-3.5 w-3.5 text-accent-2" />
                  Búsquedas populares
                </p>
                <div className="flex flex-wrap gap-2">
                  {KEYWORDS_POPULARES.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => pickKeyword(kw)}
                      className="rounded-pill border border-border bg-surface-2/60 px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-text"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>

              {/* Productos destacados */}
              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Destacados
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PRODUCTOS_DESTACADOS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickKeyword(p.name)}
                      className="group/card flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/40 p-2 text-left transition-colors hover:border-accent/40 hover:bg-surface-2/70"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br",
                          p.tone,
                        )}
                      >
                        <Search className="h-4 w-4 text-text/50" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-text">{p.name}</span>
                        <span className="block text-[12px] text-muted">{p.price}</span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 -translate-x-1 text-muted opacity-0 transition-all duration-300 group-hover/card:translate-x-0 group-hover/card:text-accent-2 group-hover/card:opacity-100" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
