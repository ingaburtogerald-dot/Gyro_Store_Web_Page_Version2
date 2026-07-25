import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Plus, ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";
import type { Category } from "~/types/catalog";

const EASE = [0.16, 1, 0.3, 1] as const;

interface DesktopNavProps {
  categories: Category[];
  availableToAdd: Category[];
  editing: boolean;
  savingHeader: boolean;
  openCat: string | null;
  moveCategory: (idx: number, dir: -1 | 1) => void;
  removeCategory: (id: string) => void;
  addCategory: (id: string) => void;
  openMenu: (id: string) => void;
  scheduleCloseMenu: () => void;
  toggleMenu: (id: string) => void;
  handleAddClick: () => void;
  addOpen: boolean;
}

export function DesktopNav({
  categories,
  availableToAdd,
  editing,
  savingHeader,
  openCat,
  moveCategory,
  removeCategory,
  addCategory,
  openMenu,
  scheduleCloseMenu,
  toggleMenu,
  handleAddClick,
  addOpen,
}: DesktopNavProps) {
  return (
    <motion.nav
      key="nav"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.28, ease: EASE }}
      aria-label="Categorías"
      onMouseLeave={editing ? undefined : scheduleCloseMenu}
      className="absolute inset-x-0 hidden items-center justify-start gap-1 md:flex"
    >
      {editing
        ? categories.map((c, idx) => (
            <div
              key={c.id}
              className="flex items-center gap-0.5 rounded-full border border-dashed border-accent/40 bg-surface-hover/60 py-1 pl-1 pr-1.5"
            >
              <button
                type="button"
                onClick={() => moveCategory(idx, -1)}
                disabled={idx === 0 || savingHeader}
                title="Mover a la izquierda"
                className="grid h-6 w-6 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="whitespace-nowrap px-1 text-[13px] font-bold tracking-[-0.02em] text-text">{c.name}</span>
              <button
                type="button"
                onClick={() => moveCategory(idx, 1)}
                disabled={idx === categories.length - 1 || savingHeader}
                title="Mover a la derecha"
                className="grid h-6 w-6 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeCategory(c.id)}
                disabled={savingHeader}
                title="Quitar del header"
                className="grid h-6 w-6 place-items-center rounded-full text-muted transition-colors hover:bg-danger hover:text-white disabled:opacity-30"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        : categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseEnter={() => openMenu(c.id)}
              onFocus={() => openMenu(c.id)}
              onClick={() => toggleMenu(c.id)}
              aria-expanded={openCat === c.id}
              className={cn(
                "flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-2 text-[14px] font-bold tracking-[-0.02em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                openCat === c.id ? "bg-surface-hover text-text" : "text-muted hover:bg-surface-hover hover:text-text",
              )}
            >
              {c.name}
              <motion.span
                aria-hidden
                animate={{ rotate: openCat === c.id ? 180 : 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="grid place-items-center"
              >
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
              </motion.span>
            </button>
          ))}

      {editing && (
        <div className="relative">
          <button
            type="button"
            onClick={handleAddClick}
            aria-disabled={availableToAdd.length === 0}
            title={availableToAdd.length === 0 ? "No hay más etiquetas disponibles" : "Agregar etiqueta"}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full border border-dashed transition-colors",
              availableToAdd.length === 0
                ? "border-border/50 text-muted/40"
                : "border-accent/50 text-accent hover:bg-accent hover:text-bg",
            )}
          >
            <Plus className="h-4 w-4" />
          </button>
          <AnimatePresence>
            {addOpen && availableToAdd.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-premium"
              >
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Agregar al header</p>
                {availableToAdd.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => addCategory(c.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-text transition-colors hover:bg-surface-hover"
                  >
                    <Plus className="h-3.5 w-3.5 text-accent-2" />
                    {c.name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.nav>
  );
}
