// Menú de navegación para móvil (<md). Antes solo listaba categorías; ahora es el
// menú principal del storefront en móvil: categorías ARRIBA y una sección de
// acciones EMBEBIDAS abajo (Reseña · WhatsApp · Opinión). Esas acciones antes eran
// botones flotantes (FABs) en las esquinas — se movieron aquí para dejar la
// pantalla limpia. Lo montan PublicHeader Y producto.$id.tsx, cada uno con su
// disparador, así queda accesible en CUALQUIER página pública en ≤2 toques.
// Reusa la MISMA fuente de categorías que el header (useGetCatalogQuery +
// useGetConfigQuery + buildCategoryTree): cero duplicación de la lista.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@remix-run/react";
import { motion, AnimatePresence } from "framer-motion";
import { X, LayoutGrid, Star, MessageCircle, Lightbulb } from "lucide-react";
import { useGetCatalogQuery, useGetConfigQuery } from "~/store/api/catalogApi";
import { buildCategoryTree } from "~/lib/categories";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { setCategory } from "~/store/slices/uiSlice";
import { cn, buildWhatsappUrl } from "~/lib/utils";
import { GOOGLE_REVIEW_URL, WHATSAPP_DEFAULT_MESSAGE } from "~/lib/storeLinks";
import { FeedbackModal } from "./FeedbackModal";

export function CategoriesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const activeCategory = useAppSelector((s) => s.ui.activeCategory);
  const { data: products = [] } = useGetCatalogQuery();
  const { data: config } = useGetConfigQuery();
  const categories = useMemo(
    () => buildCategoryTree(products, config?.categories || []),
    [products, config?.categories],
  );

  // Modal de opinión (feedback). Vive fuera del drawer para poder abrirlo tras
  // cerrar el menú, evitando pelea de z-index entre ambos overlays.
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Portal a <body>: igual que Modal.tsx, para escapar de ancestros con transform
  // (framer-motion deja uno inline incluso en reposo) que romperían el drawer fixed.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function pick(id: string | null) {
    dispatch(setCategory(id));
    onClose();
    navigate("/");
  }

  function openFeedback() {
    onClose();
    setFeedbackOpen(true);
  }

  const whatsappUrl = config?.whatsapp ? buildWhatsappUrl(config.whatsapp, WHATSAPP_DEFAULT_MESSAGE) : null;
  const googleUrl = config?.reviewLinks?.google || GOOGLE_REVIEW_URL;

  if (!mounted) return null;

  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="cat-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              key="cat-drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              role="dialog"
              aria-modal="true"
              aria-label="Menú"
              className="fixed inset-y-0 left-0 z-[100] flex w-full max-w-[320px] flex-col bg-bg shadow-2xl md:hidden"
            >
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/50 px-4">
                <span className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-text">
                  <LayoutGrid className="h-4 w-4 text-accent-2" aria-hidden /> Menú
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar menú"
                  className="grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav aria-label="Lista de categorías" className="custom-scrollbar flex-1 overflow-y-auto p-3">
                <p className="px-3.5 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-muted/70">Categorías</p>
                <button
                  type="button"
                  onClick={() => pick(null)}
                  aria-pressed={activeCategory === null}
                  className={cn(
                    "flex w-full items-center rounded-xl px-3.5 py-3 text-left text-[15px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    activeCategory === null ? "bg-accent/12 text-accent-2" : "text-text hover:bg-surface-2",
                  )}
                >
                  Todo el catálogo
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pick(c.id)}
                    aria-pressed={activeCategory === c.id}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-[15px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      activeCategory === c.id ? "bg-accent/12 text-accent-2" : "text-text hover:bg-surface-2",
                    )}
                  >
                    {c.icon && (
                      <span className="text-lg" aria-hidden>
                        {c.icon}
                      </span>
                    )}
                    {c.name}
                  </button>
                ))}
              </nav>

              {/* Acciones embebidas (antes botones flotantes) */}
              <div className="shrink-0 border-t border-border/50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                <p className="px-3.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted/70">Conecta con nosotros</p>
                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[15px] font-bold text-text transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Star className="h-5 w-5 shrink-0 text-accent-2" aria-hidden /> Dejá tu reseña
                </a>
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onClose}
                    className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[15px] font-bold text-text transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <MessageCircle className="h-5 w-5 shrink-0 text-whatsapp" aria-hidden /> Escríbenos por WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  onClick={openFeedback}
                  className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[15px] font-bold text-text transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Lightbulb className="h-5 w-5 shrink-0 text-accent-2" aria-hidden /> Danos tu opinión
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>,
    document.body,
  );
}
