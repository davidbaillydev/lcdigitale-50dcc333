/** Exports côté navigateur (CSV, Excel, PDF) — appeler uniquement depuis un gestionnaire d'événement. */
type Row = Record<string, string | number | null | undefined>;

function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function downloadCSV(name: string, rows: Row[]) {
  const cols = rows.length ? Object.keys(rows[0]!) : [];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\n");
  save(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
}

export async function downloadXLSX(name: string, sheets: Record<string, Row[]>) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const [title, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), title.slice(0, 31));
  XLSX.writeFile(wb, `${name}.xlsx`);
}

export async function downloadPDF(name: string, title: string, subtitle: string, sections: { heading: string; rows: Row[] }[]) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF();
  doc.setFontSize(18); doc.text(title, 14, 18);
  doc.setFontSize(10); doc.text(subtitle, 14, 25);
  let y = 32;
  for (const s of sections) {
    if (!s.rows.length) continue;
    doc.setFontSize(12); doc.text(s.heading, 14, y);
    const cols = Object.keys(s.rows[0]!);
    autoTable(doc, { startY: y + 3, head: [cols], body: s.rows.map((r) => cols.map((c) => String(r[c] ?? ""))), styles: { fontSize: 8 }, headStyles: { fillColor: [40, 40, 40] } });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }
  doc.save(`${name}.pdf`);
}

/** Lit un fichier CSV/Excel en lignes { entête: valeur } */
export async function readSheet(file: File): Promise<Record<string, string>[]> {
  if (file.size > 5 * 1024 * 1024) throw new Error("Fichier trop volumineux (5 Mo max)");
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "", raw: false });
}

export const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
