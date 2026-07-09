// Menú desplegable del avatar: datos del usuario, selector de tema (paletas +
// modo claro), opciones de cuenta local (cambiar contraseña) y cerrar sesión.
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Key, Check, Lock, Eye, EyeOff, Sun, Moon, Palette, Camera, Upload, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { useAuth } from "~/hooks/useAuth";
import { useTheme, THEMES, type ThemeId } from "~/hooks/useTheme";
import { getIdToken } from "~/lib/authStrategies";
import { getFirebaseAuth, linkWithPopup, GoogleAuthProvider } from "~/lib/firebase.client";
import { useAppDispatch } from "~/store/hooks";
import { setUser } from "~/store/slices/authSlice";
import { cn } from "~/lib/utils";

export function UserMenu() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isLocal = user?.authProvider === "password";
  const hasGoogle = user?.providers?.includes("google.com");

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

  // Cerrar al hacer clic fuera.
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

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      {/* Disparador: avatar */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-pill p-1 pl-3 transition-colors hover:bg-surface-2"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="hidden text-right lg:block">
          <p className="text-sm font-medium leading-tight">{user.name}</p>
        </div>
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-accent text-sm font-semibold text-white">
            {user.name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="menu"
            className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-card border border-border bg-surface shadow-2xl"
          >
            {/* Cabecera: nombre + email */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-accent text-sm font-semibold text-white">
                  {user.name?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
            </div>

            {/* Selector de tema */}
            <div className="px-4 py-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                <Palette className="h-3.5 w-3.5" /> Tema
              </div>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((t) => (
                  <ThemeOption
                    key={t.id}
                    id={t.id}
                    label={t.label}
                    swatch={t.swatch}
                    dark={t.dark}
                    active={theme === t.id}
                    onSelect={() => setTheme(t.id)}
                  />
                ))}
              </div>
            </div>

            {/* Opciones de cuenta local */}
            {isLocal && (
              <div className="border-t border-border py-1">
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

            {/* Cerrar sesión */}
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

function ThemeOption({
  id,
  label,
  swatch,
  dark,
  active,
  onSelect,
}: {
  id: ThemeId;
  label: string;
  swatch: [string, string];
  dark: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      role="menuitemradio"
      aria-checked={active}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors",
        active ? "border-accent bg-accent/10" : "border-border hover:bg-surface-2",
      )}
    >
      <span
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
        style={{ backgroundImage: `linear-gradient(135deg, ${swatch[0]}, ${swatch[1]})` }}
      >
        {id === "light" && <Sun className="h-3.5 w-3.5 text-white" />}
        {id === "dark" && <Moon className="h-3.5 w-3.5 text-white" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{label}</span>
      </span>
      {active && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
    </button>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors",
        danger
          ? "text-muted hover:bg-danger/10 hover:text-danger"
          : "text-text hover:bg-surface-2 hover:text-accent",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres.");
    if (newPassword !== confirm) return toast.error("Las contraseñas no coinciden.");

    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("No se pudo obtener el token de autenticación.");
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo cambiar la contraseña.");
      toast.success("Contraseña actualizada correctamente.");
      setNewPassword("");
      setConfirm("");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cambiar contraseña">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="np" className="mb-1.5 block text-sm font-medium">
            Nueva contraseña
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 focus-within:border-accent">
            <Lock className="h-4 w-4 text-muted" />
            <input
              id="np"
              type={show ? "text" : "password"}
              placeholder="Mínimo 6 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted"
              required
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="text-muted hover:text-text">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="cp" className="mb-1.5 block text-sm font-medium">
            Confirmar contraseña
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 focus-within:border-accent">
            <Lock className="h-4 w-4 text-muted" />
            <input
              id="cp"
              type={show ? "text" : "password"}
              placeholder="Repite la contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          Actualizar contraseña
        </Button>
      </form>
    </Modal>
  );
}

function ChangePhotoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Genera/limpia la URL de vista previa.
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(f: File | null) {
    if (f && !f.type.startsWith("image/")) return toast.error("El archivo debe ser una imagen.");
    if (f && f.size > 5 * 1024 * 1024) return toast.error("La imagen no debe superar 5 MB.");
    setFile(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !user) return toast.error("Selecciona una imagen.");

    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("No se pudo obtener el token de autenticación.");
      const fd = new FormData();
      fd.append("photo", file);
      const res = await fetch("/api/auth/photo", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar la foto.");

      // Refleja la nueva foto en la sesión y refresca el token para que persista.
      dispatch(setUser({ ...user, photoURL: data.photoURL }));
      try {
        const auth = await getFirebaseAuth();
        await auth.currentUser?.getIdToken(true);
      } catch {
        /* noop */
      }

      toast.success("Foto de perfil actualizada.");
      setFile(null);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar la foto.");
    } finally {
      setLoading(false);
    }
  }

  const currentSrc = preview || user?.photoURL || "";

  return (
    <Modal open={open} onClose={onClose} title="Cambiar foto de perfil">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-col items-center gap-3">
          {currentSrc ? (
            <img src={currentSrc} alt="" className="h-24 w-24 rounded-full object-cover" />
          ) : (
            <div className="grid h-24 w-24 place-items-center rounded-full bg-gradient-accent text-2xl font-semibold text-white">
              {user?.name?.[0]?.toUpperCase() || "?"}
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2 rounded-pill border border-border bg-bg px-4 py-2 text-sm text-muted transition-colors hover:text-text">
            <Upload className="h-4 w-4" />
            {file ? file.name : "Elegir imagen"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0] || null)}
            />
          </label>
          <p className="text-xs text-muted">PNG o JPG, máximo 5 MB.</p>
        </div>

        <Button type="submit" className="w-full" loading={loading} disabled={!file}>
          Guardar foto
        </Button>
      </form>
    </Modal>
  );
}

function ChangeWhatsappModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const [whatsapp, setWhatsapp] = useState((user as any)?.whatsapp || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && (user as any)?.whatsapp) setWhatsapp((user as any).whatsapp);
  }, [open, user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("No se pudo obtener el token.");
      const res = await fetch("/api/auth/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ whatsapp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar WhatsApp.");
      
      toast.success("Número de WhatsApp guardado.");
      if (user) {
        dispatch(setUser({ ...user, whatsapp: data.whatsapp } as any));
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el número.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Configurar WhatsApp">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Número de WhatsApp
          </label>
          <p className="text-xs text-muted mb-2">Ingresa tu número con el código de país, por ejemplo: 50588889999</p>
          <input
            type="text"
            placeholder="505..."
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="input w-full"
            required
          />
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          Guardar WhatsApp
        </Button>
      </form>
    </Modal>
  );
}
