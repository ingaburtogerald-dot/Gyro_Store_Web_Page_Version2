import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "~/lib/utils";

interface FormDrawerLayoutProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string; // e.g. "max-w-2xl"
}

export function FormDrawerLayout({
  open,
  onClose,
  title,
  subtitle,
  headerActions,
  footer,
  children,
  maxWidth = "max-w-2xl",
}: FormDrawerLayoutProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer */}
          <div
            className={cn(
              "fixed inset-y-0 right-0 z-[100] w-full flex flex-col pointer-events-none sm:w-auto shadow-2xl bg-surface",
              maxWidth
            )}
            style={{ width: "100%" }}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex h-full w-full flex-col overflow-hidden bg-surface pointer-events-auto"
            >
              {/* Header */}
              <header className="flex flex-col gap-2 border-b border-border p-4 bg-surface/60 backdrop-blur-xl shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    {typeof title === "string" ? (
                      <h2 className="text-lg font-bold text-text truncate">{title}</h2>
                    ) : (
                      title
                    )}
                    {subtitle && (
                      typeof subtitle === "string" ? (
                        <p className="text-sm text-muted">{subtitle}</p>
                      ) : (
                        subtitle
                      )
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {headerActions}
                    <button
                      type="button"
                      onClick={onClose}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </header>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-bg">
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <footer className="shrink-0 border-t border-border bg-surface p-4">
                  {footer}
                </footer>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
