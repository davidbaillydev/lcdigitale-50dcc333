import { describe, expect, it } from "vitest";
import { sampleOrder, ticketOptions, ticketHtml } from "@/lib/ticket";
import { ticketEscpos } from "@/lib/escpos";

describe("currency snapshots on tickets", () => {
  it("retains historical EUR despite current CFA shop settings", () => {
    expect(ticketHtml(sampleOrder(), "receipt", 80, { name: "Test", currency: "XOF" })).toContain("30,30 €");
  });
  it("uses the frozen XOF total for HTML and thermal tickets", () => {
    const order = { ...sampleOrder(), currency: "XOF" as const, total: 2500 };
    expect(ticketHtml(order, "receipt", 80, { name: "Test" })).toContain("2 500 FCFA");
    expect(new TextDecoder().decode(ticketEscpos(order, "receipt", 80, { name: "Test" }))).toContain("2 500 FCFA");
  });
  it("formats option surcharges in CFA", () => {
    expect(ticketOptions({ name: "Test", qty: 1, selected_options: [{ name: "Sauce", price: 500 }] }, { name: "Test", currency: "XAF" })).toEqual(["+ Sauce (+500 FCFA)"]);
  });
});