import { describe, expect, it } from "vitest";
import { applyOutbox, enqueueChange, flushOutbox, isNetworkError, loadSnapshot, readOutbox, saveSnapshot, type KvStorage } from "@/lib/kitchen-offline";

const mem = (): KvStorage => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }; };
const o = (id: string, status = "new") => ({ id, status, slot: "2026-10-29T12:00:00.000Z" });

describe("kitchen offline", () => {
  it("persiste le départ et la remise hors-ligne puis synchronise les deux statuts ensemble", async () => {
    const s = mem();
    enqueueChange(s, "r1", { orderId: "a", status: "ready", courier_status: "en_route", courier_at: "1", at: "1" });
    expect(applyOutbox([o("a", "ready")], readOutbox(s, "r1"))[0]).toMatchObject({ status: "ready", courier_status: "en_route" });
    enqueueChange(s, "r1", { orderId: "a", status: "done", courier_status: "delivered", courier_at: "2", at: "2" });
    expect(applyOutbox([o("a", "ready")], readOutbox(s, "r1"))[0]).toMatchObject({ status: "done", courier_status: "delivered" });
    const sent: unknown[] = [];
    await flushOutbox(s, "r1", async (c) => { sent.push(c); return "ok"; });
    expect(sent).toEqual([{ orderId: "a", status: "done", courier_status: "delivered", courier_at: "2", at: "2" }]);
    expect(readOutbox(s, "r1")).toEqual([]);
  });
  it("restaure les commandes et logs du jour après rechargement", () => {
    const s = mem(); const now = new Date(2026, 9, 29, 12);
    saveSnapshot(s, "r1", [o("a")], { a: [{ id: "l1" }] }, now);
    const snap = loadSnapshot<ReturnType<typeof o>, { id: string }>(s, "r1", new Date(2026, 9, 29, 20));
    expect(snap?.orders.map((x) => x.id)).toEqual(["a"]);
    expect(snap?.logs["a"]).toHaveLength(1);
  });
  it("ignore l'instantané d'un autre jour ou restaurant", () => {
    const s = mem(); saveSnapshot(s, "r1", [o("a")], {}, new Date(2026, 9, 28, 23));
    expect(loadSnapshot(s, "r1", new Date(2026, 9, 29, 9))).toBeNull();
    expect(loadSnapshot(s, "r2", new Date(2026, 9, 28, 23))).toBeNull();
  });
  it("garde seulement le dernier statut par commande et le réapplique", () => {
    const s = mem();
    enqueueChange(s, "r1", { orderId: "a", status: "accepted", at: "1" });
    enqueueChange(s, "r1", { orderId: "a", status: "ready", at: "2" });
    expect(readOutbox(s, "r1")).toHaveLength(1);
    expect(applyOutbox([o("a"), o("b")], readOutbox(s, "r1")).map((x) => x.status)).toEqual(["ready", "new"]);
  });
  it("synchronise la file et la vide quand le réseau revient", async () => {
    const s = mem();
    enqueueChange(s, "r1", { orderId: "a", status: "accepted", at: "1" });
    enqueueChange(s, "r1", { orderId: "b", status: "ready", at: "2" });
    const sent: string[] = [];
    const r = await flushOutbox(s, "r1", async (c) => { sent.push(c.orderId); return "ok"; });
    expect(r).toEqual({ sent: 2, rejected: 0, remaining: 0 });
    expect(sent).toEqual(["a", "b"]);
    expect(readOutbox(s, "r1")).toEqual([]);
  });
  it("conserve les changements non envoyés si le réseau retombe", async () => {
    const s = mem();
    enqueueChange(s, "r1", { orderId: "a", status: "accepted", at: "1" });
    enqueueChange(s, "r1", { orderId: "b", status: "ready", at: "2" });
    const r = await flushOutbox(s, "r1", async (c) => (c.orderId === "a" ? "ok" : "network"));
    expect(r.remaining).toBe(1);
    expect(readOutbox(s, "r1").map((c) => c.orderId)).toEqual(["b"]);
  });
  it("abandonne un changement refusé par le serveur", async () => {
    const s = mem();
    enqueueChange(s, "r1", { orderId: "a", status: "accepted", at: "1" });
    expect(await flushOutbox(s, "r1", async () => "rejected")).toEqual({ sent: 0, rejected: 1, remaining: 0 });
  });
  it("distingue panne réseau et refus", () => {
    expect(isNetworkError({ message: "TypeError: Failed to fetch" })).toBe(true);
    expect(isNetworkError({ message: "permission denied" })).toBe(false);
  });
});
