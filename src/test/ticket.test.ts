import { describe, expect, it } from "vitest";
import { ticketEscpos } from "@/lib/escpos";
import { cleanOptionLabel, isPaid, isPreorder, payLabel, printingDefaults, ticketCustomer, ticketFields, ticketHtml, ticketOptions, ticketTiming, ticketTotals, ticketWebsite, autoPrintKinds, autoPrintLabel, ticketFontSize, TICKET_FONTS, type TicketOrder } from "@/lib/ticket";

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
    const item = order.items[0];
    if (!item) throw new Error("Missing fixture item");
    expect(ticketOptions(item)).toEqual(["Base: Nouilles classiques", "Sauces: Ketchup", "+ Cordon bleu (+1,50 €)"]);
  });

  it("matches the validated TACOS layout: grouped choices, paid choice first, extras last", () => {
    expect(ticketOptions({
      name: "TACOS Maxi XL", qty: 1, total: 11.5,
      details: ["Boisson : Coca-Cola", "Sauce fromagère : Oui", "Sauces : Biggy", "Sauces : Algerienne", "2 Viandes : Kebab", "2 Viandes : Tenders"],
      selected_options: [{ name: "Choix : Frites + Boisson", price: 2 }, { name: "Cordon bleu", price: 1.5 }],
    })).toEqual([
      "Choix: Frites + Boisson (+2,00 €)", "Boisson: Coca-Cola", "Sauce fromagère: Oui",
      "Sauces: Biggy, Algerienne", "2 Viandes: Kebab, Tenders", "+ Cordon bleu (+1,50 €)",
    ]);
  });

  it("no longer prints the category above items", () => {
    const html = ticketHtml(order, "kitchen", 80, { name: "W" });
    const text = Array.from(ticketEscpos(order, "kitchen", 80, { name: "W" })).map((b) => String.fromCharCode(b)).join("");
    expect(html).not.toContain("WOKS SIGNATURES");
    expect(text).not.toContain("WOKS SIGNATURES");
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
        const item = order.items[0];
        if (!item) throw new Error("Missing fixture item");
        for (const option of ticketOptions(item)) {
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
        expect(html.indexOf("WOK &amp; SUSHI")).toBeGreaterThan(html.indexOf("TOTAL"));
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

  it("uses distinct first and last names, retaining the full name for old orders", () => {
    expect(ticketCustomer({ ...order, first_name: "Prénom test", last_name: "Nom test" }).slice(0, 2)).toEqual([["Prénom:", "Prénom test"], ["Nom:", "Nom test"]]);
    expect(ticketCustomer(order)[0]).toEqual(["Nom:", "Client test"]);
  });

  it("shows ASAP with the actual 15 minute estimate, never a fixed invented delay", () => {
    expect(ticketTiming({ ...order, asap: true, created_at: "2026-10-21T12:15:00.000Z" })).toEqual({ label: "Dès que possible", value: "15 min" });
    expect(ticketTiming({ ...order, asap: false }).label).toBe("Prévu pour");
  });

  it("uses the restaurant domain or its direct ordering URL", () => {
    expect(ticketWebsite({ name: "Restaurant", slug: "woknsushi", customDomains: ["commande.woknsushi.com"] })).toBe("commande.woknsushi.com");
    expect(ticketWebsite({ name: "Restaurant", slug: "woknsushi" })).toBe("restaurant.lcdigitale.fr/woknsushi");
  });

  it("labels an online payment as paid only when confirmed", () => {
    expect(payLabel("online", true)).toBe("Payé en ligne");
    expect(payLabel("online", false)).toBe("Paiement en ligne (en attente)");
    expect(payLabel("card_terminal")).toBe("Carte bancaire (au comptoir)");
  });

  it("uses the stored subtotal when present and matches the model VAT", () => {
    expect(ticketTotals({ ...order, total: 17.5, subtotal: 17.5 })).toEqual({ subtotal: 17.5, total: 17.5, vat: 1.59 });
    expect(ticketTotals({ ...order, total: 17.5, subtotal: 20 })).toMatchObject({ subtotal: 20 });
  });
});

describe("ticket text size and font", () => {
  it("defaults to normal size and modern sans font", () => {
    expect(printingDefaults()).toMatchObject({ textSize: "normal", font: "sans" });
    expect(printingDefaults({ textSize: "large", font: "mono" })).toMatchObject({ textSize: "large", font: "mono" });
  });
  it("scales HTML text: compact < normal < large", () => {
    expect(ticketFontSize(80, "compact")).toBeLessThan(ticketFontSize(80, "normal"));
    expect(ticketFontSize(80, "large")).toBeGreaterThan(ticketFontSize(80, "normal"));
    expect(ticketHtml(order, "kitchen", 80, "W", { textSize: "large" })).toContain(`${ticketFontSize(80, "large")}px`);
  });
  it("applies the chosen font family in HTML", () => {
    expect(ticketHtml(order, "kitchen", 80, "W", { font: "mono" })).toContain(TICKET_FONTS.mono);
    expect(ticketHtml(order, "kitchen", 80, "W", { font: "condensed" })).toContain(TICKET_FONTS.condensed);
  });
  it("enlarges item titles on ESC/POS only in large mode", () => {
    const dbl = [0x1d, 0x21, 0x01].join(",");
    const count = (b: Uint8Array) => Array.from(b).join(",").split(dbl).length;
    expect(count(ticketEscpos(order, "kitchen", 80, { name: "W" }, { textSize: "large" }))).toBeGreaterThan(count(ticketEscpos(order, "kitchen", 80, { name: "W" })));
  });
});

describe("receipt aligned with kitchen format", () => {
  const full = { ...order, delivery_fee: 3, service_fee: 1, discount: 2, promo_code: "BIENVENUE", total: 16.8 };
  const shop = { name: "Wok & Sushi", address: "1 rue Test", phone: "05 00 00 00 00", slug: "woknsushi" };
  it("always shows prices, fees, discount, VAT, total, status, shop block and non-fiscal notice", () => {
    for (const html of [ticketHtml(full, "receipt", 80, shop, { prices: false }), ticketHtml(full, "receipt", 58, shop, { textSize: "compact", font: "mono" })]) {
      for (const s of ["14,80 €", "Livraison", "Frais de service", "Remise BIENVENUE", "TVA (10 % incluse)", "TOTAL", "16,80 €", "Payé", "WOK &amp; SUSHI", "1 rue Test", "05 00 00 00 00", "restaurant.lcdigitale.fr/woknsushi", "non fiscal"]) expect(html).toContain(s);
      expect(html).toContain("+ Cordon bleu (+1,50 €)");
    }
    const text = Array.from(ticketEscpos(full, "receipt", 80, shop, { prices: false })).map((b) => String.fromCharCode(b)).join("");
    for (const s of ["Livraison", "Frais de service", "Remise BIENVENUE", "TOTAL", "non fiscal", "restaurant.lcdigitale.fr/woknsushi", "WOK & SUSHI"]) expect(text).toContain(s);
  });
  it("applies text size and font to the receipt too", () => {
    expect(ticketHtml(order, "receipt", 80, "W", { textSize: "large", font: "condensed" })).toContain(`${ticketFontSize(80, "large")}px`);
    expect(ticketHtml(order, "receipt", 80, "W", { font: "condensed" })).toContain(TICKET_FONTS.condensed);
  });
});

describe("independent auto-print for kitchen and receipt", () => {
  it("keeps legacy auto for both tickets", () => {
    expect(printingDefaults({ auto: true })).toMatchObject({ autoKitchen: true, autoReceipt: true });
    expect(printingDefaults({ auto: false })).toMatchObject({ autoKitchen: false, autoReceipt: false });
  });
  it("prints only the enabled tickets", () => {
    expect(autoPrintKinds(printingDefaults({ autoKitchen: true, autoReceipt: true }))).toEqual(["kitchen", "receipt"]);
    expect(autoPrintKinds(printingDefaults({ autoKitchen: true, autoReceipt: false }))).toEqual(["kitchen"]);
    expect(autoPrintKinds(printingDefaults({ autoKitchen: false, autoReceipt: true }))).toEqual(["receipt"]);
    expect(autoPrintKinds(printingDefaults({ auto: true, autoKitchen: false, autoReceipt: false }))).toEqual([]);
  });
  it("labels the toolbar state", () => {
    expect(autoPrintLabel({ autoKitchen: true, autoReceipt: true })).toBe("auto : cuisine + caisse");
    expect(autoPrintLabel({ autoKitchen: true, autoReceipt: false })).toBe("auto : cuisine seule");
    expect(autoPrintLabel({ autoKitchen: false, autoReceipt: true })).toBe("auto : caisse seule");
    expect(autoPrintLabel({ autoKitchen: false, autoReceipt: false })).toBe("manuel");
  });
});

describe("nettoyage des libellés Supplément", () => {
  it("retire les préfixes Supplément quelle que soit la casse ou l'accent", () => {
    expect(cleanOptionLabel("Supplément : + Kebab")).toBe("Kebab");
    expect(cleanOptionLabel("SUPPLEMENT: Kebab")).toBe("Kebab");
    expect(cleanOptionLabel("supplément :+ Kebab")).toBe("Kebab");
  });
  it("extra payant devient « + Nom (+prix) » et choix inclus reste direct", () => {
    const out = ticketOptions({ name: "Tacos", qty: 1, details: ["Supplément : Sauces: BBQ"], selected_options: [{ name: "Supplément : + Kebab", price: 1.5 }, { name: "Supplement : Viande: Tenders", price: 0 }] });
    expect(out).toEqual(["Sauces: BBQ", "Viande: Tenders", "+ Kebab (+1,50 €)"]);
    expect(out.join(" ")).not.toMatch(/suppl/i);
  });
  it("aucun Supplément dans le HTML ni l'ESC/POS", () => {
    const o: TicketOrder = { order_number: 1, mode: "pickup", slot: new Date().toISOString(), total: 10, payment_method: "on_site", items: [{ name: "Tacos", qty: 1, total: 10, selected_options: [{ name: "Supplément : + Kebab", price: 1.5 }] }] };
    expect(ticketHtml(o, "kitchen", 80, "R")).not.toMatch(/suppl/i);
    expect(new TextDecoder("latin1").decode(ticketEscpos(o, "kitchen", 80, { name: "R" }))).not.toMatch(/suppl/i);
  });
});
