import { describe, expect, it } from "vitest";
import { aggregateGains, gainsByDay, paymentDetails, type GainOrderRow } from "@/lib/agency-gains";

const row = (over: Partial<GainOrderRow>): GainOrderRow => ({
  restaurant_id: "r1",
  service_fee: 0.5,
  total: 20,
  status: "done",
  created_at: "2026-10-20T12:00:00.000Z",
  ...over,
});

describe("aggregateGains", () => {
  it("exclut les paiements CB Test des gains et du graphique", () => {
    const rows = [row({}), row({ is_test: true, total: 999, service_fee: 50 })];
    expect(aggregateGains(rows)).toMatchObject({ orders: 1, revenue: 20, serviceFees: 0.5 });
    expect(gainsByDay(rows)).toEqual([{ day: "2026-10-20", serviceFees: 0.5 }]);
  });
  it("exclut les commandes annulées et en attente de paiement", () => {
    const g = aggregateGains([
      row({}),
      row({ status: "cancelled", service_fee: 0.5, total: 20 }),
      row({ status: "awaiting_payment", service_fee: 0.5, total: 20 }),
    ]);
    expect(g.orders).toBe(1);
    expect(g.serviceFees).toBe(0.5);
    expect(g.revenue).toBe(20);
  });

  it("agrège par restaurant et trie par frais décroissants", () => {
    const g = aggregateGains([
      row({ restaurant_id: "r1", service_fee: 0.5 }),
      row({ restaurant_id: "r2", service_fee: 1.2, total: 30 }),
      row({ restaurant_id: "r2", service_fee: 0.8, total: 10 }),
    ]);
    expect(g.perRestaurant.map((r) => r.restaurantId)).toEqual(["r2", "r1"]);
    expect(g.perRestaurant[0]).toMatchObject({ orders: 2, serviceFees: 2, revenue: 40 });
    expect(g.serviceFees).toBe(2.5);
  });

  it("tolère les frais nuls ou absents", () => {
    const g = aggregateGains([row({ service_fee: null }), row({ service_fee: 0 })]);
    expect(g.serviceFees).toBe(0);
    expect(g.orders).toBe(2);
  });
});

describe("gainsByDay", () => {
  it("regroupe par jour et trie chronologiquement", () => {
    const days = gainsByDay([
      row({ created_at: "2026-10-21T10:00:00.000Z", service_fee: 0.5 }),
      row({ created_at: "2026-10-20T09:00:00.000Z", service_fee: 1 }),
      row({ created_at: "2026-10-21T18:00:00.000Z", service_fee: 0.5 }),
      row({ created_at: "2026-10-21T19:00:00.000Z", service_fee: 9, status: "cancelled" }),
    ]);
    expect(days).toEqual([
      { day: "2026-10-20", serviceFees: 1 },
      { day: "2026-10-21", serviceFees: 1 },
    ]);
  });
});

describe("paymentDetails", () => {
  it("sépare les frais client de la commission Mollie sauvegardée", () => {
    expect(paymentDetails([row({ total: 40, service_fee: 1, platform_fee: 2.8, payment_status: "paid", payment_ref: "mollie:abc" })])).toMatchObject({ paid: 40, paidServiceFees: 1, platformFees: 2.8, restaurantBalanceEstimate: 37.2 });
  });
  it("ne considère pas une commande validée mais non réglée comme encaissée", () => {
    expect(paymentDetails([row({ payment_status: "pending", platform_fee: 1.4 })])).toMatchObject({ paid: 0, unpaid: 20, platformFees: 0, paidServiceFees: 0 });
  });
  it("déduit les remboursements enregistrés du solde estimé", () => {
    expect(paymentDetails([row({ total: 40, payment_status: "partially_refunded", payment_ref: "mollie:abc", platform_fee: 2.8, refunded_amount: 10 })])).toMatchObject({ paid: 40, refunds: 10, restaurantBalanceEstimate: 27.2 });
  });
  it("n'attribue pas au TPE une commission Mollie Connect", () => {
    expect(paymentDetails([row({ payment_status: "paid", payment_ref: "mollie_term:abc", platform_fee: 1.4 })]).platformFees).toBe(0);
  });
  it("exclut tests, annulations et attente de paiement de tous les détails", () => {
    expect(paymentDetails([row({ is_test: true }), row({ status: "cancelled" }), row({ status: "awaiting_payment" })])).toMatchObject({ orders: 0, paid: 0, unpaid: 0, serviceFees: 0 });
  });
  it("identifie la borne par sa source sans modifier le mode sauvegardé", () => {
    expect(paymentDetails([row({ source: "kiosk", mode: "pickup" })]).channels).toEqual([{ channel: "kiosk", orders: 1, total: 20 }]);
  });
});
