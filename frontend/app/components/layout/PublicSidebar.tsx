import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  X,
  User,
  ArrowRight,
  ChevronDown,
  Home,
  MessageCircle,
  Shield,
  LogIn,
  MonitorCog,
} from "lucide-react";
import { Link, useNavigate } from "@remix-run/react";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { closePublicSidebar, setCategory, resetFilters } from "~/store/slices/uiSlice";
import { selectUser, selectStatus, selectRoles } from "~/store/slices/authSlice";
import { roleLandingPath } from "~/lib/constants";
import { getProductUrl } from "~/lib/utils";
import type { Category } from "~/store/api/catalogApi";

interface Props {
  categories: Category[];
}

// ease-out exponencial del sistema (DESIGN.md §5). Un solo lenguaje de motion.
const EASE = [0.16, 1, 0.3, 1] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

export function PublicSidebar({ categories }: Props) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const open = useAppSelector((s) => s.ui.publicSidebarOpen);
  const user = useAppSelector(selectUser);
  const status = useAppSelector(selectStatus);
  const roles = useAppSelector(selectRoles);
  const authed = status === "authenticated" && Boolean(user);
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "";

  // Acordeón de una sola categoría abierta a la vez.
  const [openCat, setOpenCat] = useState<string | null>(null);

  // Al cerrar el menú, colapsa el acordeón para que reabra siempre limpio.
  useEffect(() => {
    if (!open) setOpenCat(null);
  }, [open]);

  function close() {
    dispatch(closePublicSidebar());
  }

  function handleCategory(id: string | null) {
    dispatch(setCategory(id));
    close();
    navigate("/");
  }

  function handleHomeClick() {
    dispatch(resetFilters());
    dispatch(setCategory(null));
    close();
    navigate("/");
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            onClick={close}
            className="fixed inset-0 z-[49] bg-black/60 backdrop-blur-md"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.aside
            key="sidebar-panel"
            initial={reduce ? { opacity: 0 } : { x: "-100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "-100%" }}
            transition={reduce ? { duration: 0.2 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 left-0 z-50 flex w-full max-w-[380px] flex-col bg-bg shadow-[20px_0_60px_-15px_rgba(0,0,0,0.7)]"
          >
            {/* ── Header: identidad ── */}
            <header className="flex shrink-0 items-center justify-between border-b border-white/5 bg-surface px-6 py-6">
              <div className="flex min-w-0 items-center gap-4">
                {authed && user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                  />
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-bg ring-1 ring-white/10">
                    <User className="h-6 w-6" />
                  </div>
                )}
                <div className="flex min-w-0 flex-col">
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
                    {authed ? "Hola," : "Bienvenido"}
                  </span>
                  <span className="truncate text-xl font-extrabold tracking-tight text-text">
                    {authed ? firstName || user!.name : "Invitado"}
                  </span>
                </div>
              </div>
              <button
                onClick={close}
                aria-label="Cerrar menú"
                className="group -mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="h-5 w-5 text-muted transition-all duration-300 group-hover:rotate-90 group-hover:text-text" />
              </button>
            </header>

            {/* ── Cuerpo desplazable ── */}
            <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-5">
              {/* Acción principal: volver al inicio (CTA sólido cyan, DESIGN.md §7) */}
              <motion.button
                onClick={handleHomeClick}
                whileHover={reduce ? undefined : { scale: 1.015 }}
                whileTap={reduce ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="group mb-8 flex w-full items-center justify-between gap-3 rounded-lg bg-accent px-4 py-3.5 text-[15px] font-bold text-bg transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <span className="flex items-center gap-2.5">
                  <Home className="h-[18px] w-[18px]" strokeWidth={2.25} />
                  Volver al inicio
                </span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </motion.button>

              {/* Sección: categorías (acordeón) */}
              <motion.nav
                variants={containerVariants}
                initial={reduce ? false : "hidden"}
                animate="show"
                aria-label="Categorías de productos"
              >
                <motion.p
                  variants={itemVariants}
                  className="mb-3 px-3 text-[11px] font-medium uppercase tracking-[0.22em] text-muted"
                >
                  Productos
                </motion.p>

                <ul className="flex flex-col">
                  {categories.map((c) => {
                    const hasSub = Boolean(c.subcategories && c.subcategories.length > 0);
                    const isOpen = openCat === c.id;

                    return (
                      <motion.li variants={itemVariants} key={c.id}>
                        <button
                          onClick={() =>
                            hasSub ? setOpenCat(isOpen ? null : c.id) : handleCategory(c.id)
                          }
                          aria-expanded={hasSub ? isOpen : undefined}
                          className="group flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <span
                            className={`text-[16px] font-bold tracking-tight transition-colors ${
                              isOpen ? "text-accent-2" : "text-text group-hover:text-accent-2"
                            }`}
                          >
                            {c.name}
                          </span>
                          {hasSub ? (
                            <motion.span
                              aria-hidden
                              animate={{ rotate: isOpen ? 180 : 0 }}
                              transition={reduce ? { duration: 0 } : { duration: 0.35, ease: EASE }}
                              className={`grid h-6 w-6 place-items-center rounded-full transition-colors ${
                                isOpen
                                  ? "bg-accent/12 text-accent-2"
                                  : "text-muted group-hover:text-accent-2"
                              }`}
                            >
                              <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
                            </motion.span>
                          ) : (
                            <ArrowRight
                              aria-hidden
                              className="h-4 w-4 -translate-x-2 text-muted opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-accent-2 group-hover:opacity-100"
                            />
                          )}
                        </button>

                        {hasSub && (
                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                key="panel"
                                initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                                animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                                exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                                transition={
                                  reduce
                                    ? { duration: 0.15 }
                                    : {
                                        height: { duration: 0.4, ease: EASE },
                                        opacity: { duration: 0.25, ease: EASE },
                                      }
                                }
                                className="overflow-hidden"
                              >
                                <div className="my-1 ml-3 flex flex-col gap-0.5 border-l border-white/10 pb-2 pl-3">
                                  {/* Ver todo → filtro de la categoría completa */}
                                  <button
                                    onClick={() => handleCategory(c.id)}
                                    className="group/all flex items-center justify-between rounded-md px-3 py-2 text-[13px] font-semibold text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                  >
                                    <span>Ver todo en {c.name}</span>
                                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/all:translate-x-0.5" />
                                  </button>

                                  {c.subcategories!.map((sub) => (
                                    <Link
                                      key={sub.id}
                                      to={getProductUrl(sub.id, sub.name)}
                                      onClick={close}
                                      className="group/sub flex items-center gap-2.5 rounded-md px-3 py-2 text-[14px] text-muted transition-colors hover:bg-white/[0.03] hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                    >
                                      <span
                                        aria-hidden
                                        className="h-1 w-1 shrink-0 rounded-full bg-muted transition-colors group-hover/sub:bg-accent"
                                      />
                                      <span className="transition-transform duration-300 group-hover/sub:translate-x-0.5">
                                        {sub.name}
                                      </span>
                                    </Link>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        )}
                      </motion.li>
                    );
                  })}
                </ul>
              </motion.nav>

              {/* Sección: ayuda e información */}
              <div className="mt-8 border-t border-white/5 pt-6">
                <p className="mb-3 px-3 text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
                  Ayuda e información
                </p>
                <ul className="flex flex-col">
                  <li>
                    <HelpLink to="/contacto" onClick={close} icon={MessageCircle}>
                      Contacto
                    </HelpLink>
                  </li>
                  <li>
                    <HelpLink
                      to={authed ? roleLandingPath(roles) : "/login"}
                      onClick={close}
                      icon={authed ? MonitorCog : LogIn}
                    >
                      {authed ? "Centro de Administración" : "Acceso Colaboradores"}
                    </HelpLink>
                  </li>
                </ul>
              </div>
            </div>

          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Enlace de la sección de ayuda ── */
function HelpLink({
  to,
  onClick,
  icon: Icon,
  children,
}: {
  to: string;
  onClick: () => void;
  icon: typeof MessageCircle;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] text-muted transition-colors hover:bg-white/[0.03] hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Icon className="h-[18px] w-[18px] shrink-0 text-muted transition-colors group-hover:text-accent-2" />
      <span className="transition-transform duration-300 group-hover:translate-x-0.5">
        {children}
      </span>
    </Link>
  );
}
