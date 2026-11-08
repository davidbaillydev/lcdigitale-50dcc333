import { describe, expect, it } from "vitest";
import { menuImportPriceCeiling } from "@/lib/money";
describe("menu import price ceiling", () => {
  it("keeps 1000 for EUR", () => expect(menuImportPriceCeiling("EUR")).toBe(1000));
  it("accepts FCFA prices like 2500", () => expect(menuImportPriceCeiling("XAF")).toBeGreaterThan(2500));
});
