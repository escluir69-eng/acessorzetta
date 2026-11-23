const BASE_CATEGORIES = new Set(["NENHUMA", "B", "C", "D", "E"]);

/** Resolve a categoria armazenada da CNH sem perder compatibilidade com categorias antigas. */
export function resolveDriverCnhCategory(baseCategory: string, hasCategoryA: boolean): string {
  const normalizedBase = baseCategory.toUpperCase();
  if (!BASE_CATEGORIES.has(normalizedBase)) {
    throw new Error("Categoria principal da CNH inválida.");
  }
  if (hasCategoryA) return normalizedBase === "NENHUMA" ? "A" : `A${normalizedBase}`;
  if (normalizedBase === "NENHUMA") return "";
  return normalizedBase;
}

/** Decompõe categorias legadas (A, AB, AC, AD, AE) para edição no formulário. */
export function splitDriverCnhCategory(category: string): { baseCategory: string; hasCategoryA: boolean } {
  const normalized = category.toUpperCase();
  if (normalized === "A") return { baseCategory: "NENHUMA", hasCategoryA: true };
  if (normalized.startsWith("A") && ["AB", "AC", "AD", "AE"].includes(normalized)) {
    return { baseCategory: normalized.slice(1), hasCategoryA: true };
  }
  return { baseCategory: normalized, hasCategoryA: false };
}
