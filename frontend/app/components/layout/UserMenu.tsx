import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@remix-run/react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Key, Camera, Upload, Link2, MonitorCog, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { getFirebaseAuth, linkWithPopup, GoogleAuthProvider } from "~/lib/firebase.client";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import { selectRoles, selectIsAdmin, selectEditMode, toggleEditMode } from "~/store/slices/authSlice";
import { cn } from "~/lib/utils";

import { ChangePasswordModal } from "./user-menu/ChangePasswordModal";
import { ChangePhotoModal } from "./user-menu/ChangePhotoModal";
import { ChangeWhatsappModal } from "./user-menu/ChangeWhatsappModal";
import { MenuItem } from "./user-menu/MenuItem";

export function UserMenu({
  compact = false,
  showName = true,
  nameClassName = "hidden lg:block",
  align = "right",
}: {
  compact?: boolean;
  showName?: boolean;
  nameClassName?: string;
  align?: "left" | "right";
} = {}) {
  const { user, logout } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const roles = useAppSelector(selectRoles);
  const isAdmin = useAppSelector(selectIsAdmin);
  const editMode = useAppSelector(selectEditMode);
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<NodeJS.Timeout | number | null>(null);

  const isLocal = user?.authProvider === "password";
  const hasGoogle = user?.providers?.includes("google.com");
  const isStaff = roles.some((r) =>
    ["global_admin", "admin", "seller", "cashier", "logistics_admin", "logistics_customer"].includes(r)
  );

  async function linkGoogle() {
    setOpen(false);
    try {
      const auth = await getFirebaseAuth();
      if (!auth.currentUser) throw new Error("No hay sesión activa de Firebase.");
      await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
      toast.success("¡Cuenta de Google vinculada exitosamente! Ahora podrás iniciar sesión con Google.");
    } catch (err: any) {
      if (err.code === "auth/credential-already-in-use") {
        toast.error("Esta cuenta de Google ya está asignada a otro usuario.");
      } else {
        toast.error("No se pudo vincular con Google: " + (err.message || err.toString()));
      }
    }
  }

  function handleToggleEdit() {
    setOpen(false);
    const turningOn = !editMode;
    dispatch(toggleEditMode());
    if (turningOn) navigate("/");
    toast.success(turningOn ? "Modo edición activado." : "Modo edición desactivado.");
  }

  function handleMouseEnter() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current as any);
      closeTimer.current = null;
    }
    setOpen(true);
  }

  function handleMouseLeave() {
    closeTimer.current = setTimeout(() => {
      setOpen(false);
    }, 150);
  }

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current as any);
    };
  }, []);

  if (!user) return null;

  return (
    <div
      className="relative"
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {compact ? (
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-accent-2"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Cuenta"
        >
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <div className="grid h-6 w-6 place-items-center rounded-full bg-gradient-accent text-[11px] font-semibold text-bg">
              {user.name?.[0]?.toUpperCase() || "?"}
            </div>
          )}
          Cuenta
        </button>
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex items-center gap-2.5 rounded-pill transition-colors hover:bg-surface-2",
            showName ? "p-1 pl-3" : "p-1"
          )}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {showName && (
            <div className={nameClassName}>
              <p className="text-sm font-medium leading-tight">{user.name}</p>
            </div>
          )}
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-accent text-sm font-semibold text-bg">
              {user.name?.[0]?.toUpperCase() || "?"}
            </div>
          )}
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="menu"
            className={cn(
              "absolute z-50 w-72 overflow-hidden rounded-card border border-border bg-surface shadow-2xl",
              align === "left" ? "left-0" : "right-0",
              compact ? "bottom-full mb-2" : "mt-2",
            )}
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-accent text-sm font-semibold text-bg">
                  {user.name?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
            </div>

            {isStaff && (
              <div className="border-b border-border py-1">
                <Link
                  to="/admin"
                  onClick={() => setOpen(false)}
                  className="group flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-accent transition-all duration-200 ease-out hover:bg-accent/10"
                >
                  <MonitorCog className="h-4 w-4 text-accent transition-transform duration-200 group-hover:scale-110" />
                  <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                    Centro de Administración
                  </span>
                </Link>
              </div>
            )}

            {isAdmin && (
              <div className="border-b border-border py-1">
                <button
                  role="menuitem"
                  onClick={handleToggleEdit}
                  className={cn(
                    "group flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-all duration-200 ease-out",
                    editMode
                      ? "text-accent-2 hover:bg-accent-2/10"
                      : "text-text hover:bg-surface-2 hover:text-accent",
                  )}
                >
                  {editMode ? (
                    <Check className="h-4 w-4 text-accent-2 transition-transform duration-200 group-hover:scale-110" />
                  ) : (
                    <Pencil className="h-4 w-4 text-muted transition-transform duration-200 group-hover:scale-110 group-hover:text-accent" />
                  )}
                  <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                    {editMode ? "Salir del modo edición" : "Modo edición"}
                  </span>
                </button>
              </div>
            )}

            {isLocal && (
              <div className="py-1">
                <MenuItem
                  icon={Camera}
                  label="Cambiar foto de perfil"
                  onClick={() => {
                    setOpen(false);
                    setPhotoOpen(true);
                  }}
                />
                <MenuItem
                  icon={Upload}
                  label="Configurar WhatsApp"
                  onClick={() => {
                    setOpen(false);
                    setWaOpen(true);
                  }}
                />
                <MenuItem
                  icon={Key}
                  label="Cambiar contraseña"
                  onClick={() => {
                    setOpen(false);
                    setPwOpen(true);
                  }}
                />
                {!hasGoogle && (
                  <MenuItem
                    icon={Link2}
                    label="Vincular con Google"
                    onClick={linkGoogle}
                  />
                )}
              </div>
            )}

            <div className="border-t border-border py-1">
              <MenuItem icon={LogOut} label="Cerrar sesión" danger onClick={logout} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
      <ChangePhotoModal open={photoOpen} onClose={() => setPhotoOpen(false)} />
      <ChangeWhatsappModal open={waOpen} onClose={() => setWaOpen(false)} />
    </div>
  );
}
