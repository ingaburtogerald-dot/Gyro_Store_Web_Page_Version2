// Botón flotante de WhatsApp del storefront público.
//   · Móvil: esquina inferior IZQUIERDA — no choca con FeedbackFab (abajo-derecha,
//     ver root.tsx) ni con los toasts de Sonner (también abajo-derecha).
//   · Desktop (md+): se apila abajo-derecha, arriba de FeedbackFab, con separación.
// Número y mensaje confirmados por el negocio: usa el WhatsApp de /api/config
// (server/config.js → WHATSAPP_NUMBER) — no hardcodeado.
import { MessageCircle } from "lucide-react";
import { useGetConfigQuery } from "~/store/api/catalogApi";
import { buildWhatsappUrl } from "~/lib/utils";

const DEFAULT_MESSAGE = "Hola, quiero más información sobre un producto.";

export function WhatsAppFab() {
  const { data: config } = useGetConfigQuery();
  const number = config?.whatsapp;
  if (!number) return null;

  const href = buildWhatsappUrl(number, DEFAULT_MESSAGE);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      title="Escríbenos por WhatsApp"
      className="fixed z-40 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-b from-whatsapp to-[#00b38f] text-[#04201a] shadow-lg shadow-whatsapp/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-whatsapp/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp/60
        bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-[calc(1.5rem+env(safe-area-inset-left))]
        md:left-auto md:right-[calc(1.5rem+env(safe-area-inset-right))] md:bottom-[calc(5.25rem+env(safe-area-inset-bottom))]"
    >
      <MessageCircle className="h-6 w-6" strokeWidth={2} />
    </a>
  );
}
