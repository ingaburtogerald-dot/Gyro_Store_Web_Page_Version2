// Contenedor "card-premium" de la caja de compra, con el espaciado unificado para
// producto y combo (antes tenían gap/margen ligeramente distintos).
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";
import { itemFade } from "~/lib/detailMotion";

export function PurchaseCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={itemFade}
      className={cn("card-premium mt-6 flex flex-col gap-6 rounded-2xl p-4 sm:gap-10 sm:p-8", className)}
    >
      {children}
    </motion.div>
  );
}
