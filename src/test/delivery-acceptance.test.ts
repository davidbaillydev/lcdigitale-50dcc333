import { describe, expect, it } from "vitest";
import { ACCEPTANCE_SECONDS, hasAcceptanceDeadline } from "@/lib/order-acceptance";
import { formatCountdown, remainingMs } from "@/components/AcceptCountdown";
describe("delivery acceptance rule", () => {
  it("uses exactly 300 seconds / 5 minutes", () => {
    expect(ACCEPTANCE_SECONDS).toBe(300);
    expect(formatCountdown(ACCEPTANCE_SECONDS * 1000)).toBe("5:00");
    expect(remainingMs("2026-11-20T12:05:00Z", Date.parse("2026-11-20T12:00:00Z"))).toBe(300_000);
  });
  it("shows the blocking timer only for delivery with a saved deadline", () => {
    expect(hasAcceptanceDeadline({ mode: "delivery", accept_deadline: "2026-11-20T12:05:00Z" })).toBe(true);
    expect(hasAcceptanceDeadline({ mode: "delivery", accept_deadline: null })).toBe(false);
  });
  for (const mode of ["pickup", "takeaway", "dine_in"]) it(`${mode} has no blocking countdown even with an old deadline`, () => {
    expect(hasAcceptanceDeadline({ mode, accept_deadline: "2026-11-20T12:05:00Z" })).toBe(false);
  });
});