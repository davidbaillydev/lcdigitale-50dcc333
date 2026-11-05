import { z } from "zod";

export const waveSizeSchema = z.number().int().min(100).max(300).default(100);

export function selectWave<T extends { id: string; email: string; name: string | null }>(
  ids: string[], rows: T[], size: number, sentEmails: string[] = [],
) {
  const limit = waveSizeSchema.parse(size);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const seen = new Set(sentEmails.map((e) => e.trim().toLowerCase()));
  const eligible: T[] = [];
  for (const id of [...new Set(ids)]) {
    const row = byId.get(id);
    if (!row) continue;
    const email = row.email.trim().toLowerCase();
    if (!z.string().email().safeParse(email).success || seen.has(email)) continue;
    seen.add(email);
    eligible.push({ ...row, email });
  }
  return { recipients: eligible.slice(0, limit), remainingIds: eligible.slice(limit).map((r) => r.id) };
}