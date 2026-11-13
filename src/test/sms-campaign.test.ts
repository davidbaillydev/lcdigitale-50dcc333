import { describe, it, expect } from "vitest";
import { eligibleSms, smsContent, smsDraftSchema, smsMetrics, smsPhone } from "@/lib/sms-campaign";
const id = "00000000-0000-4000-8000-000000000001";
const row = { id, name: "Client", phone: "06 12 34 56 78", marketing_consent: true, consent_at: "2026-11-01T00:00:00Z" };
describe("SMS campaign safety", () => {
  it("only selects consenting clients with dated consent and a valid mobile", () => {
    expect(eligibleSms([row, { ...row, id: "2", marketing_consent: false }, { ...row, id: "3", consent_at: null }, { ...row, id: "4", phone: "01 23 45 67 89" }], "FR")).toEqual([{ ...row, phone: "+33612345678" }]);
  });
  it("deduplicates normalized phones and excludes previous sends", () => {
    expect(eligibleSms([row, { ...row, id: "2", phone: "+33612345678" }], "FR")).toHaveLength(1);
    expect(eligibleSms([row], "FR", ["+33612345678"])).toHaveLength(0);
  });
  it("normalizes Cameroon phones without assuming France", () => {
    expect(smsPhone("690123456", "CM")).toBe("+237690123456");
    expect(smsPhone("0033690123456", "CM")).toBe("+33690123456");
    expect(smsPhone("690123456", "UNKNOWN")).toBeNull();
  });
  it("always adds Brevo's functional STOP code", () => {
    expect(smsContent("Offre du jour")).toBe("Offre du jour\nReply STOP to [STOP_CODE]");
    expect(smsDraftSchema.safeParse({ restaurantId: id, campaignId: id, name: "Offre", sender: "TacosHouse", body: "Ne pas STOP", customerIds: [id] }).success).toBe(false);
  });
  it("counts GSM multipart and Unicode SMS including extended characters", () => {
    expect(smsMetrics("a".repeat(160))).toMatchObject({ segments: 1, unicode: false });
    expect(smsMetrics("a".repeat(161)).segments).toBe(2);
    expect(smsMetrics("€".repeat(81)).segments).toBe(2);
    expect(smsMetrics("漢".repeat(71))).toMatchObject({ segments: 2, unicode: true });
  });
});