import { describe, expect, it } from "vitest";
import { ticketEscpos } from "@/lib/escpos";
import { ticketHtml, type TicketOrder } from "@/lib/ticket";

const order: TicketOrder = {
  order_number: 12,
  mode: "pickup",
  slot: "2026-10-21T12:30:00.000Z",
  items: [{
    name: "Wok poulet",
    qty: 1,
    total: 14.8,
    category: "Woks signatures",
    details: ["Base : Nouilles classiques"],
    selected_options: [{ name: "Sauce coco", price: 2 }],
  }],
  notes: "L'œuf à côté, très pressé",
  total: 14.8,
  payment_method: "online",
  payment_status: "paid",
};

describe("ticket formatting", () => {
  it("shows category, included choices and priced supplements in the preview", () => {
    const html = ticketHtml(order, "kitchen", 80, "Wok & Sushi");
    expect(html).toContain("WOKS SIGNATURES");
    expect(html).toContain("Choix inclus :");
    expect(html).toContain("Supplément : + Sauce coco");
    expect(html).toContain("+2,00 €");
    expect(html).toContain("REMARQUE CLIENT");
  });

  it("keeps accents and normalizes apostrophes for thermal printers", () => {
    const bytes = ticketEscpos(order, "kitchen", 80, { name: "Wok & Sushi" });
    const text = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
    expect(text).toContain("[ WOKS SIGNATURES ]");
    expect(text).toContain("Choix inclus");
    expect(text).toContain("Supplement : + Sauce coco");
    expect(text).toContain("! REMARQUE CLIENT : L'oeuf");
    expect(text).toContain("=".repeat(48));
  });
});
