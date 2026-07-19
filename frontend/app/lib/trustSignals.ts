// Señales de confianza reales del negocio — fuente única compartida por
// PublicFooter (siempre visible) y TrustStrip (home, bajo el Hero). Un solo lugar
// para editar el texto/orden sin desincronizar ambos componentes.
import type { LucideIcon } from "lucide-react";
import { Truck, ShieldCheck, Wallet } from "lucide-react";

export interface TrustSignal {
  icon: LucideIcon;
  label: string;
}

export const TRUST_SIGNALS: TrustSignal[] = [
  { icon: Truck, label: "Envío en Managua" },
  { icon: Wallet, label: "Pago contra entrega" },
  { icon: ShieldCheck, label: "Garantía en cada compra" },
];
