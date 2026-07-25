import { Link } from "@remix-run/react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";
import { formatCordobas, getProductUrl } from "~/lib/utils";
import type { Category, CatalogProduct } from "~/types/catalog";

const EASE = [0.16, 1, 0.3, 1] as const;

interface MegaMenuPanelProps {
  activeCat: Category | null;
  searchOpen: boolean;
  activeList: CatalogProduct[];
  goCategory: (id: string) => void;
  setOpenCat: (id: string | null) => void;
  cancelCloseMenu: () => void;
  scheduleCloseMenu: () => void;
}

export function MegaMenuPanel({
  activeCat,
  searchOpen,
  activeList,
  goCategory,
  setOpenCat,
  cancelCloseMenu,
  scheduleCloseMenu,
}: MegaMenuPanelProps) {
  return (
    <AnimatePresence>
      {activeCat && !searchOpen && (
        <motion.div
          key="mega-panel"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.24, ease: EASE }}
          onMouseEnter={cancelCloseMenu}
          onMouseLeave={scheduleCloseMenu}
          className="absolute left-0 right-0 top-full hidden border-b border-border/50 bg-bg/95 shadow-premium backdrop-blur-xl md:block"
        >
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-bold tracking-[-0.01em] text-text">{activeCat.name}</h3>
              <button
                type="button"
                onClick={() => goCategory(activeCat.id)}
                className="group/all inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold tracking-[-0.01em] text-accent-2 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Ver todo
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/all:translate-x-0.5" />
              </button>
            </div>

            {activeList.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {activeList.slice(0, 10).map((p) => (
                  <Link
                    key={p.id}
                    to={getProductUrl(p.id, p.name)}
                    onClick={() => setOpenCat(null)}
                    className="group/card flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface/40 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <div className="product-stage grid aspect-square place-items-center overflow-hidden p-3">
                      {p.images?.[0] ? (
                        <img
                          src={p.images[0]}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-contain transition-transform duration-300 group-hover/card:scale-105"
                        />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-muted">
                          <Search className="h-5 w-5" />
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5 p-3">
                      <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-text">{p.name}</span>
                      <span className="mt-auto pt-1 text-[13px] font-bold tabular-nums text-accent-2">
                        {formatCordobas(p.price)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted">Aún no hay productos en esta categoría.</p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
