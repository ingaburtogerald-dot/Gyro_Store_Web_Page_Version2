import { useState } from "react";
import { Link, NavLink } from "@remix-run/react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, MessageCircle, Shield, Store } from "lucide-react";
import { Logo } from "~/components/ui/Logo";
import { cn } from "~/lib/utils";
import type { Category } from "~/types/catalog";
import type { NavGroup } from "./navigation";

const EASE = [0.16, 1, 0.3, 1] as const;

export function RailPanelContent({
  categories,
  businessGroups,
  badges,
  authed,
  reduce,
  collapsed = false,
  hideLogo = false,
  onGoCategory,
  onGoHome,
  onNavigate,
}: {
  categories: Category[];
  businessGroups: NavGroup[];
  badges: Record<string, number>;
  authed: boolean;
  reduce: boolean;
  collapsed?: boolean;
  hideLogo?: boolean;
  onGoCategory: (id: string | null) => void;
  onGoHome: () => void;
  onNavigate: () => void;
}) {
  const [openCat, setOpenCat] = useState<string | null>(null);

  const reveal = cn("whitespace-nowrap transition-opacity duration-200", collapsed && "pointer-events-none opacity-0");

  return (
    <div>
      {authed && !hideLogo && (
        <div className="mb-6 px-3">
          <Link to="/" onClick={onNavigate} className="transition-transform active:scale-95 inline-block">
            <Logo size={80} />
          </Link>
        </div>
      )}

      {!authed && !collapsed && categories.length > 0 && (
        <section className="mb-6">
          <p className="mb-2 px-3 text-[15px] font-extrabold uppercase tracking-wider text-white">Categorías</p>
          <ul className="flex flex-col">
            {categories.map((c) => {
              const hasSub = Boolean(c.subcategories && c.subcategories.length > 0);
              const isOpen = openCat === c.id;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => (hasSub ? setOpenCat(isOpen ? null : c.id) : onGoCategory(c.id))}
                    aria-expanded={hasSub ? isOpen : undefined}
                    className="group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span
                      className={cn(
                        "text-[15px] font-semibold tracking-tight transition-colors",
                        isOpen ? "text-accent-2" : "text-text group-hover:text-accent-2",
                      )}
                    >
                      {c.name}
                    </span>
                    {hasSub ? (
                      <motion.span
                        aria-hidden
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={reduce ? { duration: 0 } : { duration: 0.3, ease: EASE }}
                        className={cn(
                          "grid h-6 w-6 place-items-center rounded-full transition-colors",
                          isOpen ? "bg-accent/12 text-accent-2" : "text-muted group-hover:text-accent-2",
                        )}
                      >
                        <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
                      </motion.span>
                    ) : (
                      <ChevronRight
                        aria-hidden
                        className="h-4 w-4 -translate-x-2 text-muted opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-accent-2 group-hover:opacity-100"
                      />
                    )}
                  </button>

                  {hasSub && (
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="sub"
                          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                          animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                          transition={
                            reduce
                              ? { duration: 0.15 }
                              : { height: { duration: 0.35, ease: EASE }, opacity: { duration: 0.2, ease: EASE } }
                          }
                          className="overflow-hidden"
                        >
                          <div className="my-1 ml-3 flex flex-col gap-0.5 border-l border-border pb-2 pl-3">
                            <button
                              onClick={() => onGoCategory(c.id)}
                              className="group/all flex items-center justify-between rounded-md px-3 py-2 text-[13px] font-semibold text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                              <span>Ver todo en {c.name}</span>
                              <ChevronRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/all:translate-x-0.5" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {authed && businessGroups.length > 0 && (
        <section className="mb-6">
          <p className={cn("mb-2 px-3 text-[15px] font-black uppercase tracking-wider text-white", reveal)}>Tienda</p>
          <div className="flex flex-col gap-3">
            {businessGroups.map((group) => (
              <div key={group.label}>
                {businessGroups.length > 1 && group.label.toLowerCase() !== "tienda" && (
                  <p className={cn("mb-1 px-3 text-[14px] font-extrabold uppercase tracking-wider text-white", reveal)}>
                    {group.label}
                  </p>
                )}
                <div className="flex flex-col gap-0.5">
                  {group.label.toLowerCase() === "tienda" && (
                    <Link
                      to="/"
                      onClick={onGoHome}
                      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Store className="h-[18px] w-[18px] shrink-0" />
                      <span className={cn("flex-1 text-left truncate", reveal)}>Ir al catálogo</span>
                    </Link>
                  )}
                  {group.items.map(({ to, label, icon: Icon }) => {
                    const badge = badges[to] ?? 0;
                    return (
                      <NavLink
                        key={to}
                        to={to}
                        onClick={onNavigate}
                        title={label}
                        className={({ isActive }) =>
                          cn(
                            "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                            isActive ? "bg-accent/12 font-bold text-accent-2" : "text-white hover:bg-white/10",
                          )
                        }
                      >
                        <span className="relative shrink-0">
                          <Icon className="h-[18px] w-[18px]" />
                          {collapsed && badge > 0 && (
                            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-warning ring-2 ring-black" />
                          )}
                        </span>
                        <span className={cn("flex-1 truncate", reveal)}>{label}</span>
                        {badge > 0 && (
                          <span className={cn("rounded-pill bg-warning/15 px-1.5 text-[11px] font-bold leading-4 text-warning", reveal)}>
                            {badge}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-border pt-5">
        <p className={cn("mb-2 px-3 text-[15px] font-black uppercase tracking-wider text-white", reveal)}>Ayuda e información</p>
        <div className="flex flex-col">
          <Link
            to="/contacto"
            onClick={onNavigate}
            title="Contacto"
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <MessageCircle className="h-[18px] w-[18px] shrink-0 text-white transition-colors group-hover:text-white" />
            <span className={cn("whitespace-nowrap font-medium transition-all duration-300 group-hover:translate-x-0.5", collapsed && "pointer-events-none opacity-0")}>Contacto</span>
          </Link>
          {!authed && (
            <Link
              to="/login"
              onClick={onNavigate}
              title="Acceso Colaboradores"
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Shield className="h-[18px] w-[18px] shrink-0 text-white transition-colors group-hover:text-white" />
              <span className={cn("whitespace-nowrap font-medium transition-all duration-300 group-hover:translate-x-0.5", collapsed && "pointer-events-none opacity-0")}>Acceso Colaboradores</span>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
