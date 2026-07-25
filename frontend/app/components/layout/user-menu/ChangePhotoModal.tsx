import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { useAuth } from "~/hooks/useAuth";
import { getIdToken } from "~/lib/authStrategies";
import { getFirebaseAuth } from "~/lib/firebase.client";
import { useAppDispatch } from "~/store/hooks";
import { setUser } from "~/store/slices/authSlice";

export function ChangePhotoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);

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
            <div className="grid h-24 w-24 place-items-center rounded-full bg-gradient-accent text-2xl font-semibold text-bg">
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
