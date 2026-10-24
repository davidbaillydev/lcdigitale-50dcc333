import { describe, expect, it } from "vitest";
import { ticketEscpos } from "@/lib/escpos";
import { isPaid, isPreorder, printingDefaults, ticketFields, ticketHtml, ticketOptions, ticketTotals, type TicketOrder } from "@/lib/ticket";

const order: TicketOrder = {
  order_number: 12,
  customer_name: "Client test",
  phone: "06 00 00 00 00",
  email: "client@example.test",
  mode: "pickup",
  slot: "2026-10-21T12:30:00.000Z",
  items: [{
    name: "Wok poulet",
    qty: 1,
    total: 14.8,
    category: "Woks signatures",
    details: ["Base : Nouilles classiques"],
    selected_options: [{ name: "Cordon bleu", price: 1.5 }, { name: "Sauces : Ketchup", price: 0 }],
    allergens: ["oeufs", "soja"],
  }],
  notes: "L'œuf à côté, très pressé",
  total: 14.8,
  payment_method: "online",
  payment_status: "paid",
};

describe("ticket formatting", () => {
  it("formats choices directly and adds the price only for paid options", () => {
    expect(ticketOptions(order.items[0])).toEqual(["Base : Nouilles classiques", "+ Cordon bleu (+1,50 €)", "Sauces : Ketchup"]);
  });

  it("hides allergens unless explicitly requested on both ticket kinds", () => {
    expect(printingDefaults().kitchen.allergens).toBe(false);
    for (const kind of ["kitchen", "receipt"] as const) {
      expect(ticketFields(kind).allergens).toBe(false);
      expect(ticketFields(kind, { allergens: true }).allergens).toBe(true);
      expect(ticketFields(kind, { allergens: false }).allergens).toBe(false);
    }
  });

  it("preserves kitchen visibility settings and receipt totals", () => {
    expect(ticketFields("kitchen", { prices: false, customer: false, options: false })).toMatchObject({ prices: false, customer: false, options: false });
    expect(ticketFields("receipt", { prices: false })).toMatchObject({ prices: true, paid: true });
  });

  it("reconstructs the subtotal before discounts and fees, with VAT included at 10 percent", () => {
    expect(ticketTotals({ ...order, total: 22, delivery_fee: 3, service_fee: 2, discount: 5 })).toEqual({ subtotal: 22, vat: 2, total: 22 });
    expect(ticketTotals({ ...order, total: "11.00" })).toEqual({ subtotal: 11, vat: 1, total: 11 });
  });

  it("keeps unpaid receipts non-fiscal even when payment was initiated online", () => {
    const unpaid = { ...order, payment_status: "pending" };
    expect(isPaid(unpaid)).toBe(false);
    expect(isPreorder("receipt", unpaid)).toBe(true);
    expect(isPreorder("kitchen", unpaid)).toBe(false);
    expect(isPaid(order)).toBe(true);
  });

  for (const width of [58, 80] as const) {
    for (const kind of ["kitchen", "receipt"] as const) {
      it(`renders coherent options, client data and encoding for ${kind} at ${width}mm`, () => {
        const shop = { name: "Wok & Sushi", address: "Adresse test" };
        const fields = { prices: true };
        const html = ticketHtml(order, kind, width, shop, fields);
        const bytes = ticketEscpos(order, kind, width, shop, fields);
        const text = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
        // Regression coverage of the requested output contract, not a visual snapshot.
        for (const option of ticketOptions(order.items[0])) {
          expect(html).toContain(option);
          expect(text).toContain(option.replace("€", String.fromCharCode(0xd5)));
        }
        expect(html).not.toMatch(/Choix inclus|Supplément|ALLERGÈNES/);
        expect(text).not.toMatch(/Choix inclus|Supplement|ALLERGENES/);
        expect(html).toContain(order.email);
        expect(text).toContain(order.email);
        expect(text).toContain("! REMARQUE CLIENT : L'oeuf");
        expect(text).toContain(String.fromCharCode(0x85)); // à in CP858
        expect(text).toContain("=".repeat(width === 80 ? 48 : 32));
        expect(html.indexOf(shop.name)).toBeGreaterThan(html.indexOf("TOTAL"));
        expect(text.indexOf(shop.address)).toBeGreaterThan(text.indexOf("TOTAL"));
        expect(html).toContain("14,80 €");
      });
    }
  }

  it("escapes customer and option data in the HTML ticket", () => {
    const html = ticketHtml({ ...order, email: '<img src=x onerror="alert(1)">', items: [{ name: "<script>", qty: 1, details: ["<b>choix</b>"] }] }, "receipt", 58, "Restaurant");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;b&gt;choix&lt;/b&gt;");
  });
});
