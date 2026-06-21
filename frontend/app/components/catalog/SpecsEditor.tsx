// Editor de la tabla de especificaciones técnicas (label / value).
import { Plus, Trash2 } from "lucide-react";
import type { SpecRow } from "~/store/api/catalogApi";

export function SpecsEditor({
  specs,
  onChange,
}: {
  specs: SpecRow[];
  onChange: (next: SpecRow[]) => void;
}) {
  function update(i: number, patch: Partial<SpecRow>) {
    onChange(specs.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  return (
    <div className="space-y-2">
      {specs.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            className="input flex-1"
            placeholder="Ej: Impedancia"
            value={s.label}
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <input
            className="input flex-1"
            placeholder="Ej: 32 Ω"
            value={s.value}
            onChange={(e) => update(i, { value: e.target.value })}
          />
          <button
            type="button"
            onClick={() => onChange(specs.filter((_, idx) => idx !== i))}
            className="rounded-lg p-2 text-muted hover:text-red-400"
            aria-label="Quitar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...specs, { label: "", value: "" }])}
        className="inline-flex items-center gap-1.5 text-sm text-accent-2 hover:underline"
      >
        <Plus className="h-4 w-4" /> Agregar especificación
      </button>
    </div>
  );
}
