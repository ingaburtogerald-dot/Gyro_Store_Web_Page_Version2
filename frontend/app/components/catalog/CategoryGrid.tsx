import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { useGetConfigQuery, useUpdateCategoriesMutation, type Category } from "~/store/api/catalogApi";

export function CategoryGrid() {
  const { data: config, isLoading } = useGetConfigQuery();
  const [updateCategories, { isLoading: isUpdating }] = useUpdateCategoriesMutation();

  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (config?.categories) {
      setCategories(config.categories);
    }
  }, [config?.categories]);

  function handleAdd() {
    setCategories([...categories, { id: "", name: "", icon: "" }]);
  }

  function handleRemove(index: number) {
    const next = [...categories];
    next.splice(index, 1);
    setCategories(next);
  }

  function handleMove(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];
    setCategories(next);
  }

  function handleChange(index: number, field: keyof Category, value: string) {
    const next = [...categories];
    next[index] = { ...next[index], [field]: value };
    setCategories(next);
  }

  async function handleSave() {
    try {
      await updateCategories(categories).unwrap();
      toast.success("Categorías guardadas correctamente.");
    } catch (e) {
      toast.error("Error al guardar las categorías.");
    }
  }

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-card border border-border bg-surface shadow-premium" />;
  }

  return (
    <div className="pb-8">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">{categories.length} categorías configuradas</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4" /> Agregar categoría
          </Button>
          <Button size="sm" onClick={handleSave} loading={isUpdating}>
            <Save className="h-4 w-4" /> Guardar cambios
          </Button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-card border border-border bg-surface shadow-premium">
          <p className="text-muted">No hay categorías configuradas.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {categories.map((cat, i) => (
            <div key={i} className="flex items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-premium transition-all hover:border-accent/40">
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => handleMove(i, -1)}
                  disabled={i === 0}
                  className="rounded hover:bg-surface-2 disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4 text-text" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(i, 1)}
                  disabled={i === categories.length - 1}
                  className="rounded hover:bg-surface-2 disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4 text-text" />
                </button>
              </div>
              
              <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr_60px]">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">ID único (URL)</label>
                  <input
                    type="text"
                    value={cat.id} 
                    onChange={(e) => handleChange(i, "id", e.target.value)} 
                    placeholder="ej: audifonos-kz"
                    className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 text-text"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Nombre visible</label>
                  <input
                    type="text"
                    value={cat.name} 
                    onChange={(e) => handleChange(i, "name", e.target.value)} 
                    placeholder="ej: Audífonos In Ear"
                    className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 text-text"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Ícono</label>
                  <input
                    type="text"
                    value={cat.icon || ""} 
                    onChange={(e) => handleChange(i, "icon", e.target.value)} 
                    placeholder="🎧"
                    className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 text-text text-center"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="ml-2 rounded-lg bg-surface-2 p-2 text-text hover:text-danger transition-colors"
                aria-label="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
