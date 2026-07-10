import { motion, AnimatePresence } from "framer-motion";
import { X, User, ChevronRight, ArrowRight } from "lucide-react";
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

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export function PublicSidebar({ categories }: Props) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const open = useAppSelector((s) => s.ui.publicSidebarOpen);
  const user = useAppSelector(selectUser);
  const status = useAppSelector(selectStatus);
  const roles = useAppSelector(selectRoles);
  const authed = status === "authenticated" && Boolean(user);
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "";

  function handleCategory(id: string | null) {
    dispatch(setCategory(id));
    dispatch(closePublicSidebar());
    navigate("/");
  }

  function handleHomeClick() {
    dispatch(resetFilters());
    dispatch(setCategory(null));
    dispatch(closePublicSidebar());
    navigate("/");
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => dispatch(closePublicSidebar())}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
          />

          <motion.div
            initial={{ x: "-100%", boxShadow: "0 0 0 rgba(0,0,0,0)" }}
            animate={{ x: 0, boxShadow: "20px 0 50px rgba(0,0,0,0.5)" }}
            exit={{ x: "-100%", boxShadow: "0 0 0 rgba(0,0,0,0)" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="fixed inset-y-0 left-0 z-50 flex w-full max-w-[380px] flex-col bg-bg overflow-hidden"
          >
            {/* Premium Header */}
            <div className="relative flex items-center justify-between bg-surface px-6 py-6 border-b border-white/5">
              <div className="flex min-w-0 items-center gap-4">
                {authed && user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                  />
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-accent to-accent-2/80 text-bg">
                    <User className="h-6 w-6" />
                  </div>
                )}
                <div className="flex min-w-0 flex-col">
                  {authed ? (
                    <>
                      <span className="text-xs font-medium uppercase tracking-wider text-muted">Hola,</span>
                      <span className="truncate text-xl font-bold tracking-tight text-text">
                        {firstName || user!.name}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-medium uppercase tracking-wider text-muted">Bienvenido</span>
                      <span className="text-xl font-bold tracking-tight text-text">Invitado</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => dispatch(closePublicSidebar())}
                className="group p-2 rounded-full hover:bg-white/5 transition-colors focus:outline-none"
              >
                <X className="h-5 w-5 text-muted transition-transform group-hover:text-text group-hover:rotate-90" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-6 custom-scrollbar">
              {/* Sección Categorías */}
              <div className="mb-8">
                <motion.ul 
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="flex flex-col space-y-6"
                >
                  <motion.li variants={itemVariants} className="px-6">
                    <button
                      onClick={handleHomeClick}
                      className="group flex w-full items-center justify-between rounded-xl bg-surface/50 p-4 text-[15px] font-medium text-text hover:bg-surface transition-colors border border-white/5"
                    >
                      <span>Volver al inicio</span>
                      <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent" />
                    </button>
                  </motion.li>

                  <motion.li variants={itemVariants} className="px-6 pt-2 pb-1">
                    <h3 className="text-xs font-black bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent uppercase tracking-widest">
                      Productos
                    </h3>
                  </motion.li>

                  {categories.map((c) => (
                    <motion.li variants={itemVariants} key={c.id} className="px-6">
                      <button
                        onClick={() => handleCategory(c.id)}
                        className="group flex w-full items-center justify-between text-left focus:outline-none mb-3"
                      >
                        <span className="text-[17px] font-bold text-text group-hover:text-accent transition-colors">
                          {c.name}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-accent" />
                      </button>
                      
                      {c.subcategories && c.subcategories.length > 0 && (
                        <ul className="flex flex-col space-y-1 ml-2 border-l border-white/10 py-1">
                          {c.subcategories.map((sub) => (
                            <li key={sub.id}>
                              <Link
                                to={getProductUrl(sub.id, sub.name)}
                                onClick={() => dispatch(closePublicSidebar())}
                                className="group flex w-full items-center px-4 py-2 text-[15px] text-muted-foreground hover:text-text transition-all"
                              >
                                <span className="transform transition-transform duration-200 group-hover:translate-x-1 group-hover:text-accent">
                                  {sub.name}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </motion.li>
                  ))}
                </motion.ul>
              </div>

              {/* Sección Configuración */}
              <div className="px-6 pt-6 border-t border-white/5">
                <h3 className="mb-4 text-xs font-bold text-muted uppercase tracking-widest">
                  Ayuda e Información
                </h3>
                <ul className="flex flex-col space-y-1">
                  <li>
                    <Link
                      to="/contacto"
                      onClick={() => dispatch(closePublicSidebar())}
                      className="group flex w-full items-center py-2.5 text-[15px] text-muted-foreground hover:text-text transition-colors"
                    >
                      <span className="transform transition-transform group-hover:translate-x-1">Contacto</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      to={authed ? roleLandingPath(roles) : "/login"}
                      onClick={() => dispatch(closePublicSidebar())}
                      className="group flex w-full items-center py-2.5 text-[15px] text-muted-foreground hover:text-text transition-colors"
                    >
                      <span className="transform transition-transform group-hover:translate-x-1">
                        {authed ? "Centro de Administración" : "Acceso Colaboradores"}
                      </span>
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
