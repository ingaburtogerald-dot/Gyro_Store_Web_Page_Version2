// Barra de compra flotante en móvil, compartida por producto y combo. Aparece
// mientras el footer NO está en vista. Incluye safe-area inferior para notch.
//
// Se renderiza vía portal a <body>: el layout raíz envuelve las rutas en un <main>
// con un transform de transición de página, y un ancestro con transform convierte
// el `position:fixed` en relativo a ese ancestro (la barra se anclaría al fondo del
// contenido, no del viewport). El portal la saca de ese contexto → pega al viewport.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AddToCartButton } from "./AddToCartButton";
import { WhatsAppButton } from "./WhatsAppButton";

export function MobileBuyBar({
  visible,
  isAdded,
  onAdd,
  addLabel,
  whatsappUrl,
  whatsappLabel = "Comprar por WhatsApp",
  disabled,
}: {
  visible: boolean;
  isAdded: boolean;
  onAdd: () => void;
  addLabel: string;
  whatsappUrl: string;
  whatsappLabel?: string;
  disabled?: boolean;
}) {
  // El portal necesita `document` → solo en cliente tras montar.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !visible) return null;

  return createPortal(
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex gap-2 border-t border-border/40 bg-bg/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md animate-in fade-in slide-in-from-bottom duration-300">
      <div className="flex-1">
        <AddToCartButton
          isAdded={isAdded}
          onClick={onAdd}
          disabled={disabled}
          idleLabel={addLabel}
          heightClass="h-11"
        />
      </div>
      <WhatsAppButton href={whatsappUrl} label={whatsappLabel} iconOnly heightClass="h-11" />
    </div>,
    document.body,
  );
}
