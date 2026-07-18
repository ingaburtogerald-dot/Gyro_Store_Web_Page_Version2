import { useState, useEffect, useCallback } from "react";
import { Link } from "@remix-run/react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { AboutUsModal } from "~/components/layout/AboutUsModal";
import { useGetCatalogQuery } from "~/store/api/catalogApi";
import { getProductUrl, cn } from "~/lib/utils";

// Definición de las diapositivas del slider
interface SlideData {
  id: number;
  eyebrow: string;
  title: string;
  description: string;
  videoSrc: string;
  buttonText: string;
  actionType: "modal" | "link";
}

const SLIDES: SlideData[] = [
  {
    id: 1,
    eyebrow: "CALIDAD DE SOBRA",
    title: "Gyro Store",
    description: "Audífonos, adaptadores y accesorios tecnológicos que suenan por encima de su precio. Equipamiento premium en Managua.",
    videoSrc: "/videos/gyro-promo.mp4",
    buttonText: "Quiénes Somos",
    actionType: "modal",
  },
  {
    id: 2,
    eyebrow: "MONITOREO PROFESIONAL",
    title: "KZ EDX Pro",
    description: "Sonido de alta resolución, graves potentes y diseño ergonómico. El favorito de músicos y entusiastas del audio en Nicaragua.",
    videoSrc: "/videos/kz-edx-pro.mp4",
    buttonText: "Comprar KZ EDX Pro",
    actionType: "link",
  },
];

export function Hero({ productCount = 0 }: { productCount?: number }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [isAboutUsOpen, setIsAboutUsOpen] = useState(false);

  // Obtener catálogo para enlazar dinámicamente al producto KZ EDX Pro
  const { data: products = [] } = useGetCatalogQuery();
  
  // Buscar el producto en base a su ID exacto para no confundirlo con el EDX Pro X
  const kzProduct = products.find(p => p.id === "Fy3GdaLL2NtkR1ePArK5");
  const kzLink = kzProduct ? getProductUrl(kzProduct.id, kzProduct.name) : "/";

  const nextSlide = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % SLIDES.length);
  }, []);

  const handleDotClick = (idx: number) => {
    setActiveIndex(idx);
    setPlaying(true); // Reanudar reproducción al interactuar manualmente
  };

  const activeSlide = SLIDES[activeIndex];

  return (
    <section className="mx-auto max-w-[1400px] w-full px-4 pt-6 pb-12">
      {/* ── CONTENEDOR PRINCIPAL ESTILO DBRAND ── */}
      <div className="relative w-full bg-[#111] border border-border/40 rounded-[2.5rem] overflow-hidden shadow-2xl">
        {/* Layout Split: Flex vertical en móvil, fila 50-50 en desktop */}
        <div className="flex flex-col md:flex-row min-h-[580px] md:h-[620px] items-stretch">
          
          {/* Lado Izquierdo (Multimedia: Video Promocional) */}
          <div className="w-full md:w-1/2 relative bg-black/50 overflow-hidden h-[300px] md:h-auto flex items-center justify-center border-b border-border/30 md:border-b-0 md:border-r border-border/30">
            {/* Reproducción de video fluida con autoplay, loop e inicio silenciado */}
            <video
              key={activeSlide.videoSrc}
              src={activeSlide.videoSrc}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out"
            />
            {/* Velo oscuro para armonía de colores */}
            <div className="absolute inset-0 bg-black/10 pointer-events-none" />
          </div>

          {/* Lado Derecho (Información del Slide) */}
          <div className="w-full md:w-1/2 p-8 sm:p-12 md:p-16 flex flex-col justify-center text-left relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                {/* Eyebrow / Subtítulo superior */}
                <span className="inline-block text-xs font-black uppercase tracking-[0.2em] text-accent-2">
                  {activeSlide.eyebrow}
                </span>

                {/* Título Protagonista */}
                <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-[0.95] text-balance">
                  {activeSlide.title}
                </h1>

                {/* Descripción editorial */}
                <p className="text-sm sm:text-base text-white/70 font-medium leading-relaxed max-w-lg">
                  {activeSlide.description}
                </p>

                {/* Acción Principal */}
                <div className="pt-4">
                  {activeSlide.actionType === "modal" ? (
                    <Button
                      size="lg"
                      onClick={() => setIsAboutUsOpen(true)}
                      className="group relative overflow-hidden bg-gradient-to-r from-accent to-accent-2 text-bg font-bold py-3.5 px-8 rounded-xl shadow-md shadow-accent/15 transition-all transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/25 focus-visible:outline-none"
                    >
                      {activeSlide.buttonText}
                      <ArrowRight className="inline-block h-4 w-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                    </Button>
                  ) : (
                    <Link to={kzLink} className="inline-block">
                      <Button
                        size="lg"
                        className="group relative overflow-hidden bg-gradient-to-r from-accent to-accent-2 text-bg font-bold py-3.5 px-8 rounded-xl shadow-md shadow-accent/15 transition-all transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/25 focus-visible:outline-none"
                      >
                        {activeSlide.buttonText}
                        <ArrowRight className="inline-block h-4 w-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* ── BARRA DE NAVEGACIÓN Y PROGRESO FLOtANTE (Estilo dbrand) ── */}
      <div className="flex justify-center mt-6">
        <div className="flex items-center gap-3 bg-[#111] border border-border/40 px-4.5 py-2.5 rounded-full shadow-premium">
          {/* Botón Play/Pause */}
          <button
            onClick={() => setPlaying(!playing)}
            className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none"
            title={playing ? "Pausar presentación" : "Reanudar presentación"}
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
          <div className="flex items-center gap-2">
            {SLIDES.map((slide, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={slide.id}
                  onClick={() => handleDotClick(idx)}
                  className={cn(
                    "h-2.5 rounded-full transition-all duration-300 relative overflow-hidden bg-white/15",
                    isActive ? "w-11" : "w-2.5 hover:bg-white/35"
                  )}
                  aria-label={`Ir al slide ${idx + 1}`}
                >
                  {/* Animación del indicador de carga lineal */}
                  {isActive && (
                    <motion.div
                      key={`${activeIndex}-${playing}`}
                      initial={{ width: "0%" }}
                      animate={playing ? { width: "100%" } : { width: "0%" }}
                      transition={{ duration: 8, ease: "linear" }}
                      onAnimationComplete={nextSlide}
                      className="absolute inset-y-0 left-0 bg-accent-2 rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal interactivo de Quiénes Somos */}
      <AboutUsModal open={isAboutUsOpen} onClose={() => setIsAboutUsOpen(false)} />
    </section>
  );
}
