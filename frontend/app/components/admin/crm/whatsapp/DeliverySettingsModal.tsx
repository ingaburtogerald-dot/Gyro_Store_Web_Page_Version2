import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Phone, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { useGetFullConfigQuery, useUpdateBusinessConfigMutation } from "~/store/api/salesApi";

export function DeliverySettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: config } = useGetFullConfigQuery(undefined, { skip: !open });
  const [updateConfig, { isLoading }] = useUpdateBusinessConfigMutation();
  const [personnel, setPersonnel] = useState<{ id: string; name: string; phone: string }[]>([]);

  useEffect(() => {
    if (config?.deliveryPersonnel) {
      setPersonnel(config.deliveryPersonnel);
    }
  }, [config]);

  const handleAdd = () => {
    setPersonnel([...personnel, { id: Date.now().toString(), name: "", phone: "" }]);
  };

  const handleRemove = (id: string) => {
    setPersonnel(personnel.filter((p) => p.id !== id));
  };

  const handleChange = (id: string, field: "name" | "phone", value: string) => {
    setPersonnel(personnel.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleSave = async () => {
    const clean = personnel.filter((p) => p.name.trim() && p.phone.trim());
    try {
      await updateConfig({ deliveryPersonnel: clean }).unwrap();
      toast.success("Repartidores actualizados.");
      onClose();
    } catch {
      toast.error("Error al guardar configuración.");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-surface shadow-premium p-6"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-text">Repartidores</h2>
                <p className="text-sm text-muted">Configura tu equipo de delivery</p>
              </div>
              <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-2 bg-surface-2 hover:bg-surface-3 transition-colors">
                <X className="h-5 w-5 text-muted hover:text-text" />
              </button>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {personnel.length === 0 && (
                <p className="text-sm text-center text-muted py-4">No hay repartidores configurados.</p>
              )}
              {personnel.map((p) => (
                <div key={p.id} className="flex flex-col gap-2 p-3 bg-surface-2 rounded-xl border border-border/50">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                      <input 
                        type="text" placeholder="Nombre (Ej. Alan)" className="input pl-9 w-full bg-bg" 
                        value={p.name} onChange={(e) => handleChange(p.id, "name", e.target.value)} 
                      />
                    </div>
                    <button onClick={() => handleRemove(p.id)} className="p-2 text-danger hover:bg-danger/10 rounded-xl transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                    <input 
                      type="tel" placeholder="Teléfono (Ej. 58820006)" className="input pl-9 w-full bg-bg" 
                      value={p.phone} onChange={(e) => handleChange(p.id, "phone", e.target.value)} 
                    />
                  </div>
                </div>
              ))}
              <button onClick={handleAdd} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted hover:text-text hover:border-muted transition-colors">
                <Plus className="h-4 w-4" /> Agregar repartidor
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <Button onClick={handleSave} loading={isLoading} className="w-full">
                Guardar cambios
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
