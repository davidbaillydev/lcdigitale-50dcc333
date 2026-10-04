/** Normalisation et déduplication des fiches clients (partagé import / commandes). */
export const normEmail = (s: unknown) => {
  const v = String(s ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
};
export const normPhone = (s: unknown) => {
  let v = String(s ?? "").replace(/[^\d+]/g, "");
  if (v.startsWith("0033")) v = "+33" + v.slice(4);
  if (v.startsWith("+33")) v = "0" + v.slice(3);
  if (/^[1-9]\d{8}$/.test(v)) v = "0" + v;
  return v.replace(/\D/g, "").length >= 8 ? v : null;
};
const YES = /^(1|oui|yes|y|o|true|vrai|x|ok|opt-?in)$/i;

const pick = (row: Record<string, string>, re: RegExp) => {
  const k = Object.keys(row).find((h) => re.test(h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()));
  return k ? row[k] : "";
};

export type ImportRow = { name: string | null; email: string | null; phone: string | null; consent: boolean };

export function parseImport(rows: Record<string, string>[]) {
  const out: ImportRow[] = [];
  let invalid = 0, dupInFile = 0;
  const seen = new Set<string>();
  for (const r of rows) {
    const first = pick(r, /^(prenom|first)/), last = pick(r, /^(nom de famille|last|surname)/);
    const name = (pick(r, /^(nom|name|client|full ?name)$/) || [first, last].filter(Boolean).join(" ")).trim() || null;
    const email = normEmail(pick(r, /mail/));
    const phone = normPhone(pick(r, /(tel|phone|mobile|portable)/));
    if (!email && !phone) { invalid++; continue; }
    const keys = [email && `e:${email}`, phone && `p:${phone}`].filter(Boolean) as string[];
    if (keys.some((k) => seen.has(k))) { dupInFile++; continue; }
    keys.forEach((k) => seen.add(k));
    out.push({ name, email, phone, consent: YES.test(String(pick(r, /(consent|optin|opt-in|rgpd|newsletter|marketing)/)).trim()) });
  }
  return { rows: out, invalid, dupInFile };
}
