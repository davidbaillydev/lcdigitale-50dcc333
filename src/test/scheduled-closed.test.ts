import { describe, expect, it } from "vitest";
import { availableSlots, isValidSlot, scheduledOrderingAllowed, timingOf, type Restaurant } from "@/lib/shop";
const closed = new Date("2026-11-09T08:00:00Z");
const open = new Date("2026-11-09T11:00:00Z");
const restaurant = (allow?: boolean): Restaurant => ({ id: "fixture", slug: "fixture", name: "Fixture", city: null, address: null, phone: null, email: null, menu_key: "vierge", logo_url: null, menu: [], brand: {}, delivery: { minOrder: 0, fee: 0, freeFrom: 0, zones: [] }, config: { timing: allow === undefined ? {} : { scheduledWhileClosed: allow }, lead: { pickup: 20, delivery: 40 }, slotMinutes: 20 }, opening: { "1": [[690, 870]] } });
describe("scheduled orders received while closed", () => {
  it("preserves existing booking when the preference is absent", () => {
    expect(timingOf(restaurant()).scheduledWhileClosed).toBe(true);
    expect(availableSlots(restaurant(), "pickup", closed)).toContain("2026-11-09T10:30:00.000Z");
  });
  it("allows scheduled orders before opening when enabled", () => {
    expect(scheduledOrderingAllowed(restaurant(true), closed)).toBe(true);
    expect(isValidSlot(restaurant(true), "pickup", "2026-11-09T11:10:00Z", closed)).toBe(true);
  });
  it("blocks scheduled orders while closed when disabled", () => {
    expect(availableSlots(restaurant(false), "pickup", closed)).toEqual([]);
    expect(isValidSlot(restaurant(false), "pickup", "2026-11-09T11:10:00Z", closed)).toBe(false);
  });
  it("allows scheduled orders during opening with either choice", () => {
    expect(availableSlots(restaurant(false), "delivery", open).length).toBeGreaterThan(0);
  });
  it("never permits a slot outside opening", () => {
    expect(isValidSlot(restaurant(true), "pickup", "2026-11-09T16:00:00Z", closed)).toBe(false);
  });
});