// Franja de marca en la home — el gancho de confianza local ("100% nicaragüense",
// Gerald Aburto) vivía SOLO dentro de AboutUsModal.tsx, escondido detrás de un
// clic en "Quiénes Somos". Acá se muestra directo; "Conocé nuestra historia" abre
// el mismo modal para quien quiera profundizar. Cada instancia del modal controla
// su propio open/close (ver Hero.tsx, que tiene la suya) — es seguro montar más de una.
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { AboutUsModal } from "~/components/layout/AboutUsModal";

export function OurStoryStrip() {
  const [open, setOpen] = useState(false);

  return (
    <section aria-label="Sobre Gyro Store" className="py-8">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-border/50 bg-surface/40 p-6 text-center sm:flex-row sm:gap-6 sm:p-8 sm:text-left">
        <img
          src="/images/founder.jpg"
          alt="Gerald Aburto, fundador de Gyro Store"
          className="h-20 w-20 shrink-0 rounded-full border-2 border-accent/30 object-cover"
          onError={(e) => {
            e.currentTarget.src = "https://ui-avatars.com/api/?name=Gerald+Aburto&background=04201a&color=fff";
          }}
        />
        <div className="flex-1">
          <h2 className="font-heading text-lg font-bold text-text sm:text-xl">
            Hecho por nicaragüenses, para nicaragüenses
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Gyro Store nació en Managua importando tecnología directo para vos — sin intermediarios, con soporte real por WhatsApp.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm font-bold text-accent-2 transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Conocé nuestra historia
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </button>
      </div>
      <AboutUsModal open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
