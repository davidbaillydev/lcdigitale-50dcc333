// Mode hors-ligne de l'écran cuisine : instantané local des commandes du jour + file d'attente
// (outbox) des changements de statut faits pendant une coupure. Fonctions pures, stockage injecté.
export type KvStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type StatusChange = { orderId: string; status: string; slot?: string | undefined; courier_status?: "en_route" | "delivered" | undefined; courier_at?: string | undefined; at: string };
export type KitchenSnapshot<O, L> = { day: string; savedAt: string; orders: O[]; logs: Record<string, L[]> };

const snapKey = (rid: string) => `kitchen-offline:snapshot:${rid}`;
const outboxKey = (rid: string) => `kitchen-offline:outbox:${rid}`;
/** Jour local (YYYY-MM-DD) : un instantané d'hier n'est jamais réaffiché. */
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function read<T>(s: KvStorage, key: string): T | null {
  try { const v = s.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
function write(s: KvStorage, key: string, value: unknown) {
  try { s.setItem(key, JSON.stringify(value)); } catch { /* quota plein : on garde l'état en mémoire */ }
}

export function saveSnapshot<O, L>(s: KvStorage, rid: string, orders: O[], logs: Record<string, L[]>, now = new Date()) {
  write(s, snapKey(rid), { day: localDay(now), savedAt: now.toISOString(), orders, logs } satisfies KitchenSnapshot<O, L>);
}
export function loadSnapshot<O, L>(s: KvStorage, rid: string, now = new Date()): KitchenSnapshot<O, L> | null {
  const snap = read<KitchenSnapshot<O, L>>(s, snapKey(rid));
  if (!snap || snap.day !== localDay(now) || !Array.isArray(snap.orders)) return null;
  return snap;
}

export const readOutbox = (s: KvStorage, rid: string) => read<StatusChange[]>(s, outboxKey(rid)) ?? [];
/** Ajoute un changement ; seul le dernier statut d'une commande est conservé. */
export function enqueueChange(s: KvStorage, rid: string, change: StatusChange) {
  const list = readOutbox(s, rid).filter((c) => c.orderId !== change.orderId);
  list.push(change);
  write(s, outboxKey(rid), list);
  return list;
}
/** Réapplique les changements en attente sur une liste (instantané ou rechargement serveur). */
export function applyOutbox<O extends { id: string; status: string; slot: string }>(orders: O[], outbox: StatusChange[]): O[] {
  if (!outbox.length) return orders;
  return orders.map((o) => {
    const c = outbox.find((x) => x.orderId === o.id);
    return c ? { ...o, status: c.status, ...(c.slot ? { slot: c.slot } : {}), ...(c.courier_status ? { courier_status: c.courier_status, courier_at: c.courier_at } : {}) } : o;
  });
}

export type SendResult = "ok" | "network" | "rejected";
/** Envoie la file dans l'ordre ; s'arrête à la première erreur réseau, abandonne les changements refusés. */
export async function flushOutbox(s: KvStorage, rid: string, send: (c: StatusChange) => Promise<SendResult>) {
  const list = readOutbox(s, rid);
  let sent = 0, rejected = 0, i = 0;
  for (; i < list.length; i++) {
    const change = list[i];
    if (!change) continue;
    const r = await send(change).catch((): SendResult => "network");
    if (r === "network") break;
    if (r === "ok") sent++; else rejected++;
  }
  const rest = list.slice(i);
  if (rest.length) write(s, outboxKey(rid), rest); else s.removeItem(outboxKey(rid));
  return { sent, rejected, remaining: rest.length };
}

/** Erreur de transport (pas de réseau) plutôt qu'un refus du serveur. */
export const isNetworkError = (e: { message?: string } | null | undefined) =>
  !!e && /fetch|network|load failed|timeout|offline/i.test(e.message ?? "");
