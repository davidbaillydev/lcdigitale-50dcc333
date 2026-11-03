import { describe, expect, it } from "vitest";
import { annualEnd, annualTotal, billingSchema, licenseActive, KIOSK_ANNUAL_HT_CENTS } from "@/lib/kiosk-licenses";
describe("licences logiciel borne", () => {
  const active = { status: "active", starts_on: "2026-11-03", ends_on: "2027-11-03" };
  it("coûte 400 € HT pour une année et une borne active", () => {
    expect(KIOSK_ANNUAL_HT_CENTS).toBe(40000);
    expect(annualTotal([active], "2026-11-03")).toBe(40000);
  });
  it("calcule 1200 € HT pour trois bornes actives", () => expect(annualTotal([active, active, active], "2026-11-03")).toBe(120000));
  it("exclut les licences suspendues, terminées, futures et expirées", () => {
    expect(annualTotal([active, { ...active, status: "suspended" }, { ...active, status: "ended" }, { ...active, starts_on: "2026-12-01" }, { ...active, ends_on: "2026-11-03" }], "2026-11-03")).toBe(40000);
    expect(licenseActive(active, "2027-11-03")).toBe(false);
  });
  it("fixe un anniversaire annuel avec gestion du 29 février", () => {
    expect(annualEnd("2026-11-03")).toBe("2027-11-03");
    expect(annualEnd("2028-02-29")).toBe("2029-02-28");
  });
  it("exige référence et date pour un règlement déclaré", () => {
    const data = { id: "fc23060e-4518-46f9-b604-8bf2a0f9fabf", status: "paid", invoiceReference: "", dueOn: null, paidOn: null, notes: "" };
    expect(billingSchema.safeParse(data).success).toBe(false);
    expect(billingSchema.safeParse({ ...data, invoiceReference: "F-2026-1", paidOn: "2026-11-03" }).success).toBe(true);
  });
});