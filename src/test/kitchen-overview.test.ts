import { describe, expect, it } from "vitest";
import { activeBreakdown, countActive, startOfTodayIso } from "@/lib/kitchen-overview";

describe("kitchen overview", () => {
  it("compte les commandes ouvertes en cuisine", () => {
    expect(countActive([{ status: "new" }, { status: "accepted" }, { status: "ready" }, { status: "pending_approval" }])).toBe(4);
  });

  it("ignore les commandes terminées, livrées ou en attente de paiement", () => {
    expect(countActive([{ status: "done" }, { status: "delivered" }, { status: "cancelled" }, { status: "awaiting_payment" }])).toBe(0);
  });

  it("exclut les commandes de test", () => {
    expect(countActive([{ status: "new", is_test: true }, { status: "new" }])).toBe(1);
  });

  it("répartit par colonne cuisine", () => {
    const b = activeBreakdown([
      { status: "new" },
      { status: "pending_approval" },
      { status: "accepted" },
      { status: "ready" },
      { status: "ready" },
      { status: "done" },
      { status: "new", is_test: true },
    ]);
    expect(b).toEqual({ fresh: 2, cooking: 1, ready: 2 });
  });

  it("borne le service du jour à minuit local (00h00, secondes et ms nulles)", () => {
    const iso = startOfTodayIso(new Date(2026, 10, 3, 14, 57, 33, 512));
    const d = new Date(iso);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
    expect(d.getDate()).toBe(3);
  });
});
