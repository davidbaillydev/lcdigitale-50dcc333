import { describe, expect, it } from "vitest";
import { cinetpayCheckAccepted, cinetpayCredentialsSchema } from "../lib/payments/cinetpay-config";

describe("CinetPay configuration", () => {
  const config = { siteId: "123456", apiKey: "fixture-api", secretKey: "fixture-secret", mode: "sandbox" };
  it("supports sandbox and production", () => {
    expect(cinetpayCredentialsSchema.parse(config).mode).toBe("sandbox");
    expect(cinetpayCredentialsSchema.parse({ ...config, mode: "production" }).mode).toBe("production");
    expect(cinetpayCredentialsSchema.safeParse({ ...config, mode: "live" }).success).toBe(false);
  });
  it("requires Site ID and both keys", () => {
    for (const key of ["siteId", "apiKey", "secretKey"]) expect(cinetpayCredentialsSchema.safeParse({ ...config, [key]: "" }).success).toBe(false);
    expect(cinetpayCredentialsSchema.safeParse({ ...config, siteId: "abc" }).success).toBe(false);
  });
  it("never treats unknown or cancelled transactions as credential validation", () => {
    expect(cinetpayCheckAccepted({ code: "627", message: "TRANSACTION_CANCEL" })).toBe(false);
    expect(cinetpayCheckAccepted({ code: "00" })).toBe(false);
    expect(cinetpayCheckAccepted({ code: "00", data: { status: "ACCEPTED" } })).toBe(true);
  });
});