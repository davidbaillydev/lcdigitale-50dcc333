import { expect, it } from "vitest";
import { ticketVat, sampleOrder } from "@/lib/ticket";
it("POS VAT uses the immutable sale snapshot, not a changed menu rate", () => {
  const vat = [{ rate: 5.5, ht: 10, vat: 0.55, ttc: 10.55 }];
  const order = { ...sampleOrder(), source: "pos", total: 10.55, items: [{ name: "Article", total: 10.55, qty: 1, vatRate: 20 }], pos_vat: vat };
  expect(ticketVat(order, { name: "Test", vatRate: 20 })).toEqual(vat);
});