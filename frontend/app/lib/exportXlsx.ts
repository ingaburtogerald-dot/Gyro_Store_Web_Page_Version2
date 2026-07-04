// Exporta filas a un archivo .xlsx (SheetJS) de manera dinámica para reducir el tamaño del bundle inicial.
export async function exportXlsx(filename: string, sheets: { name: string; rows: object[] }[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows);
    // Ancho mínimo legible por columna (SheetJS no auto-ajusta).
    const keys = sheet.rows.length ? Object.keys(sheet.rows[0]) : [];
    ws["!cols"] = keys.map((key) => ({ wch: Math.max(14, key.length + 4) }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
