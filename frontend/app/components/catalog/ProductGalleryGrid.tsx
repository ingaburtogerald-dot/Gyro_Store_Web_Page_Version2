import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageOff, X } from "lucide-react";
import { cn } from "~/lib/utils";

interface ProductGalleryGridProps {
  gallery: string[];
  baseName: string;
  inStock: boolean;
  productId: string;
}

export function ProductGalleryGrid({ gallery, baseName, inStock, productId }: ProductGalleryGridProps) {
  const [activeImage, setActiveImage] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    setActiveImage(0);
  }, [gallery]);

  return (
    <>
      <div className="md:sticky md:top-24 h-fit">
        <div className="relative w-full group/gallery">
          {/* Sin glow ambiental: el product-stage ya aporta profundidad editorial
              con su foco radial. Las hairlines y el tipo cargan la jerarquía. */}
          <button
            type="button"
            onClick={() => (gallery[activeImage] ?? gallery[0]) && setLightbox(true)}
            onMouseMove={(e) => {
              const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - left) / width) * 100;
              const y = ((e.clientY - top) / height) * 100;
              setZoomPos({ x, y });
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
              setIsHovered(false);
              setZoomPos({ x: 50, y: 50 });
            }}
            className="product-stage group relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-none p-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            aria-label="Ampliar imagen"
          >
            <AnimatePresence mode="wait">
              {gallery[activeImage] ?? gallery[0] ? (
                <motion.img
                  key={activeImage}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.3 }}
                  src={gallery[activeImage] ?? gallery[0]}
                  alt={baseName}
                  fetchPriority="high"
                  loading="eager"
                  decoding="async"
                  drag={gallery.length > 1 ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.4}
                  onDragEnd={(event, info) => {
                    const swipeThreshold = 50;
                    if (info.offset.x < -swipeThreshold) {
                      setActiveImage((prev) => (prev + 1) % gallery.length);
                    } else if (info.offset.x > swipeThreshold) {
                      setActiveImage((prev) => (prev - 1 + gallery.length) % gallery.length);
                    }
                  }}
                  className="h-full w-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.15)] select-none transition-transform duration-150 ease-out"
                  style={{
                    viewTransitionName: `vt-product-${productId}`,
                    transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                    transform: isHovered ? `scale(1.25)` : `scale(1)`,
                  } as React.CSSProperties}
                />
              ) : (
                <motion.div key="empty" className="grid h-full place-items-center text-muted">
                  <ImageOff className="h-12 w-12 opacity-50" />
                </motion.div>
              )}
            </AnimatePresence>
            {!inStock && (
              <span className="absolute left-4 top-4 rounded-pill bg-bg/85 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-text backdrop-blur-md shadow-sm">
                Agotado
              </span>
            )}
          </button>
        </div>

        {/* Pagination Dots (Solo móvil para swipe) */}
        {gallery.length > 1 && (
          <div className="mt-4 flex justify-center gap-1.5 md:hidden">
            {gallery.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveImage(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === activeImage ? "w-4 bg-accent" : "w-1.5 bg-border"
                )}
                aria-label={`Ir a imagen ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Thumbnails */}
        {gallery.length > 1 && (
          <div className="mt-5 flex flex-wrap gap-3">
            {gallery.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={cn(
                  "product-stage relative h-20 w-20 overflow-hidden rounded-none border transition-all hover:scale-105",
                  i === activeImage ? "border-accent ring-2 ring-accent ring-offset-2 ring-offset-bg opacity-100" : "border-border hover:border-accent/50 opacity-70 hover:opacity-100"
                )}
              >
                <img src={img} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox de imagen */}
      <AnimatePresence>
        {lightbox && (gallery[activeImage] ?? gallery[0]) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(false)}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-bg/95 p-4 backdrop-blur-sm"
          >
            <button
              onClick={() => setLightbox(false)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2.5 text-white transition-all hover:bg-white/20 hover:scale-105 active:scale-95"
            >
              <X className="h-6 w-6" />
            </button>
            <motion.img
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              src={gallery[activeImage] ?? gallery[0]}
              alt={baseName}
              className="max-h-[90vh] max-w-[90vw] object-contain drop-shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
