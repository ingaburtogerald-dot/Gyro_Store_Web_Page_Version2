// Panel "Recursos de imágenes" (Configuración). Un solo lugar para actualizar todas
// las imágenes de la tienda. Cada ranura declara para qué sirve y qué medidas debe
// tener. Al guardar, sube la nueva a R2 y borra la anterior (server/routes/config.js).
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, Save } from "lucide-react";
import { Button } from "~/components/ui/Button";
import {
  useUploadImageMutation,
  useRemoveImageMutation,
  type Branding,
  type BrandingImageKind,
} from "~/store/api/salesApi";

// Definición declarativa de cada recurso: añadir uno nuevo = una línea aquí + su
// campo en `Branding` (front) y en `BRANDING_FIELDS` (server).
type Slot = {
  kind: BrandingImageKind;
  field: keyof Branding;
  label: string;
  purpose: string;
  dimensions: string;
  accept: string;
  /** Fondo de la vista previa: la mayoría van sobre negro; el ticket se imprime en blanco. */
  previewBg: "black" | "white";
  /** Aún no se consume en el sitio (falta cablear al SSR). Se sube y guarda igual. */
  pending?: boolean;
};

const IMG_ACCEPT = "image/jpeg,image/png,image/webp";
const MEDIA_ACCEPT = "image/gif,video/mp4,video/webm,video/ogg,video/quicktime";

const SLOTS: Slot[] = [
  {
    kind: "static",
    field: "logoStaticUrl",
    label: "Logo estático",
    purpose: "Marca base del sitio: header, footer, login y panel de administración.",
    dimensions: "512×512 px (o 600×300 si es tipo banner 2:1) · PNG con fondo transparente",
    accept: IMG_ACCEPT,
    previewBg: "black",
  },
  {
    kind: "animated",
    field: "logoAnimatedUrl",
    label: "Logo animado",
    purpose: "Se reproduce al pasar el mouse o hacer clic sobre el logo del header.",
    dimensions: "Mismas medidas que el estático · MP4/WebM (recomendado) o GIF",
    accept: MEDIA_ACCEPT,
    previewBg: "black",
  },
  {
    kind: "favicon",
    field: "faviconUrl",
    label: "Favicon",
    purpose: "Ícono que aparece en la pestaña del navegador, marcadores y pantalla de inicio.",
    dimensions: "512×512 px cuadrado · versión simple (solo el emblema) · PNG",
    accept: IMG_ACCEPT,
    previewBg: "black",
  },
  {
    kind: "ticket",
    field: "ticketLogoUrl",
    label: "Logo del ticket (POS)",
    purpose: "Cabecera del ticket impreso de 80mm en Facturación.",
    dimensions: "600×600 px · alto contraste sobre blanco (impresión térmica) · PNG",
    accept: IMG_ACCEPT,
    previewBg: "white",
  },
  {
    kind: "og",
    field: "ogImageUrl",
    label: "Imagen para compartir",
    purpose: "Vista previa que se muestra al compartir el enlace en WhatsApp, Facebook, etc.",
    dimensions: "1200×630 px · JPG o PNG",
    accept: IMG_ACCEPT,
    previewBg: "black",
  },
  {
    kind: "founder",
    field: "founderUrl",
    label: "Foto “Quiénes somos”",
    purpose: "Avatar del fundador en la sección “Nuestra historia” y el modal de la tienda.",
    dimensions: "400×400 px cuadrado · JPG o PNG",
    accept: IMG_ACCEPT,
    previewBg: "black",
  },
  {
    kind: "loginBrand",
    field: "loginBrandUrl",
    label: "Login · panel de marca (escritorio)",
    purpose:
      "Imagen editorial detrás del logo en la columna derecha de la pantalla de inicio de sesión (pantallas grandes). Vacío → gradiente de acento.",
    dimensions: "1200×1600 px (retrato 3:4, vertical) · JPG o PNG · se recorta a la forma del panel",
    accept: IMG_ACCEPT,
    previewBg: "black",
  },
  {
    kind: "loginBrandMobile",
    field: "loginBrandMobileUrl",
    label: "Login · banda de marca (móvil)",
    purpose:
      "Imagen editorial detrás del logo en la banda superior de la pantalla de inicio de sesión en móvil. Vacío → gradiente de acento.",
    dimensions: "1200×540 px (panorámico ~2.2:1, horizontal) · JPG o PNG · se recorta a la forma de la banda",
    accept: IMG_ACCEPT,
    previewBg: "black",
  },
];

type Staged = File | "remove" | null;

function isVideoSrc(staged: Staged, src: string) {
  if (staged instanceof File) return staged.type.startsWith("video/");
  return Boolean(src && /\.(mp4|webm|ogg|mov)$/i.test(src));
}

// Una ranura de imagen. PRESENTACIONAL: prepara el cambio (vista previa local o marca
// "quitar"); no sube nada hasta que el padre pulse "Guardar cambios".
function ImageRow({
  slot,
  currentUrl,
  staged,
  onSelect,
  onRemove,
  onUndo,
}: {
  slot: Slot;
  currentUrl?: string;
  staged: Staged;
  onSelect: (file: File) => void;
  onRemove: () => void;
  onUndo: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localUrl, setLocalUrl] = useState("");

  useEffect(() => {
    if (staged instanceof File) {
      const u = URL.createObjectURL(staged);
      setLocalUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    setLocalUrl("");
  }, [staged]);

  const changed = staged !== null;
  const hasCurrent = Boolean(currentUrl);
  const src = staged instanceof File ? localUrl : staged === "remove" ? "" : currentUrl || "";
  const video = isVideoSrc(staged, src);

  return (
    <div className="flex flex-col gap-2 border-b border-border/40 pb-5 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text">{slot.label}</span>
          {slot.pending && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted">
              Pendiente de conectar
            </span>
          )}
        </div>
        {changed && (
          <span className="text-[11px] font-medium text-accent-2">
            {staged === "remove" ? "Se quitará al guardar" : "Nuevo · sin guardar"}
          </span>
        )}
      </div>

      <div className="flex items-start gap-4">
        <div
          className={`grid h-16 w-28 shrink-0 place-items-center overflow-hidden rounded-lg border border-border ${
            slot.previewBg === "white" ? "bg-white" : "bg-black"
          }`}
        >
          {src ? (
            video ? (
              <video src={src} autoPlay muted loop playsInline className="max-h-full max-w-full object-contain" />
            ) : (
              <img src={src} alt="" className="max-h-full max-w-full object-contain" />
            )
          ) : (
            <span className="text-[11px] text-muted">Sin imagen</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs leading-relaxed text-muted">{slot.purpose}</p>
          <p className="mt-1 text-[11px] font-medium text-text/80">
            Medidas: <span className="text-muted">{slot.dimensions}</span>
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={slot.accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onSelect(f);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {hasCurrent || staged instanceof File ? "Cambiar" : "Elegir imagen"}
            </Button>
            {changed ? (
              <button
                type="button"
                onClick={onUndo}
                className="text-xs font-medium text-muted underline-offset-2 transition-colors hover:text-text hover:underline"
              >
                Deshacer
              </button>
            ) : hasCurrent ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onRemove}
                className="flex items-center gap-2 text-danger"
              >
                <Trash2 className="h-4 w-4" /> Quitar
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SiteImagesPanel({ branding }: { branding?: Branding }) {
  const [uploadImage] = useUploadImageMutation();
  const [removeImage] = useRemoveImageMutation();
  const [saving, setSaving] = useState(false);
  // Cambio pendiente por kind: File (nuevo) | "remove" (quitar) | null (sin cambio).
  const [staged, setStaged] = useState<Record<BrandingImageKind, Staged>>({
    static: null,
    animated: null,
    favicon: null,
    ticket: null,
    og: null,
    founder: null,
    loginBrand: null,
    loginBrandMobile: null,
  });

  const hasChanges = Object.values(staged).some((v) => v !== null);
  const setKind = (kind: BrandingImageKind, value: Staged) =>
    setStaged((s) => ({ ...s, [kind]: value }));

  async function save() {
    setSaving(true);
    try {
      for (const slot of SLOTS) {
        const change = staged[slot.kind];
        if (change instanceof File) {
          const fd = new FormData();
          fd.append("file", change);
          fd.append("kind", slot.kind);
          await uploadImage(fd).unwrap();
        } else if (change === "remove") {
          await removeImage(slot.kind).unwrap();
        }
      }
      setStaged({ static: null, animated: null, favicon: null, ticket: null, og: null, founder: null, loginBrand: null, loginBrandMobile: null });
      toast.success("Imágenes del sitio guardadas.");
    } catch (e) {
      const msg = (e as { data?: { error?: string } })?.data?.error;
      toast.error(msg || "No se pudieron guardar las imágenes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {SLOTS.map((slot) => (
        <ImageRow
          key={slot.kind}
          slot={slot}
          currentUrl={branding?.[slot.field]}
          staged={staged[slot.kind]}
          onSelect={(f) => setKind(slot.kind, f)}
          onRemove={() => setKind(slot.kind, "remove")}
          onUndo={() => setKind(slot.kind, null)}
        />
      ))}
      <div className="sticky bottom-0 flex justify-end border-t border-border bg-surface/80 pt-4 backdrop-blur">
        <Button
          type="button"
          onClick={save}
          loading={saving}
          disabled={!hasChanges}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" /> Guardar cambios
        </Button>
      </div>
    </div>
  );
}
