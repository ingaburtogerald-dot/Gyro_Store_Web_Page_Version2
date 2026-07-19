// Inputs con floating label (sin JS: truco `peer` + `:placeholder-shown` de
// Tailwind — el label flota al enfocar O cuando ya hay valor). Fondo translúcido,
// borde sutil que se ilumina en hover/focus. `FloatingTextarea` además se
// auto-ajusta de alto según el contenido.
import { forwardRef, useEffect, useId, useRef } from "react";
import { cn } from "~/lib/utils";

const baseField =
  "peer w-full rounded-xl border bg-surface-2/50 text-sm text-text outline-none transition-all placeholder-transparent focus:ring-2 focus:ring-accent/25";
const baseBorder = (invalid?: boolean) =>
  invalid ? "border-danger focus:border-danger" : "border-white/10 hover:border-white/20 focus:border-accent";
const baseLabel =
  "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted transition-all duration-150 " +
  "peer-focus:top-2.5 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-wide peer-focus:text-accent-2 " +
  "peer-[:not(:placeholder-shown)]:top-2.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:uppercase peer-[:not(:placeholder-shown)]:tracking-wide peer-[:not(:placeholder-shown)]:text-muted";

interface FloatingInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "placeholder"> {
  label: string;
  invalid?: boolean;
}

export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(function FloatingInput(
  { label, invalid, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className="relative">
      <input
        ref={ref}
        id={inputId}
        placeholder=" "
        className={cn(baseField, baseBorder(invalid), "px-3.5 pb-2.5 pt-5", className)}
        {...props}
      />
      <label htmlFor={inputId} className={baseLabel}>
        {label}
      </label>
    </div>
  );
});

interface FloatingTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "placeholder"> {
  label: string;
  invalid?: boolean;
}

export function FloatingTextarea({ label, invalid, className, id, value, ...props }: FloatingTextareaProps) {
  const autoId = useId();
  const textareaId = id || autoId;
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-ajuste de alto: crece con el contenido, sin scrollbar interno.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <div className="relative">
      <textarea
        ref={ref}
        id={textareaId}
        value={value}
        placeholder=" "
        rows={1}
        className={cn(
          baseField,
          baseBorder(invalid),
          "resize-none overflow-hidden px-3.5 pb-3 pt-6 leading-relaxed",
          className,
        )}
        {...props}
      />
      <label
        htmlFor={textareaId}
        className="pointer-events-none absolute left-3.5 top-3 text-[10px] font-bold uppercase tracking-wide text-muted transition-colors duration-150 peer-focus:text-accent-2"
      >
        {label}
      </label>
    </div>
  );
}
