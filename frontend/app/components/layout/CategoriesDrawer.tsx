// Drawer de categorías para móvil (<md). Sin esto, un usuario en el teléfono no
// tenía forma de navegar categorías fuera de la home (el mega-menú de PublicHeader
// es `hidden md:flex`, y /producto ni siquiera monta PublicHeader). Lo montan
// PublicHeader Y ProductTopNav, cada uno con su propio botón disparador — así
// queda accesible en CUALQUIER página pública en ≤2 toques.
// Reusa la MISMA fuente de categorías que el header (useGetCatalogQuery +
// useGetConfigQuery + buildCategoryTree): cero duplicación de la lista.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@remix-run/react";
import { motion, AnimatePresence } from "framer-motion";
import { X, LayoutGrid } from "lucide-react";
import { useGetCatalogQuery, useGetConfigQuery } from "~/store/api/catalogApi";
import { buildCategoryTree } from "~/lib/categories";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { setCategory } from "~/store/slices/uiSlice";
import { cn } from "~/lib/utils";

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

  if (!mounted) return null;

  return createPortal(
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
            aria-label="Categorías"
            className="fixed inset-y-0 left-0 z-[100] flex w-full max-w-[320px] flex-col bg-bg shadow-2xl md:hidden"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/50 px-4">
              <span className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-text">
                <LayoutGrid className="h-4 w-4 text-accent-2" aria-hidden /> Categorías
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar categorías"
                className="grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="Lista de categorías" className="custom-scrollbar flex-1 overflow-y-auto p-3">
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
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
