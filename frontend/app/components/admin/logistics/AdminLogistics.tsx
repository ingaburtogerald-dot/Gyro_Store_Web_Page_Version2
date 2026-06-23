// Vista del admin de Gyro Logistics: todos los paquetes, filtro por estado y acciones
// según el estado — validar recepción en China (comentario) y registrar llegada a
// Nicaragua (foto + costo de envío). Cada acción notifica al cliente por email.
import { useMemo, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { ShipmentCard } from "./ShipmentCard";
import { SHIPMENT_FLOW, SHIPMENT_LABEL } from "./shipmentMeta";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import {
  useGetShipmentsQuery,
  useDeliverChinaMutation,
  useReceiveChinaMutation,
  useReceiveNicaraguaMutation,
  type Shipment,
  type ShipmentStatus,
} from "~/store/api/logisticsApi";
import { cn } from "~/lib/utils";

export function AdminLogistics() {
  const { data: shipments = [], isLoading } = useGetShipmentsQuery();
  const [deliverChina] = useDeliverChinaMutation();
  const [receiveChina, { isLoading: receivingChina }] = useReceiveChinaMutation();
  const [receiveNicaragua, { isLoading: receivingNic }] = useReceiveNicaraguaMutation();
  const [filter, setFilter] = useState<ShipmentStatus | "all">("all");

  const [chinaFor, setChinaFor] = useState<Shipment | null>(null);
  const [comment, setComment] = useState("");

  const [nicFor, setNicFor] = useState<Shipment | null>(null);
  const [nicComment, setNicComment] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [shippingCurrency, setShippingCurrency] = useState<"C$" | "USD">("USD");
  const [arrivalPhoto, setArrivalPhoto] = useState<File | null>(null);

  const filtered = useMemo(
    () => (filter === "all" ? shipments : shipments.filter((s) => s.status === filter)),
    [shipments, filter],
  );

  async function handleDeliver(s: Shipment) {
    try {
      await deliverChina({ id: s.id }).unwrap();
      toast.success("Marcado como entregado en China.");
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo actualizar.");
    }
  }

  async function handleReceiveChina() {
    if (!chinaFor) return;
    try {
      await receiveChina({ id: chinaFor.id, comment }).unwrap();
      toast.success("Recepción en China confirmada. Cliente notificado.");
      setChinaFor(null);
      setComment("");
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo confirmar.");
    }
  }

  async function handleReceiveNicaragua() {
    if (!nicFor) return;
    const cost = Number(shippingCost);
    if (!Number.isFinite(cost) || cost <= 0) return toast.error("Ingresa el costo total de envío.");
    const fd = new FormData();
    fd.append("comment", nicComment);
    fd.append("shippingCost", String(cost));
    fd.append("shippingCurrency", shippingCurrency);
    if (arrivalPhoto) fd.append("arrivalPhoto", arrivalPhoto);
    try {
      await receiveNicaragua({ id: nicFor.id, body: fd }).unwrap();
      toast.success("Llegada a Nicaragua registrada. Cliente notificado.");
      setNicFor(null);
      setNicComment("");
      setShippingCost("");
      setArrivalPhoto(null);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo registrar.");
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
            <ShipmentCard
              key={s.id}
              shipment={s}
              isAdmin
              onDeliverChina={handleDeliver}
              onReceiveChina={setChinaFor}
              onReceiveNicaragua={setNicFor}
            />
          ))}
        </div>
      )}

      {/* Validar recepción en China */}
      <Modal open={!!chinaFor} onClose={() => setChinaFor(null)} title="Recibido en China">
        <p className="mb-3 text-sm text-muted">Tracking: {chinaFor?.trackingNumber}</p>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Comentario (obligatorio)</span>
          <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ej. Se recibió el paquete, irá en el envío semanal del 15 de junio." />
        </label>
        <p className="mt-2 text-xs text-muted">Al confirmar se fija la llegada estimada (45–60 días) y se notifica al cliente.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setChinaFor(null)}>Cancelar</Button>
          <Button onClick={handleReceiveChina} loading={receivingChina} disabled={!comment.trim()}>Confirmar recepción</Button>
        </div>
      </Modal>

      {/* Registrar llegada a Nicaragua */}
      <Modal open={!!nicFor} onClose={() => setNicFor(null)} title="Recibido en Nicaragua">
        <p className="mb-3 text-sm text-muted">Tracking: {nicFor?.trackingNumber}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium">Costo total de envío</span>
            <input type="number" step="0.01" min={0} className="input" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} placeholder="0.00" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Moneda</span>
            <select className="input" value={shippingCurrency} onChange={(e) => setShippingCurrency(e.target.value as "C$" | "USD")}>
              <option value="USD">USD</option>
              <option value="C$">C$</option>
            </select>
          </label>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-pill border border-border px-3 py-2 text-sm text-muted hover:text-text">
          <Camera className="h-4 w-4" />
          {arrivalPhoto ? arrivalPhoto.name : "Foto de la mercadería (opcional)"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setArrivalPhoto(e.target.files?.[0] || null)} />
        </label>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-medium">Comentario (opcional)</span>
          <textarea className="input" rows={2} value={nicComment} onChange={(e) => setNicComment(e.target.value)} placeholder="Detalle de la entrega…" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setNicFor(null)}>Cancelar</Button>
          <Button onClick={handleReceiveNicaragua} loading={receivingNic} disabled={!shippingCost.trim()}>Registrar llegada</Button>
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
