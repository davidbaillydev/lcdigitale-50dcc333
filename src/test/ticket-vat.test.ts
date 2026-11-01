import { describe, expect, it } from "vitest";
import { defaultVatRate, ticketLegalLines, vatBreakdown } from "@/lib/ticket-vat";
import { ticketHtml, ticketTotals, type TicketOrder } from "@/lib/ticket";
import { ticketEscpos } from "@/lib/escpos";

const base: TicketOrder = { order_number: 1, mode: "delivery", slot: "2026-01-01T12:00:00Z", payment_method: "online", payment_status: "paid", total: 0, items: [] };

describe("ventilation TVA par taux", () => {
  it("sans taux renseigné, tout est au taux par défaut 10 %", () => {
    expect(vatBreakdown({ items: [{ total: 11 }], total: 11 })).toEqual([{ rate: 10, ht: 10, vat: 1, ttc: 11 }]);
  });
  it("chaque plat garde son taux (5,5 / 10 / 20 %)", () => {
    const rows = vatBreakdown({ items: [{ total: 10.55, vatRate: 5.5 }, { total: 11, vatRate: 10 }, { total: 12, vatRate: 20 }], total: 33.55 });
    expect(rows).toEqual([
      { rate: 5.5, ht: 10, vat: 0.55, ttc: 10.55 },
      { rate: 10, ht: 10, vat: 1, ttc: 11 },
      { rate: 20, ht: 10, vat: 2, ttc: 12 },
    ]);
  });
  it("frais de livraison et de service au taux par défaut de l'établissement", () => {
    const rows = vatBreakdown({ items: [{ total: 12, vatRate: 20 }], delivery_fee: 3, service_fee: 2.5, total: 17.5 }, { defaultRate: "5,5" });
    expect(rows.find((r) => r.rate === 5.5)?.ttc).toBe(5.5);
    expect(rows.find((r) => r.rate === 20)?.ttc).toBe(12);
  });
  it("la remise est répartie au prorata des taux des plats", () => {
    const rows = vatBreakdown({ items: [{ total: 20, vatRate: 10 }, { total: 20, vatRate: 20 }], discount: 10, total: 30 });
    expect(rows.map((r) => r.ttc)).toEqual([15, 15]);
  });
  it("taux du plat retrouvé dans la carte si absent de la commande", () => {
    expect(vatBreakdown({ items: [{ id: "biere", total: 6 }], total: 6 }, { itemRates: { biere: 20 } })[0]).toMatchObject({ rate: 20, vat: 1 });
  });
  it("la somme TTC égale toujours le total payé", () => {
    const rows = vatBreakdown({ items: [{ total: 3.33, vatRate: 5.5 }, { total: 3.33, vatRate: 20 }, { total: 3.34 }], discount: 1, total: 9 });
    expect(Math.round(rows.reduce((s, r) => s + r.ttc, 0) * 100) / 100).toBe(9);
  });
  it("taux par défaut invalide → 10 %", () => {
    expect(defaultVatRate(undefined)).toBe(10);
    expect(defaultVatRate("abc")).toBe(10);
    expect(defaultVatRate("20")).toBe(20);
  });
});

describe("tickets client", () => {
  const order: TicketOrder = { ...base, total: 23, delivery_fee: 0, items: [{ name: "Wok", qty: 1, total: 11, vatRate: 10 }, { name: "Bière", qty: 1, total: 12, vatRate: 20 }] };
  const shop = { name: "Wok", legal: { company: "SARL Test", siret: "123 456 789 00012", vat: "FR12123456789" } };
  it("HTML affiche une ligne par taux, le tableau et les mentions légales", () => {
    const html = ticketHtml(order, "receipt", 80, shop);
    for (const s of ["TVA (10 % incluse)", "TVA (20 % incluse)", "<th>HT</th>", "SARL Test — Enseigne Wok", "SIRET : 123 456 789 00012", "TVA intracom. : FR12123456789"]) expect(html).toContain(s);
    expect(ticketTotals(order, shop).vat).toBe(3);
  });
  it("le ticket cuisine n'imprime pas les mentions légales", () => {
    expect(ticketHtml(order, "kitchen", 80, shop)).not.toContain("SIRET");
  });
  it("franchise en base : mention affichée, aucune TVA", () => {
    const s = { name: "W", legal: { company: "EI Test", vatExemption: "TVA non applicable, art. 293 B du CGI", vat: "FR1" } };
    const html = ticketHtml(order, "receipt", 80, s);
    expect(html).toContain("TVA non applicable, art. 293 B du CGI");
    expect(html).not.toContain("TVA (");
    expect(ticketTotals(order, s).vat).toBe(0);
    expect(ticketLegalLines(s.legal)).not.toContain("TVA intracom. : FR1");
  });
  it("ESC/POS imprime la ventilation et le SIRET", () => {
    const txt = new TextDecoder("latin1").decode(ticketEscpos(order, "receipt", 80, shop));
    expect(txt).toContain("TVA (20 % incluse)");
    expect(txt).toContain("SIRET : 123 456 789 00012");
  });
});
