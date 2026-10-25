import { describe, expect, it } from "vitest";
import { selectedExtras, selectionLines, type MenuItem } from "@/lib/menu";
import { ticketOptions } from "@/lib/ticket";

const item = { id: "t", name: "Tacos", price: 8, options: [
  { id: "og-s", label: "Sauces", kind: "extra", min: 0, max: 2, choices: [{ id: "b", label: "Blanche" }, { id: "c", label: "Curry" }] },
  { id: "og-d", label: "Boisson", kind: "extra", min: 0, max: 1, choices: [{ id: "f", label: "Fanta dragon 33 cl", price: 1 }] },
] } as unknown as MenuItem;
const sel = { "og-s": ["b", "c"], "og-d": ["f"] };

describe("options sous leur groupe", () => {
  it("panier et borne : une ligne par option avec son groupe", () => {
    expect(selectionLines(item, sel).map((l) => l.replace(/\s/g, " "))).toEqual(["Sauces : Blanche", "Sauces : Curry", "Boisson : Fanta dragon 33 cl (+1,00 €)"]);
  });
  it("ticket et cuisine : groupe figé dans la commande, sans « + »", () => {
    const { selected_options } = selectedExtras(item, sel);
    expect(ticketOptions({ name: "Tacos", qty: 1, selected_options })).toEqual(["Boisson: Fanta dragon 33 cl (+1,00 €)", "Sauces: Blanche", "Sauces: Curry"]);
  });
});
