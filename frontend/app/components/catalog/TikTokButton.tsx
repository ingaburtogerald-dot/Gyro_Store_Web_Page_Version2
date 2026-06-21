// Botón/thumbnail que abre el video de TikTok del producto.
// Si el enlace tiene un id de video numérico, lo embebe en un modal; si no
// (enlaces cortos vm.tiktok.com), abre el video en una pestaña nueva.
import { useState } from "react";
import { Play, X } from "lucide-react";
import { cn } from "~/lib/utils";

function extractVideoId(url: string): string | null {
  const m = url.match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}

export function TikTokButton({ url, className }: { url: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const videoId = extractVideoId(url);

  return (
    <>
      <button
        type="button"
        onClick={() => (videoId ? setOpen(true) : window.open(url, "_blank", "noreferrer"))}
        className={cn(
          "inline-flex items-center gap-2 rounded-pill border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-2",
          className,
        )}
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-accent text-white">
          <Play className="h-3.5 w-3.5" />
        </span>
        Ver video en TikTok
      </button>

      {open && videoId && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[340px]">
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="absolute -top-9 right-0 text-white/80 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="aspect-[9/16] overflow-hidden rounded-card bg-black">
              <iframe
                title="Video de TikTok"
                src={`https://www.tiktok.com/embed/v2/${videoId}`}
                className="h-full w-full"
                allow="encrypted-media"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
