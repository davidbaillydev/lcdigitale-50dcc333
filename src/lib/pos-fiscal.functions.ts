import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sha256, verifyChain, ZERO_HASH, type ChainEntry } from "./pos-integrity";
import type { LegalInfo } from "./legal";

type Snapshot = {
  version: string; capturedAt: string;
  restaurant: { id: string; name: string; slug: string; address: string | null; legal: LegalInfo | null };
  head: { starts_at: string; legacy_last_number: number; receipt_number: number; receipt_hash: string; event_number: number; event_hash: string } | null;
  receipts: ChainEntry[]; jet: (ChainEntry & { id: string; event_type: string; actor_id: string | null; created_at: string })[];
  sessions: unknown[]; cashEvents: unknown[]; legacyReceipts: unknown[];
};
const input = z.object({ restaurantId: z.string().uuid() });
async function check(snapshot: Snapshot): Promise<boolean> {
  const h = snapshot.head;
  if (!h) return snapshot.receipts.length === 0 && snapshot.jet.length === 0;
  const lastReceipt = snapshot.receipts.at(-1), lastEvent = snapshot.jet.at(-1);
  return await verifyChain(snapshot.receipts, h.legacy_last_number) && await verifyChain(snapshot.jet)
    && (lastReceipt?.sequence ?? h.legacy_last_number) === h.receipt_number
    && (lastReceipt?.hash ?? ZERO_HASH) === h.receipt_hash
    && (lastEvent?.sequence ?? 0) === h.event_number && (lastEvent?.hash ?? ZERO_HASH) === h.event_hash;
}
export const getPosFiscalOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: agency, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !agency) throw new Error("Réservé à l’agence.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: raw, error } = await supabaseAdmin.rpc("pos_integrity_snapshot", { _restaurant: data.restaurantId });
    if (error || !raw) throw new Error("Journal fiscal indisponible.");
    const snapshot = raw as unknown as Snapshot;
    if (!snapshot.restaurant) throw new Error("Restaurant introuvable.");
    const valid = await check(snapshot);
    if (!valid) {
      const { error: auditError } = await supabaseAdmin.rpc("pos_append_jet", { _restaurant: data.restaurantId, _type: "integrity_error", _actor: context.userId, _details: { operation: "verification", capturedAt: snapshot.capturedAt } });
      if (auditError) throw new Error("Anomalie d’intégrité ; journalisation indisponible.");
    }
    const { data: archives, error: archivesError } = await context.supabase.from("pos_fiscal_archives").select("id, created_at, hash").eq("restaurant_id", data.restaurantId).order("created_at", { ascending: false }).limit(20);
    if (archivesError) throw new Error("Historique des archives indisponible.");
    return { restaurant: snapshot.restaurant, head: snapshot.head, valid, receiptCount: snapshot.receipts.length, legacyCount: snapshot.legacyReceipts.length, eventCount: snapshot.jet.length,
      jet: snapshot.jet.slice(-100).reverse().map(({ id, event_type, actor_id, created_at, hash }) => ({ id, event_type, actor_id, created_at, hash })), archives: archives ?? [] };
  });
export const createPosFiscalArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: agency, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !agency) throw new Error("Réservé à l’agence.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: raw, error } = await supabaseAdmin.rpc("pos_integrity_snapshot", { _restaurant: data.restaurantId });
    if (error || !raw) throw new Error("Archive indisponible.");
    const snapshot = raw as unknown as Snapshot;
    if (!snapshot.restaurant) throw new Error("Restaurant introuvable.");
    if (!await check(snapshot)) {
      const { error: auditError } = await supabaseAdmin.rpc("pos_append_jet", { _restaurant: data.restaurantId, _type: "integrity_error", _actor: context.userId, _details: { operation: "archive_blocked", capturedAt: snapshot.capturedAt } });
      throw new Error(auditError ? "Anomalie d’intégrité ; journalisation indisponible." : "Archive bloquée : anomalie d’intégrité détectée.");
    }
    const content = JSON.stringify({ notice: "Archive technique SHA-256 — conformité fiscale non établie. Ne vaut ni certification ni attestation éditeur. Historique antérieur non rétroactivement chaîné.", documentation: "Données JSON UTF-8. SHA-256 de chaque chaîne : previous_hash + saut de ligne LF + payload_text exact. Ne pas reformater payload_text. Numérotation par restaurant ; début des tickets après legacy_last_number, empreinte initiale de 64 zéros ; JET commence à 1. L’empreinte globale SHA-256 porte sur tous les octets UTF-8 de ce fichier, sans BOM ni saut de ligne ajouté. Annulations conservées dans les événements et rapports Z. Snapshot atomique : opérations postérieures à capturedAt exclues. Aucun horodatage de confiance ni stockage WORM externe fourni. Conserver données et justificatifs au moins 6 ans selon LPF L102 B ; ne pas purger à partir de cet export.", ...snapshot });
    const hash = await sha256(content);
    const { data: saved, error: saveError } = await supabaseAdmin.from("pos_fiscal_archives").insert({ restaurant_id: data.restaurantId, created_by: context.userId, content_text: content, hash }).select("id, created_at").single();
    if (saveError || !saved) throw new Error("Conservation de l’archive impossible : téléchargement annulé.");
    return { id: saved.id, createdAt: saved.created_at, content, hash, filename: `archive-caisse-${snapshot.restaurant.slug}-${saved.id}.json` };
  });
export const downloadPosFiscalArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((d: unknown) => input.extend({ archiveId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: agency, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !agency) throw new Error("Réservé à l’agence.");
    const { data: row, error } = await context.supabase.from("pos_fiscal_archives").select("id, content_text, hash").eq("id", data.archiveId).eq("restaurant_id", data.restaurantId).single();
    if (error || !row || await sha256(row.content_text) !== row.hash) throw new Error("Archive absente ou empreinte incorrecte.");
    return { content: row.content_text, hash: row.hash, filename: `archive-caisse-${row.id}.json` };
  });