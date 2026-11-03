import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { activeBreakdown, shouldAutoClose, startOfTodayIso, todaysOrders } from "@/lib/kitchen-overview";

const at = (s: string) => new Date(s);

describe("compteurs au changement de jour", () => {
  const orders = [
    { status: "ready", created_at: at("2026-11-02T23:50:00").toISOString() },
    { status: "new", created_at: at("2026-11-03T00:05:00").toISOString() },
  ];
  it("avant minuit, la commande de 23h50 est comptée", () => {
    expect(activeBreakdown(todaysOrders(orders.slice(0, 1), at("2026-11-02T23:59:00")))).toEqual({ fresh: 0, cooking: 0, ready: 1 });
  });
  it("après minuit, seule la commande du nouveau jour reste", () => {
    expect(activeBreakdown(todaysOrders(orders, at("2026-11-03T00:10:00")))).toEqual({ fresh: 1, cooking: 0, ready: 0 });
  });
  it("une commande d'octobre restée ouverte n'est jamais comptée", () => {
    expect(todaysOrders([{ status: "ready", created_at: "2026-10-13T12:00:00Z" }], at("2026-11-03T12:00:00"))).toHaveLength(0);
  });
});

describe("clôture après 24 heures", () => {
  const now = at("2026-11-03T12:00:00Z");
  it("clôture une commande prête ou acceptée de plus de 24 h", () => {
    expect(shouldAutoClose({ status: "ready", created_at: "2026-11-02T11:59:00Z" }, now)).toBe(true);
    expect(shouldAutoClose({ status: "accepted", created_at: "2026-10-31T10:00:00Z" }, now)).toBe(true);
  });
  it("ne clôture pas avant 24 h", () => {
    expect(shouldAutoClose({ status: "ready", created_at: "2026-11-02T12:01:00Z" }, now)).toBe(false);
  });
  it("ne touche ni aux nouvelles, ni aux attentes de paiement, ni aux terminées", () => {
    for (const status of ["new", "awaiting_payment", "done", "cancelled"])
      expect(shouldAutoClose({ status, created_at: "2026-10-01T00:00:00Z" }, now)).toBe(false);
  });
});

describe("synchronisation avec l'écran cuisine", () => {
  it("l'écran cuisine et la vue d'ensemble utilisent la même borne de minuit", () => {
    const kitchen = readFileSync("src/routes/_authenticated/espace.$slug.index.tsx", "utf8");
    const overview = readFileSync("src/components/KitchenOverview.tsx", "utf8");
    expect(kitchen).toMatch(/gte\("created_at", startOfTodayIso\(\)\)/);
    expect(overview).toMatch(/gte\("created_at", startOfTodayIso\(\)\)/);
  });
  it("la vue d'ensemble se rafraîchit toutes les 60 s et au retour sur l'onglet", () => {
    const overview = readFileSync("src/components/KitchenOverview.tsx", "utf8");
    expect(overview).toContain("60_000");
    expect(overview).toContain("visibilitychange");
  });
  it("minuit local a heures, minutes, secondes à zéro", () => {
    const d = new Date(startOfTodayIso(at("2026-11-03T15:42:10")));
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
  });
});
