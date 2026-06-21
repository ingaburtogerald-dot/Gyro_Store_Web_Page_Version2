// Logo de marca reutilizable. Emblema circular (logo.jpg) con opción de mostrar
// el wordmark "Gyro Store" en degradado al lado.
import { cn } from "~/lib/utils";

export function Logo({
  size = 36,
  withText = false,
  textClassName,
  className,
}: {
  size?: number;
  withText?: boolean;
  textClassName?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src="/logo.jpg"
        alt="Gyro Store"
        width={size}
        height={size}
        className="rounded-full object-cover ring-1 ring-white/10"
        style={{ width: size, height: size }}
      />
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
    </span>
  );
}
