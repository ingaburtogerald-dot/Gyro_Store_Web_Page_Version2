// Vista del cliente de Gyro Logistics: registrar paquete + Mis paquetes.
import { useState } from "react";
import { toast } from "sonner";
import { RegisterShipmentForm } from "./RegisterShipmentForm";
import { ShipmentCard } from "./ShipmentCard";
import { useGetShipmentsQuery, useDeliverChinaMutation, type Shipment } from "~/store/api/logisticsApi";
import { cn } from "~/lib/utils";

export function CustomerLogistics() {
  const [tab, setTab] = useState<"new" | "mine">("new");
  const { data: shipments = [], isLoading } = useGetShipmentsQuery();
  const [deliverChina] = useDeliverChinaMutation();

  async function handleDeliver(s: Shipment) {
    try {
      await deliverChina({ id: s.id }).unwrap();
      toast.success("¡Gracias! El equipo validará la recepción en China.");
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo actualizar.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gyro Logistics</h1>
        <p className="text-muted">Registra tus compras en China y sigue su estado hasta Managua.</p>
      </div>

      <div className="flex gap-1 rounded-pill border border-border bg-surface p-1 sm:w-fit">
        <TabBtn active={tab === "new"} onClick={() => setTab("new")}>Registrar paquete</TabBtn>
        <TabBtn active={tab === "mine"} onClick={() => setTab("mine")}>Mis paquetes</TabBtn>
      </div>

      {tab === "new" ? (
        <RegisterShipmentForm />
      ) : isLoading ? (
        <div className="h-40 animate-pulse rounded-card border border-border bg-surface" />
      ) : shipments.length === 0 ? (
        <p className="rounded-card border border-dashed border-border py-12 text-center text-muted">Aún no tienes paquetes registrados.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shipments.map((s) => (
            <ShipmentCard key={s.id} shipment={s} onDeliverChina={handleDeliver} />
          ))}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-pill px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
        active ? "bg-gradient-accent text-white" : "text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
