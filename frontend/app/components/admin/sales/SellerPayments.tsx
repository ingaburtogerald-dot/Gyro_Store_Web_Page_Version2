// "Mis Pagos" del vendedor: lista de pagos recibidos (datos propios vía /my-payments).
import { useMemo } from "react";
import { useGetMyPaymentsQuery } from "~/store/api/salesApi";
import { PaymentCard } from "./PaymentCard";
import { StaggerList, StaggerItem } from "~/components/ui/Motion";
import { CardGridSkeleton } from "~/components/ui/Skeleton";

export function SellerPayments({ selectedDate }: { selectedDate: string }) {
  const { data: payments = [], isLoading } = useGetMyPaymentsQuery();

  const filteredPayments = useMemo(() => {
    if (!selectedDate || selectedDate === "all") return payments;
    return payments.filter((p) => p.createdAt && p.createdAt.startsWith(selectedDate));
  }, [payments, selectedDate]);

  if (isLoading) return <CardGridSkeleton count={4} />;

  if (filteredPayments.length === 0) {
    return (
      <p className="rounded-card border border-border bg-surface shadow-premium py-10 text-center text-sm text-muted">
        {selectedDate && selectedDate !== "all"
          ? "No hay pagos para el período seleccionado."
          : "Aún no has recibido pagos."}
      </p>
    );
  }

  return (
    <StaggerList className="flex flex-col gap-2">
      {filteredPayments.map((p) => (
        <StaggerItem key={p.id}>
          <PaymentCard payment={p} />
        </StaggerItem>
      ))}
    </StaggerList>
  );
}

