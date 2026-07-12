import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "@remix-run/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  User,
  Moon,
  Sun,
  ShieldCheck,
  Pencil,
  LogOut,
  MapPin,
  HelpCircle,
  KeyRound
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { selectStatus, selectIsAdmin, selectEditMode, selectRoles, toggleEditMode } from "~/store/slices/authSlice";
import { useAuth } from "~/hooks/useAuth";
import { useTheme } from "~/hooks/useTheme";
import { cn } from "~/lib/utils";
import { roleLandingPath, ROLE_LABELS, ADMIN_ROLES, type Role } from "~/lib/constants";

export function HeaderSettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();

  const dispatch = useAppDispatch();
  const status = useAppSelector(selectStatus);
  const isAdmin = useAppSelector(selectIsAdmin);
  const editMode = useAppSelector(selectEditMode);
  const roles = useAppSelector(selectRoles);
  const location = useLocation();

  const isHome = location.pathname === "/";
  const loginTo = `/login?redirectTo=${encodeURIComponent(location.pathname + location.search)}`;

  // Nombre corto y etiqueta del rol para el encabezado del menú autenticado.
  // Priorizamos un rol de admin si lo tiene; si no, el primer rol conocido.
  const firstName = user?.name?.split(" ")[0] || "Colaborador";
  const primaryRole =
    (roles as Role[]).find((r) => ADMIN_ROLES.includes(r)) ??
    (roles as Role[]).find((r) => ROLE_LABELS[r]);
  const roleLabel = primaryRole ? ROLE_LABELS[primaryRole] : "Sesión iniciada";

  async function handleLogout() {
    setIsOpen(false);
    await logout();
    toast.success("Sesión cerrada.");
  }

  function comingSoon() {
    setIsOpen(false);
    toast("Próximamente disponible.");
  }

  // Cierra el menú al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative grid h-11 w-11 place-items-center rounded-pill text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Menú de configuración"
        aria-expanded={isOpen}
      >
        <User className="h-5 w-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-[0_10px_40px_rgba(0,0,0,0.2)] backdrop-blur-xl z-50"
          >
            <div className="flex flex-col p-2">
              
              {/* VISTA USUARIO NO AUTENTICADO */}
              {status !== "authenticated" && (
                <>
                  <div className="mb-2 border-b border-border/50 px-3 pb-3 pt-2">
                    <p className="text-sm font-semibold text-text">Configuración</p>
                  </div>
                  
                  <button
                    onClick={toggleTheme}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-text"
                  >
                    {theme === "dark" ? <Sun className="h-4 w-4 text-accent" /> : <Moon className="h-4 w-4 text-accent" />}
                    Tema {theme === "dark" ? "Claro" : "Oscuro"}
                  </button>
                  
                  {/* TODO: enlazar a /rastrear y /faqs cuando existan esas rutas. */}
                  <button
                    onClick={comingSoon}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-text"
                  >
                    <MapPin className="h-4 w-4" />
                    Rastrear mi pedido
                  </button>

                  <button
                    onClick={comingSoon}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-text"
                  >
                    <HelpCircle className="h-4 w-4" />
                    Ayuda y FAQs
                  </button>

                  <div className="my-1 border-t border-border/50" />
                  
                  <Link
                    to={loginTo}
                    onClick={() => setIsOpen(false)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
                  >
                    <KeyRound className="h-4 w-4" />
                    Acceso Colaboradores
                  </Link>
                </>
              )}

              {/* VISTA ADMINISTRADOR / COLABORADOR */}
              {status === "authenticated" && (
                <>
                  <div className="mb-2 border-b border-border/50 px-3 pb-3 pt-2">
                    <p className="text-sm font-semibold text-text">Hola, {firstName} {isAdmin && "👑"}</p>
                    <p className="text-xs text-muted">{roleLabel}</p>
                  </div>

                  <Link
                    to={roleLandingPath(roles)}
                    onClick={() => setIsOpen(false)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text transition-colors hover:bg-accent/10 hover:text-accent"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Centro de Administración
                  </Link>

                  {isAdmin && isHome && (
                    <button
                      onClick={() => {
                        dispatch(toggleEditMode());
                        setIsOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-surface-hover",
                        editMode ? "text-accent bg-accent/5" : "text-text"
                      )}
                    >
                      <Pencil className="h-4 w-4" />
                      Modo Edición {editMode && "(Activo)"}
                    </button>
                  )}

                  <button
                    onClick={toggleTheme}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface-hover"
                  >
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    Apariencia: {theme === "dark" ? "Oscuro" : "Claro"}
                  </button>

                  <div className="my-1 border-t border-border/50" />
                  
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar Sesión
                  </button>
                </>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
