import { useState, useRef, useEffect } from "react";
import { cn } from "~/lib/utils";

export function Autocomplete({
  options,
  value,
  onChange,
  onBlur,
  name,
  placeholder,
  className,
  invalid,
}: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((o) => o.toLowerCase().includes((value || "").toLowerCase()));

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        className={cn("input", invalid && "border-danger focus:border-danger", className)}
        value={value || ""}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        name={name}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-1 max-h-48 w-full overflow-auto rounded-card border border-border bg-surface-2 p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              className="w-full rounded-md px-3 py-2 text-left text-sm text-muted hover:bg-white/5 hover:text-text transition-colors"
              onMouseDown={(e) => e.preventDefault()} // evita blur del input antes de que onChange se ejecute
              onClick={() => {
                onChange(opt);
                setOpen(false);
                setTimeout(() => onBlur?.(), 0); // dispara validación con el valor ya actualizado
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
