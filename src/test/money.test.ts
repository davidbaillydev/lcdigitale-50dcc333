import { describe, expect, it } from "vitest";
import { countries, currencyOf, formatMoney, legacyPaymentsSupported, currencySchema } from "@/lib/money";

describe("restaurant currencies", () => {
  it("preserves EUR for missing or unknown configuration", () => {
    expect(currencyOf(null)).toBe("EUR");
    expect(currencyOf({ config: {} })).toBe("EUR");
    expect(currencyOf({ config: { currency: "invalid" } })).toBe("EUR");
  });
  it("keeps euro cents", () => expect(formatMoney(12.5, "EUR")).toBe("12,50 €"));
  it("formats West African CFA without decimals", () => expect(formatMoney(2500, "XOF")).toBe("2 500 FCFA"));
  it("formats Central African CFA without decimals", () => expect(formatMoney(2500, "XAF")).toBe("2 500 FCFA"));
  it("associates Senegal and Côte d'Ivoire with XOF", () => {
    expect(countries.find((c) => c.code === "SN")?.currency).toBe("XOF");
    expect(countries.find((c) => c.code === "CI")?.currency).toBe("XOF");
  });
  it("associates Cameroon, Gabon and Congo with XAF", () => {
    for (const code of ["CM", "GA", "CG"]) expect(countries.find((c) => c.code === code)?.currency).toBe("XAF");
  });
  it("associates RDC with CDF", () => expect(countries.find((c) => c.code === "CD")?.currency).toBe("CDF"));
  it("rejects unsupported currencies", () => expect(currencySchema.safeParse("INVALID").success).toBe(false));
  it("never sends CFA prices to EUR-only gateways", () => {
    expect(legacyPaymentsSupported({ config: { currency: "XOF" } })).toBe(false);
    expect(legacyPaymentsSupported({ config: { currency: "XAF" } })).toBe(false);
    expect(legacyPaymentsSupported({ config: { currency: "EUR" } })).toBe(true);
    expect(legacyPaymentsSupported(null)).toBe(true);
  });
});