// "Mis Pagos" del vendedor: lista de pagos recibidos (datos propios vía /my-payments).
import { useGetMyPaymentsQuery } from "~/store/api/salesApi";
import { PaymentCard } from "./PaymentCard";
import { StaggerList, StaggerItem } from "~/components/ui/Motion";
import { CardGridSkeleton } from "~/components/ui/Skeleton";

export function SellerPayments() {
  const { data: payments = [], isLoading } = useGetMyPaymentsQuery();

  if (isLoading) return <CardGridSkeleton count={4} />;

  if (payments.length === 0) {
    return (
      <p className="rounded-card border border-border bg-surface py-10 text-center text-sm text-muted">
        Aún no has recibido pagos.
      </p>
    );
  }

  return (
    <StaggerList className="flex flex-col gap-2">
      {payments.map((p) => (
        <StaggerItem key={p.id}>
          <PaymentCard payment={p} />
        </StaggerItem>
      ))}
    </StaggerList>
  );
}
