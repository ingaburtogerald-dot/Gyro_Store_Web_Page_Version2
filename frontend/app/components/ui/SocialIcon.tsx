// Botón de red social reutilizable (header + footer): parte en "muted" y al hover
// sube, escala y se tiñe del color de la marca con un halo suave (springs de Framer).
import { motion } from "framer-motion";

export function SocialLink({
  href,
  label,
  color,
  tint,
  children,
}: {
  href?: string;
  label: string;
  color: string;
  tint: string;
  children: React.ReactNode;
}) {
  return (
    <motion.a
      href={href || "#"}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      whileHover={{ y: -3, scale: 1.15, color, backgroundColor: tint }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 420, damping: 17 }}
      className="grid h-9 w-9 place-items-center rounded-full text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {children}
    </motion.a>
  );
}

// Colores de marca de cada red (para el tinte al hover).
export const SOCIAL_BRAND = {
  instagram: { color: "#E1306C", tint: "rgba(225,48,108,0.16)" },
  facebook: { color: "#1877F2", tint: "rgba(24,119,242,0.16)" },
  tiktok: { color: "#25F4EE", tint: "rgba(37,244,238,0.16)" },
} as const;

// Lucide no trae el logo de TikTok; usamos un glifo propio (hereda currentColor).
export function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-2.59-2.59c.27 0 .53.04.78.12V9.79a5.7 5.7 0 0 0-.78-.05 5.69 5.69 0 1 0 5.69 5.69V8.9a7.34 7.34 0 0 0 4.3 1.38V7.18a4.28 4.28 0 0 1-3.25-1.36z" />
    </svg>
  );
}
