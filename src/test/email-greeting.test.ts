import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { campaignHtml, firstName, greetingText, orderConfirmedHtml, orderReceivedHtml, type EmailOrder, type EmailRestaurant } from "@/lib/email-templates";

const restaurant: EmailRestaurant = { slug: "woknsushi", name: "Wok & Sushi", brand: { accent: "#c8102e" } };
const order = (over: Partial<EmailOrder>): EmailOrder => ({
  id: "x", order_number: 12, mode: "pickup", slot: new Date("2026-11-02T19:00:00Z").toISOString(), asap: false,
  total: 20, items: [], notes: null, email: "a@b.fr", phone: "0600000000",
  customer_name: "", first_name: null, ...over,
});

describe("formule d'accueil des e-mails", () => {
  it("met la première lettre du prénom en majuscule", () => {
    expect(greetingText("alexia")).toBe("Bonjour Alexia,");
    expect(greetingText("  alexia ")).toBe("Bonjour Alexia,");
    expect(greetingText("alexia dupont")).toBe("Bonjour Alexia,");
    expect(greetingText("jean dupont")).toBe("Bonjour Jean,");
  });

  it("dit simplement « Bonjour, » quand le prénom est inconnu — jamais « Bonjour client, »", () => {
    for (const v of ["", "   ", null, undefined]) expect(greetingText(v)).toBe("Bonjour,");
    expect(greetingText("")).not.toContain("client");
  });

  it("reprend le prénom de la commande, avec la majuscule", () => {
    expect(firstName({ first_name: "alexia", customer_name: "alexia dupont" })).toBe("Alexia");
    expect(firstName({ first_name: null, customer_name: "marie dupont" })).toBe("Marie");
    expect(firstName({ first_name: null, customer_name: "" })).toBe("");
  });

  it("les e-mails de commande n'affichent ni « client » ni « Bonjour , »", () => {
    for (const html of [
      orderReceivedHtml(order({}), restaurant, "https://restaurant.lcdigitale.fr"),
      orderConfirmedHtml(order({}), restaurant, "https://restaurant.lcdigitale.fr"),
    ]) {
      expect(html).toContain("Bonjour,");
      expect(html).not.toContain("Bonjour client");
      expect(html).not.toContain("Bonjour ,");
    }
    const confirmed = orderConfirmedHtml(order({ first_name: "alexia", customer_name: "alexia" }), restaurant, "https://restaurant.lcdigitale.fr");
    expect(confirmed).toContain("Bonjour Alexia,");
  });

  it("la campagne reçoit la formule d'accueil en paramètre, sans texte en dur", () => {
    const html = campaignHtml({ restaurant: "Wok & Sushi", body: "Offre", subject: "Offre" });
    expect(html).toContain("{{params.greeting}}");
    expect(html).not.toContain("Bonjour client");
    expect(html).not.toContain("{{params.name}}");
  });

  it("l'envoi Brevo ne met plus « client » en dur et transmet une formule d'accueil", () => {
    const src = readFileSync("src/lib/campaign.functions.ts", "utf8");
    expect(src).not.toContain('"client"');
    expect(src).toContain("params: { greeting: greetingText(c.name)");
    expect(src).toContain("params: { greeting: greetingText(sample)");
    expect(src).toContain('"Alexia"');
  });

  it("l'aperçu agence montre les deux formules", () => {
    const src = readFileSync("src/routes/_authenticated/admin.emails.tsx", "utf8");
    expect(src).toContain('{{params.greeting}}');
    expect(src).toContain("Bonjour Marie,");
    expect(src).not.toContain("{{params.name}}");
  });
});
