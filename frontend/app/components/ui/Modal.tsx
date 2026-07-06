// Modal reutilizable (reemplaza window.confirm/alert). Cierra con overlay o ESC.
// Se renderiza con un portal a <body> para escapar de ancestros con
// backdrop-filter/transform (que rompen el position: fixed).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-md",
  preventOutsideClose = false,
  headerRight,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  preventOutsideClose?: boolean;
  headerRight?: React.ReactNode;
}) {
  // El portal solo existe en cliente (Remix hace SSR).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !preventOutsideClose && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={preventOutsideClose ? undefined : onClose}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] ${maxWidth} -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-surface shadow-premium p-6 max-h-[90vh] overflow-y-auto custom-scrollbar`}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{title}</h2>
              <div className="flex items-center gap-3">
                {headerRight}
                <button onClick={onClose} aria-label="Cerrar">
                  <X className="h-5 w-5 text-muted hover:text-text" />
                </button>
              </div>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
