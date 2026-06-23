// Footer del catálogo (centrado, minimalista): foto del negocio + nombre, señales de
// confianza, ubicación, y barra inferior con derechos reservados y crédito.
import { MapPin, Truck, ShieldCheck, Wallet } from "lucide-react";
import { Logo } from "~/components/ui/Logo";
import { useGetConfigQuery } from "~/store/api/catalogApi";

const TRUST = [
  { icon: Truck, label: "Envío en Managua" },
  { icon: Wallet, label: "Pago contra entrega" },
  { icon: ShieldCheck, label: "Garantía en cada compra" },
];

export function PublicFooter() {
  const { data: config } = useGetConfigQuery();
  const year = new Date().getFullYear();
  const address = config?.storeAddress ?? "Managua, Nicaragua";

  return (
    <footer className="relative mt-16 border-t border-border bg-surface">
      {/* Línea de acento superior */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

      <div className="mx-auto max-w-3xl px-6 py-12 text-center">
        {/* Foto del negocio + nombre */}
        <div className="flex justify-center">
          <Logo size={68} withText textClassName="text-2xl sm:text-3xl" />
        </div>

        {/* Señales de confianza */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm text-muted">
          {TRUST.map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-2">
              <Icon className="h-4 w-4 text-accent-2" /> {label}
            </span>
          ))}
        </div>

        {/* Ubicación */}
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
        >
          <MapPin className="h-4 w-4 text-accent-2" /> {address}
        </a>
      </div>

      {/* Barra inferior */}
      <div className="border-t border-border px-6 py-5 text-center text-xs text-muted">
        <p>© {year} Gyro Store · Todos los derechos reservados.</p>
        <p className="mt-1.5">
          Diseñado y desarrollado por <span className="font-medium text-text">Ing. Gerald Aburto</span>
          <span className="mx-1.5 text-border">·</span>
          <a href="mailto:ingaburtogerald@gmail.com" className="text-accent-2 transition-colors hover:text-accent">
            ingaburtogerald@gmail.com
          </a>
        </p>
      </div>
    </footer>
  );
}
