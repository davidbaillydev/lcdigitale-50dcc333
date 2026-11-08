import { describe, expect, it } from "vitest";
import { trustedOrigin } from "@/lib/trusted-origin";
import { safeSpreadsheetCell } from "@/lib/export";
describe("Payment and activation return origins", () => {
  it("keeps the production, preview and local application origins", () => {
    expect(trustedOrigin("https://commande.tacos-house.fr")).toBe("https://commande.tacos-house.fr");
    expect(trustedOrigin("http://localhost:8080")).toBe("http://localhost:8080");
    expect(trustedOrigin()).toBe("https://restaurant.lcdigitale.fr");
  });
  it.each(["https://attacker.example", "https://localhost.attacker.example", "https://restaurant.lcdigitale.fr.attacker.example", "https://user@restaurant.lcdigitale.fr", "https://restaurant.lcdigitale.fr/evil", "https://restaurant.lcdigitale.fr?return=evil", "http://restaurant.lcdigitale.fr"])("rejects %s", (url) => expect(() => trustedOrigin(url)).toThrow());
});
describe("Spreadsheet formula neutralization", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-1+1", "@SUM(A1)", "  =HYPERLINK(\"evil\")", "\t=1+1", "\r=1+1", "\n=1+1"])("neutralizes %s", (value) => expect(safeSpreadsheetCell(value)).toBe(`'${value}`));
  it("keeps ordinary names and numeric values", () => { expect(safeSpreadsheetCell("Alexia")).toBe("Alexia"); expect(safeSpreadsheetCell(12.5)).toBe("12.5"); });
});