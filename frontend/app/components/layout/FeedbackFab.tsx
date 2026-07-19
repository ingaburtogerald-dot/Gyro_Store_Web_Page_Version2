// Botón flotante de feedback del storefront público (reportar bug / sugerir /
// pedir producto). Esquina inferior derecha, igual que CartFab — en la ficha de
// producto esa esquina ya está reservada por la barra de compra móvil (ver el
// `pr-20` en producto.$id.tsx), así que no hay pelea de espacio.
import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { FeedbackModal } from "./FeedbackModal";

export function FeedbackFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Danos tu opinión"
        title="Danos tu opinión"
        className="fixed z-40 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-b from-accent to-accent-hover text-bg shadow-lg shadow-accent/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
          bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-[calc(1.5rem+env(safe-area-inset-right))]"
      >
        <Lightbulb className="h-5 w-5" strokeWidth={1.75} />
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
