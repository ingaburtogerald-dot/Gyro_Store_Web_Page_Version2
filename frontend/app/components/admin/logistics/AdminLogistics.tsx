// Vista del admin de Gyro Logistics: todos los paquetes, filtro por estado y
// avance de estado con comentario obligatorio (notifica al cliente por email).
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ShipmentCard } from "./ShipmentCard";
import { SHIPMENT_FLOW, SHIPMENT_LABEL } from "./shipmentMeta";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import {
  useGetShipmentsQuery,
  useAdvanceShipmentMutation,
  type Shipment,
  type ShipmentStatus,
} from "~/store/api/logisticsApi";
import { cn } from "~/lib/utils";

export function AdminLogistics() {
  const { data: shipments = [], isLoading } = useGetShipmentsQuery();
  const [advance, { isLoading: advancing }] = useAdvanceShipmentMutation();
  const [filter, setFilter] = useState<ShipmentStatus | "all">("all");
  const [advanceFor, setAdvanceFor] = useState<Shipment | null>(null);
  const [comment, setComment] = useState("");

  const filtered = useMemo(
    () => (filter === "all" ? shipments : shipments.filter((s) => s.status === filter)),
    [shipments, filter],
  );

  async function handleAdvance() {
    if (!advanceFor) return;
    try {
      await advance({ id: advanceFor.id, comment }).unwrap();
      toast.success("Estado actualizado. Cliente notificado.");
      setAdvanceFor(null);
      setComment("");
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo avanzar el estado.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gyro Logistics</h1>
        <p className="text-muted">Gestiona los paquetes de todos los clientes.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Todos</FilterChip>
        {SHIPMENT_FLOW.map((s) => (
          <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
            {SHIPMENT_LABEL[s]}
          </FilterChip>
        ))}
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-card border border-border bg-surface" />
      ) : filtered.length === 0 ? (
        <p className="rounded-card border border-dashed border-border py-12 text-center text-muted">Sin paquetes en este estado.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((s) => (
            <ShipmentCard key={s.id} shipment={s} isAdmin onAdvance={setAdvanceFor} />
          ))}
        </div>
      )}

      <Modal open={!!advanceFor} onClose={() => setAdvanceFor(null)} title="Avanzar estado del paquete">
        <p className="mb-3 text-sm text-muted">Tracking: {advanceFor?.trackingNumber}</p>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Comentario (obligatorio)</span>
          <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Detalle del avance…" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setAdvanceFor(null)}>Cancelar</Button>
          <Button onClick={handleAdvance} loading={advancing} disabled={!comment.trim()}>Confirmar avance</Button>
        </div>
      </Modal>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-pill border px-3 py-1.5 text-sm transition-colors",
        active ? "border-transparent bg-gradient-accent text-white" : "border-border text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
