// Editor modal de una diapositiva del Hero (modo edición inline). El admin cambia
// media (imagen/GIF), textos y destino del botón; un panel de "Vista previa" muestra
// cómo se verá antes de guardar. La subida usa la misma arquitectura R2 del logo.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Eye, EyeOff, Save, ArrowRight, Loader2 } from "lucide-react";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { useUploadHeroSlideMutation } from "~/store/api/catalogApi";
import type { HeroSlide } from "~/types/catalog";
import { cn } from "~/lib/utils";

// Media polimórfica: renderiza <video> o <img> según el tipo. Reutilizada por el
// preview del editor y por el Hero real.
export function SlideMedia({ slide, className, forceReplayKey }: { slide: Pick<HeroSlide, "mediaUrl" | "mediaType" | "title">; className?: string; forceReplayKey?: number }) {
  if (!slide.mediaUrl) {
    return <div className={cn("grid place-items-center bg-black/40 text-xs text-white/40", className)}>Sin media</div>;
  }
  if (slide.mediaType === "video") {
    return (
      <video
        key={slide.mediaUrl + (forceReplayKey || 0)}
        src={slide.mediaUrl}
        autoPlay
        muted
        loop
        playsInline
        controls={false}
        disablePictureInPicture
        className={className}
        ref={(el) => {
          if (el) {
            el.defaultMuted = true;
            el.muted = true;
            el.play().catch(() => {});
          }
        }}
      />
    );
  }
  
  // Append the key as a cache-buster so animations actually restart from frame 0,
  // even if the URL doesn't end in .gif (e.g. Firebase storage URLs)
  const url = forceReplayKey ? `${slide.mediaUrl}${slide.mediaUrl.includes("?") ? "&" : "?"}t=${forceReplayKey}` : slide.mediaUrl;
  
  return <img key={url} src={url} alt={slide.title || ""} className={className} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function HeroSlideEditorModal({
  open,
  slide,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  slide: HeroSlide | null;
  onClose: () => void;
  onSave: (updated: HeroSlide) => void | Promise<void>;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<HeroSlide | null>(slide);
  const [showPreview, setShowPreview] = useState(true);
  const [uploadHeroSlide, { isLoading: uploading }] = useUploadHeroSlideMutation();
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-sembrar el borrador cada vez que se abre con un slide distinto.
  useEffect(() => {
    setDraft(slide);
  }, [slide]);

  if (!draft) return null;

  const set = <K extends keyof HeroSlide>(key: K, value: HeroSlide[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  async function handleFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("slideId", draft!.id);
    try {
      const res = await uploadHeroSlide(fd).unwrap();
      setDraft((d) => (d ? { ...d, mediaUrl: res.url, mediaType: res.mediaType } : d));
      toast.success("Media subida. Recuerda guardar los cambios.");
    } catch (e) {
      const msg = (e as { data?: { error?: string } })?.data?.error;
      toast.error(msg || "No se pudo subir la media.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={draft.locked ? "Editar diapositiva de marca" : "Editar diapositiva"}
      maxWidth="max-w-3xl"
      headerRight={
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showPreview ? "Ocultar" : "Vista previa"}
        </button>
      }
    >
      <div className="space-y-5">
        {/* ── Vista previa (cómo se verá el slide antes de guardar) ── */}
        {showPreview && (
          <div className="overflow-hidden rounded-2xl border border-border bg-[#111]">
            <div className="flex min-h-[180px] flex-col sm:flex-row">
              <div className="relative flex h-32 w-full items-center justify-center overflow-hidden bg-black/50 sm:h-auto sm:w-1/2">
                <SlideMedia slide={draft} className="absolute inset-0 h-full w-full object-contain p-4" />
              </div>
              <div className="flex w-full flex-col justify-center gap-2 p-5 text-left sm:w-1/2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-2">{draft.eyebrow || "EYEBROW"}</span>
                <h3 className="font-heading text-2xl font-black leading-tight text-white">{draft.title || "Título"}</h3>
                <p className="line-clamp-3 text-xs text-white/70">{draft.description || "Descripción…"}</p>
                <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent to-accent-2 px-3 py-1.5 text-xs font-bold text-bg">
                  {draft.buttonText || "Botón"}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Media ── */}
        <div className="flex items-center gap-4 rounded-xl border border-border bg-surface-2/40 p-3">
          <div className="grid h-16 w-28 shrink-0 place-items-center overflow-hidden rounded-lg bg-black">
            <SlideMedia slide={draft} className="max-h-full max-w-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-xs leading-relaxed text-muted">Imagen, GIF o video (JPG, PNG, WebP, GIF, MP4, WebM, MOV). El GIF y el video conservan su animación.</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/ogg,video/quicktime"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                if (inputRef.current) inputRef.current.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {draft.mediaUrl ? "Cambiar media" : "Subir media"}
            </Button>
          </div>
        </div>

        {/* ── Textos ── */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Eyebrow (línea superior)">
            <input className="input" value={draft.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} />
          </Field>
          <Field label="Título">
            <input className="input" value={draft.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
        </div>
        <Field label="Descripción">
          <textarea className="input min-h-[80px] resize-y" value={draft.description} onChange={(e) => set("description", e.target.value)} />
        </Field>

        {/* ── Botón / acción ── */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Texto del botón">
            <input className="input" value={draft.buttonText} onChange={(e) => set("buttonText", e.target.value)} />
          </Field>
          <Field label="Acción del botón">
            <select className="input" value={draft.actionType} onChange={(e) => set("actionType", e.target.value as HeroSlide["actionType"])}>
              <option value="modal">Abrir "Quiénes Somos"</option>
              <option value="link">Ir a un enlace</option>
            </select>
          </Field>
        </div>
        {draft.actionType === "link" && (
          <Field label="Destino del enlace (ej. /#catalogo o /producto/…)">
            <input className="input" value={draft.actionTarget} onChange={(e) => set("actionTarget", e.target.value)} placeholder="/#catalogo" />
          </Field>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={() => onSave(draft)} loading={saving} disabled={uploading}>
            <Save className="h-4 w-4" /> Guardar cambios
          </Button>
        </div>
      </div>
    </Modal>
  );
}
