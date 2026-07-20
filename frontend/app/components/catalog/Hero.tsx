import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "@remix-run/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Play, Pause, ArrowRight, MessageCircle, Pencil, Trash2, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { SlideMedia, HeroSlideEditorModal } from "~/components/catalog/HeroSlideEditorModal";
import { useGetLandingConfigQuery, useUpdateLandingConfigMutation, useGetConfigQuery } from "~/store/api/catalogApi";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin, selectEditMode } from "~/store/slices/authSlice";
import type { HeroSlide, LandingConfig } from "~/types/catalog";
import { cn, buildWhatsappUrl } from "~/lib/utils";

const MAX_SLIDES = 12;
const EMPTY_LANDING: LandingConfig = { headerCategories: [], heroSlides: [] };

function newBlankSlide(): HeroSlide {
  return {
    id: `slide-${Date.now()}`,
    eyebrow: "NUEVO",
    title: "Título del slide",
    description: "Escribe aquí la descripción de esta diapositiva.",
    mediaUrl: "",
    mediaType: "image",
    buttonText: "Ver más",
    actionType: "link",
    actionTarget: "/#catalogo",
    locked: false,
  };
}

export function Hero({ initialLanding }: { initialLanding?: LandingConfig | null }) {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);

  const isAdmin = useAppSelector(selectIsAdmin);
  const editMode = useAppSelector(selectEditMode);
  const editing = isAdmin && editMode;

  // Fuente de verdad en cliente: RTK (fresca tras guardar). El loader SSR solo
  // siembra el primer render para que el Hero no parpadee.
  const { data: landingData } = useGetLandingConfigQuery();
  const landing = landingData ?? initialLanding ?? EMPTY_LANDING;
  const slides = landing.heroSlides;

  const [updateLanding, { isLoading: saving }] = useUpdateLandingConfigMutation();

  // CTA "Ordenar por WhatsApp": mismo helper y misma fuente (config.whatsapp) que
  // el resto del storefront — nunca un número hardcodeado.
  const { data: config } = useGetConfigQuery();
  const whatsappOrderUrl = buildWhatsappUrl(
    config?.whatsapp ?? "50585944758",
    "Hola Gyro Store, quiero hacer un pedido",
  );

  // El índice activo nunca debe salirse del rango (slides puede crecer/menguar).
  const safeIndex = slides.length ? Math.min(activeIndex, slides.length - 1) : 0;
  const activeSlide = slides[safeIndex];
  const editingSlide = useMemo(
    () => slides.find((s) => s.id === editingSlideId) ?? null,
    [slides, editingSlideId],
  );

  // La reproducción automática se pausa en modo edición para poder trabajar.
  const autoPlaying = playing && !editing && slides.length > 1;

  const nextSlide = useCallback(() => {
    setActiveIndex((prev) => (slides.length ? (prev + 1) % slides.length : 0));
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setActiveIndex((prev) => (slides.length ? (prev - 1 + slides.length) % slides.length : 0));
  }, [slides.length]);

  // Temporizador para reproducción automática
  useEffect(() => {
    if (!autoPlaying) return;
    const timer = setTimeout(() => {
      nextSlide();
    }, 8000);
    return () => clearTimeout(timer);
  }, [autoPlaying, safeIndex, nextSlide]);

  const handleDotClick = (idx: number) => {
    setActiveIndex(idx);
    setPlaying(true);
  };

  // Guarda el arreglo completo (Hero + orden del header intacto) en el backend.
  async function commit(nextSlides: HeroSlide[]) {
    try {
      await updateLanding({ headerCategories: landing.headerCategories, heroSlides: nextSlides }).unwrap();
    } catch (e) {
      const msg = (e as { data?: { error?: string } })?.data?.error;
      toast.error(msg || "No se pudieron guardar los cambios.");
    }
  }

  function handleSaveSlide(updated: HeroSlide) {
    commit(slides.map((s) => (s.id === updated.id ? updated : s))).then(() => {
      setEditingSlideId(null);
      toast.success("Diapositiva actualizada.");
    });
  }

  function handleAddSlide() {
    if (slides.length >= MAX_SLIDES) {
      toast.error(`Máximo ${MAX_SLIDES} diapositivas.`);
      return;
    }
    const slide = newBlankSlide();
    commit([...slides, slide]).then(() => {
      setActiveIndex(slides.length); // salta a la nueva
      setEditingSlideId(slide.id); // abre el editor de inmediato
    });
  }

  function handleDeleteSlide(idx: number) {
    const slide = slides[idx];
    if (!slide || slide.locked) return;
    if (slides.length <= 1) {
      toast.error("Debe quedar al menos una diapositiva.");
      return;
    }
    commit(slides.filter((_, i) => i !== idx)).then(() => {
      setActiveIndex((cur) => Math.max(0, Math.min(cur, slides.length - 2)));
      toast.success("Diapositiva eliminada.");
    });
  }

  // Intercambia el slide activo con su vecino. No se puede mover un slide bloqueado
  // ni desplazar a uno bloqueado de su posición (la marca queda siempre primera).
  function handleMove(dir: -1 | 1) {
    const idx = safeIndex;
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    if (slides[idx].locked || slides[target].locked) return;
    const next = [...slides];
    [next[idx], next[target]] = [next[target], next[idx]];
    commit(next).then(() => setActiveIndex(target));
  }

  const canMoveLeft = !!activeSlide && !activeSlide.locked && safeIndex > 0 && !slides[safeIndex - 1]?.locked;
  const canMoveRight = !!activeSlide && !activeSlide.locked && safeIndex < slides.length - 1;

  if (!activeSlide) {
    // Sin slides configurados (caso extremo): no romper la home.
    return null;
  }

  return (
    <section className="mx-auto max-w-[1400px] w-full px-4 pt-3 pb-6 sm:pt-6 sm:pb-12">
      {/* ── CONTENEDOR PRINCIPAL ESTILO DBRAND ── */}
      <div className="relative w-full bg-[#111] border border-border/40 rounded-[2.5rem] overflow-hidden shadow-2xl group">
        {/* Controles de edición (solo admin en modo edición) */}
        {editing && (
          <div className="absolute right-4 top-4 z-30 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-2 py-1.5 backdrop-blur-md">
            <button
              onClick={() => handleMove(-1)}
              disabled={!canMoveLeft || saving}
              title="Mover a la izquierda"
              className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleMove(1)}
              disabled={!canMoveRight || saving}
              title="Mover a la derecha"
              className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="mx-0.5 h-4 w-px bg-white/15" />
            <button
              onClick={() => setEditingSlideId(activeSlide.id)}
              title="Editar diapositiva"
              className="grid h-8 w-8 place-items-center rounded-full bg-accent/90 text-bg transition-colors hover:bg-accent"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDeleteSlide(safeIndex)}
              disabled={activeSlide.locked || slides.length <= 1 || saving}
              title={activeSlide.locked ? "La diapositiva de marca no se puede eliminar" : "Eliminar diapositiva"}
              className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition-colors hover:bg-danger hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/80"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Layout Split: Flex vertical en móvil, fila 50-50 en desktop.
            min-h más bajo + imagen más chica en móvil: el CTA debe entrar en el
            fold (375×667 con header de 69px visible) sin tocar el layout ≥md. */}
        <div className="flex flex-col md:flex-row min-h-[380px] md:h-[620px] items-stretch">

          {/* Lado Izquierdo (Multimedia: imagen/GIF/video) — mismo fondo que el
              contenedor (bg-[#111], sin /50) para que no haya costura detrás
              de la media; antes bg-black/50 sobre bg-[#111] se veía como un
              rectángulo más oscuro. */}
          <div className={cn("w-full md:w-1/2 relative bg-[#111] overflow-hidden h-[190px] sm:h-[260px] md:h-auto flex items-center justify-center border-b border-border/30 md:border-b-0 md:border-r border-border/30", safeIndex > 0 && "max-md:bg-black")}>
            {/* Glow radial muy sutil detrás de la media: le da profundidad
                intencional al vacío negro sin leerse como un círculo — blur
                alto + opacidad baja, no un halo obvio. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.16),transparent_60%)] blur-3xl"
            />
            {/* Slide 1 (Marca): object-contain con padding para que el logo respire.
                Slide 2+ (Productos): scale-125 y p-0 SOLO EN MÓVIL (max-md) para hacer
                el zoom sin afectar el diseño en escritorio. */}
            <SlideMedia
              slide={activeSlide}
              className={cn(
                "absolute inset-0 w-full h-full object-contain transition-opacity duration-700 ease-out", 
                safeIndex === 0 ? "p-2 sm:p-6" : "p-6 max-md:p-0 max-md:scale-125"
              )}
            />
            {/* Velo oscuro para armonía de colores */}
            <div className="absolute inset-0 bg-black/10 pointer-events-none" />
          </div>

          {/* Lado Derecho (Información del Slide) */}
          <div className="w-full md:w-1/2 p-5 sm:p-10 md:p-16 flex flex-col justify-center text-left relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSlide.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-2.5 sm:space-y-6"
              >
                {/* Eyebrow / Subtítulo superior */}
                <span className="inline-block text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-accent-2">
                  {activeSlide.eyebrow}
                </span>

                {/* Título Protagonista */}
                <h1 className="font-heading text-[20px] sm:text-4xl md:text-6xl font-black tracking-tight text-white leading-[0.95] text-balance">
                  {activeSlide.title}
                </h1>

                {/* Descripción editorial: recortada a 2 líneas en móvil — el CTA no
                    puede depender de qué tan larga sea la descripción de cada slide. */}
                <p className="line-clamp-2 sm:line-clamp-none text-[12px] sm:text-base text-white/70 font-medium leading-relaxed max-w-lg">
                  {activeSlide.description}
                </p>

                {/* Jerarquía de venta: Primario = configurado por el admin (ej. Ver catálogo o un link a un producto),
                    Secundario = Ordenar por WhatsApp. Lado a lado en móvil, fila en desktop. */}
                <div className="pt-2.5 sm:pt-4">
                  {/* Ambos CTAs comparten el MISMO patrón: outline sin relleno, mismo
                      tamaño y una sola línea (truncate) → simétricos. Se diferencian
                      solo por color: acento (acción principal) vs verde WhatsApp. En
                      móvil son 2 columnas iguales; desde sm van lado a lado auto-width. */}
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:gap-3">
                    {(() => {
                      const target = activeSlide.actionTarget || "/#catalogo";
                      const isExternal = target.startsWith("http");

                      return (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (isExternal) {
                              window.open(target, "_blank", "noopener,noreferrer");
                            } else {
                              navigate(target);
                            }
                          }}
                          className="group w-full sm:w-auto justify-center rounded-xl border border-accent/50 !text-accent transition-colors hover:!bg-accent/10 hover:border-accent py-2 text-[12px] sm:py-2.5 sm:px-6 sm:text-sm"
                        >
                          <span className="truncate">{activeSlide.buttonText || "Ver catálogo"}</span>
                          <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
                        </Button>
                      );
                    })()}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(whatsappOrderUrl, "_blank", "noopener,noreferrer")}
                      className="group w-full sm:w-auto justify-center rounded-xl border border-whatsapp/50 !text-whatsapp transition-colors hover:!bg-whatsapp/10 hover:border-whatsapp py-2 text-[12px] sm:py-2.5 sm:px-6 sm:text-sm"
                    >
                      <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 transition-transform duration-300 group-hover:scale-110" />
                      <span className="truncate">WhatsApp</span>
                    </Button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* ── BARRA DE NAVEGACIÓN Y PROGRESO FLOTANTE (Estilo dbrand) ── */}
      <div className="flex justify-center mt-3 sm:mt-6">
        <div className="flex items-center gap-3 bg-[#111] border border-border/40 px-4.5 py-2.5 rounded-full shadow-premium">
          {/* Botón Play/Pause — área táctil 44px en móvil (WCAG 2.5.5), compacta en desktop */}
          <button
            onClick={() => setPlaying(!playing)}
            className="grid h-11 w-11 md:h-7 md:w-7 place-items-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            title={playing ? "Pausar presentación" : "Reanudar presentación"}
            aria-label={playing ? "Pausar presentación" : "Reanudar presentación"}
          >
            {playing ? (
              <Pause className="h-3.5 w-3.5 fill-white text-white" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-white text-white ml-0.5" />
            )}
          </button>

          {/* Separador sutil */}
          <div className="h-4 w-px bg-white/10" />

          {/* Puntos / Barras de Progreso */}
          <div className="flex items-center gap-1">
            {/* Flecha Anterior */}
            {slides.length > 1 && (
              <button
                onClick={() => {
                  prevSlide();
                  setPlaying(false);
                }}
                className="grid h-11 w-11 md:h-7 md:w-7 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                title="Anterior"
                aria-label="Diapositiva anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            <div className="flex items-center gap-1 mx-1">
              {slides.map((slide, idx) => {
                const isActive = idx === safeIndex;
                return (
                  // Botón = zona táctil de 44px de alto (invisible); el pastel visible
                  // adentro sigue siendo h-2.5 — no se agranda el look, solo el hitbox.
                  <button
                    key={slide.id}
                    onClick={() => handleDotClick(idx)}
                    className="group flex h-11 items-center px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full"
                    aria-label={`Ir al slide ${idx + 1}`}
                  >
                    <span
                      className={cn(
                        "h-2.5 rounded-full transition-all duration-300 relative overflow-hidden bg-white/15",
                        isActive ? "w-11" : "w-2.5 group-hover:bg-white/35"
                      )}
                    >
                      {/* Animación del indicador de carga lineal */}
                      {isActive && autoPlaying && (
                        <motion.div
                          key={`${safeIndex}-${autoPlaying}`}
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 8, ease: "linear" }}
                          className="absolute inset-y-0 left-0 bg-accent-2 rounded-full"
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Flecha Siguiente */}
            {slides.length > 1 && (
              <button
                onClick={() => {
                  nextSlide();
                  setPlaying(false);
                }}
                className="grid h-11 w-11 md:h-7 md:w-7 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                title="Siguiente"
                aria-label="Siguiente diapositiva"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {/* Agregar diapositiva (solo modo edición) */}
            {editing && (
              <button
                onClick={handleAddSlide}
                disabled={slides.length >= MAX_SLIDES || saving}
                title={slides.length >= MAX_SLIDES ? `Máximo ${MAX_SLIDES} diapositivas` : "Agregar diapositiva"}
                aria-label={slides.length >= MAX_SLIDES ? `Máximo ${MAX_SLIDES} diapositivas` : "Agregar diapositiva"}
                className="ml-1 grid h-6 w-6 place-items-center rounded-full border border-dashed border-white/30 text-white/70 transition-colors hover:border-accent hover:text-accent disabled:opacity-30"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Editor de diapositiva (modo edición) */}
      <HeroSlideEditorModal
        open={!!editingSlide}
        slide={editingSlide}
        onClose={() => setEditingSlideId(null)}
        onSave={handleSaveSlide}
        saving={saving}
      />
    </section>
  );
}
