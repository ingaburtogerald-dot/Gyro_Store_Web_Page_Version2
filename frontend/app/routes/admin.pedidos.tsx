// Portal de Pedidos Públicos — vista de quién escribió por WhatsApp desde el catálogo.
// Admin puede marcar si ya contactó al cliente.
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Check, Clock } from "lucide-react";
import { RequireRole } from "~/components/admin/RequireRole";
import { useGetPublicOrdersQuery, useMarkContactedMutation, type PublicOrder } from "~/store/api/salesApi";
import { formatCordobas } from "~/lib/utils";

function OrderRow({ order }: { order: PublicOrder }) {
  const [markContacted] = useMarkContactedMutation();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      await markContacted({ id: order.id, contacted: !order.contacted }).unwrap();
      toast.success(order.contacted ? "Marcado como no contactado." : "Marcado como contactado.");
    } catch {
      toast.error("No se pudo actualizar el estado.");
    } finally {
      setLoading(false);
    }
  }

  const date = order.createdAt ? new Date(order.createdAt).toLocaleString("es-NI") : "—";

  return (
    <div className="rounded-card border border-border bg-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-text">{order.customerName}</p>
          <p className="text-sm text-muted">{order.customerPhone}</p>
          <p className="text-xs text-muted mt-0.5">{date}</p>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            order.contacted
              ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
              : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-text"
          }`}
        >
          {order.contacted ? (
            <><Check className="h-3.5 w-3.5" /> Contactado</>
          ) : (
            <><Clock className="h-3.5 w-3.5" /> Pendiente</>
          )}
        </button>
      </div>

      <div className="space-y-1">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-text">
              {item.name}
              {item.variantName && item.variantName !== "Estándar" && (
                <span className="text-muted ml-1">({item.variantName})</span>
              )}
              {" "}×{item.quantity}
            </span>
            <span className="text-muted">{formatCordobas(item.lineTotal)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2">
        <div className="text-sm text-muted">
          {order.deliveryMethod === "envio" ? `Envío: ${order.address}` : "Retiro en tienda"}
        </div>
        <div className="text-right">
          {order.discount > 0 && (
            <p className="text-xs text-muted line-through">{formatCordobas(order.subtotal)}</p>
          )}
          <p className="font-bold text-accent-2">{formatCordobas(order.total)}</p>
        </div>
      </div>

      {order.note && (
        <p className="text-xs text-muted border-t border-border pt-2">📝 {order.note}</p>
      )}
    </div>
  );
}

export default function Pedidos() {
  const { data: orders = [], isLoading } = useGetPublicOrdersQuery();
  const [filter, setFilter] = useState<"all" | "pending" | "contacted">("all");

  const filtered = orders.filter((o) => {
    if (filter === "pending") return !o.contacted;
    if (filter === "contacted") return o.contacted;
    return true;
  });

  const pendingCount = orders.filter((o) => !o.contacted).length;

  return (
    <RequireRole allowed={["admin"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text">Pedidos del Catálogo</h1>
            <p className="text-sm text-muted mt-0.5">
              Clientes que escribieron por WhatsApp desde el catálogo público
            </p>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1.5 text-sm font-medium text-amber-400">
              <MessageCircle className="h-4 w-4" />
              {pendingCount} sin contactar
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {(["all", "pending", "contacted"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-gradient-accent text-white"
                  : "bg-surface-2 text-muted hover:text-text"
              }`}
            >
              {f === "all" ? "Todos" : f === "pending" ? "Sin contactar" : "Contactados"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-card bg-surface" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <MessageCircle className="h-10 w-10 text-muted opacity-40" />
            <p className="text-muted">No hay pedidos en esta categoría todavía.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </RequireRole>
  );
}
