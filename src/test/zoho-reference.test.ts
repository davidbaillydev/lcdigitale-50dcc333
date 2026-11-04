import { describe, it, expect } from "vitest";
import { zohoReference, lastDayOfMonth } from "@/lib/agency-gains";

describe("Factures Zoho mensuelles", () => {
  it("référence stable par restaurant et par mois (anti-doublon)", () => {
    expect(zohoReference("2026-10", "ab12cd34-0000-1111")).toBe("COM-202610-AB12CD34");
    expect(zohoReference("2026-11", "ab12cd34-0000-1111")).not.toBe(zohoReference("2026-10", "ab12cd34-0000-1111"));
  });
  it("datée du dernier jour du mois", () => {
    expect(lastDayOfMonth("2026-10")).toBe("2026-10-31");
    expect(lastDayOfMonth("2028-02")).toBe("2028-02-29");
  });
});
