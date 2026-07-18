// Logo de marca reutilizable. Imagen estática por defecto; al hacer hover o
// presionar (click) superpone un GIF animado que SIEMPRE reinicia desde el frame 0.
//
// Por qué es necesario forzar el reinicio:
//   Los navegadores comparten UNA sola línea de tiempo de animación entre todas las
//   instancias de un mismo GIF (misma URL). Remontar el <img> con la misma URL lo
//   sincroniza con la animación en curso (parece que "no arranca" hasta que el loop
//   da la vuelta), en vez de empezar de cero. La única forma fiable de reiniciar es
//   cargarlo desde una URL DISTINTA cada vez.
//
//   Para no re-descargar el GIF en cada hover, se precarga una vez como Blob y se
//   genera un `object URL` nuevo en cada activación: cada uno es un recurso distinto
//   (arranca en el frame 0) pero sale de memoria, sin red.
//
// El archivo real es rectangular (160×80, 2:1): altura fija + ancho automático
// (object-contain), SIN recorte circular.
//
// API retro-compatible: `size` (= ALTURA en px), `withText`, `textClassName`,
// `className`, `asLink` (el logo es <Link> a "/"; déjalo en false si un padre ya lo
// envuelve en un <Link>, para no anidar anchors).
import { useEffect, useRef, useState } from "react";
import { Link } from "@remix-run/react";
import { cn } from "~/lib/utils";
import { useGetConfigQuery } from "~/store/api/catalogApi";

// Fallback: archivos del repo. El admin puede sobre-escribir estas URLs desde
// Configuración → Logo del header (se guardan en la config y llegan por /api/config).
const DEFAULT_STATIC = "/logo-estatico.jpg";
const DEFAULT_ANIMATED = "/logo-animado.gif";

export function Logo({
  size = 36,
  withText = false,
  textClassName,
  className,
  asLink = false,
}: {
  /** Altura del logo en px (el ancho se calcula manteniendo la proporción). */
  size?: number;
  withText?: boolean;
  textClassName?: string;
  className?: string;
  /** Si es true, el logo se comporta como enlace al inicio ("/"). */
  asLink?: boolean;
}) {
  const [active, setActive] = useState(false);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const objUrlRef = useRef<string | null>(null);

  // Logo configurable desde el admin (branding). Fallback a los archivos del repo.
  const { data: cfg } = useGetConfigQuery();
  const staticUrl = cfg?.branding?.logoStaticUrl || DEFAULT_STATIC;
  const animatedUrl = cfg?.branding?.logoAnimatedUrl || DEFAULT_ANIMATED;

  // Precarga el GIF como Blob (para generar object URLs sin red). Se re-ejecuta si
  // el admin cambia el logo animado (la URL cambia → se recarga el Blob nuevo).
  useEffect(() => {
    let cancelled = false;
    blobRef.current = null;
    fetch(animatedUrl)
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => {
        if (!cancelled) blobRef.current = b;
      })
      .catch(() => {
        /* si falla (p.ej. CORS de R2), se usa el fallback con cache-busting */
      });
    return () => {
      cancelled = true;
      if (objUrlRef.current) {
        URL.revokeObjectURL(objUrlRef.current);
        objUrlRef.current = null;
      }
    };
  }, [animatedUrl]);

  const activate = () => {
    // URL única → el GIF reinicia desde el frame 0, siempre y de inmediato.
    if (blobRef.current) {
      if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current);
      const url = URL.createObjectURL(blobRef.current);
      objUrlRef.current = url;
      setGifUrl(url);
    } else {
      // Fallback (el Blob aún no cargó o falló por CORS): cache-busting único.
      setGifUrl(`${animatedUrl}${animatedUrl.includes("?") ? "&" : "?"}t=${Date.now()}`);
    }
    setActive(true);
  };
  const deactivate = () => setActive(false);

  const mark = (
    <span className="relative block shrink-0" style={{ height: size }}>
      {/* Imagen estática (base): fija la caja con su proporción natural. */}
      <img
        src={staticUrl}
        alt="Gyro Store"
        style={{ height: size }}
        className="block h-full w-auto select-none object-contain"
        draggable={false}
      />
      {/* GIF animado: montado solo mientras está activo, con URL única por activación
          (key = url) → reinicia desde el frame 0 en cada hover/press. */}
      {active && gifUrl && (
        <img
          key={gifUrl}
          src={gifUrl}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
          draggable={false}
        />
      )}
    </span>
  );

  const content = (
    <>
      {mark}
      {withText && (
        <span
          className={cn(
            "bg-gradient-accent bg-clip-text font-extrabold text-transparent",
            textClassName,
          )}
        >
          Gyro Store
        </span>
      )}
    </>
  );

  // Handlers de activación (hover + press + foco) compartidos por ambas variantes.
  const activation = {
    onMouseEnter: activate,
    onMouseLeave: deactivate,
    onPointerDown: activate,
    onFocus: activate,
    onBlur: deactivate,
  };

  if (asLink) {
    return (
      <Link
        to="/"
        aria-label="Ir al inicio de Gyro Store"
        className={cn("inline-flex items-center gap-2.5 outline-none", className)}
        {...activation}
      >
        {content}
      </Link>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} {...activation}>
      {content}
    </span>
  );
}
