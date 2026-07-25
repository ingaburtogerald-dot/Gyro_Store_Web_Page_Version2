import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { useAuth } from "~/hooks/useAuth";
import { getIdToken } from "~/lib/authStrategies";
import { useAppDispatch } from "~/store/hooks";
import { setUser } from "~/store/slices/authSlice";

export function ChangeWhatsappModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
