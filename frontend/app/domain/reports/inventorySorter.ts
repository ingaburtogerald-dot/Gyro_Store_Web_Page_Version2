// ─────────────────────────────────────────────────────────────────────────────
// Dominio puro — ordenamiento de productos de inventario por código.
// Sin React, sin side-effects → 100% testeable y reutilizable (no solo en Pérdidas).
// ─────────────────────────────────────────────────────────────────────────────

/** Extrae el número del código ("IN12" → 12, "M-IN58" → 58) para ordenar. Sin dígitos → al final. */
export function codeNum(code?: string): number {
  const m = code?.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

/**
 * Ordena productos por código numérico ascendente (IN1, IN2, …), con los nativos
 * antes que los migrados. No muta el array de entrada. Genérico: sirve para cualquier
 * lista con `code` y `origin`.
 */
export function sortProductsByCode<T extends { code?: string; origin: "native" | "migrated" }>(
  products: readonly T[],
): T[] {
  return [...products].sort((a, b) => {
    if (a.origin !== b.origin) return a.origin === "migrated" ? 1 : -1;
    return codeNum(a.code) - codeNum(b.code);
  });
}
