import { List } from "lucide-react";
import { cn } from "~/lib/utils";

interface Spec {
  label: string;
  value: string;
}

interface ProductSpecsProps {
  specs?: Spec[];
}

export function ProductSpecs({ specs }: ProductSpecsProps) {
  if (!specs || specs.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg font-bold mb-6 text-text flex items-center gap-2">
        <List className="h-5 w-5 text-accent" />
        Especificaciones Técnicas
      </h3>
      <ul className="overflow-hidden rounded-2xl border border-border">
        {specs.map((s, i) => (
          <li
            key={i}
            className={cn(
              "flex px-5 py-3.5",
              i % 2 === 0 ? "bg-surface-2/60" : "bg-transparent",
            )}
          >
            <span className="w-2/5 text-sm font-medium text-text">{s.label}</span>
            <span className="w-3/5 text-sm text-muted">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
