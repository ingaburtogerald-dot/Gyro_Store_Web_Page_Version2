// Botón de compra por WhatsApp compartido. Unifica el mecanismo (siempre un <a>
// target=_blank; antes el combo usaba window.open y el producto un <a>). Dos formas:
// ancho con etiqueta, o cuadrado solo-ícono (barra flotante móvil).
import { Button } from "~/components/ui/Button";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { cn } from "~/lib/utils";

export function WhatsAppButton({
  href,
  label,
  heightClass = "h-11 sm:h-12",
  iconOnly = false,
}: {
  href: string;
  label: string;
  heightClass?: string;
  iconOnly?: boolean;
}) {
  if (iconOnly) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="shrink-0">
        <Button variant="whatsapp" aria-label={label} className={cn("w-11 p-0", heightClass)}>
          <WhatsAppIcon className="h-5 w-5 shrink-0" />
        </Button>
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block w-full">
      <Button variant="whatsapp" className={cn("w-full", heightClass)}>
        <WhatsAppIcon className="h-5 w-5 shrink-0" />
        <span>{label}</span>
      </Button>
    </a>
  );
}
