import { describe, expect, it } from "vitest";
import type { MenuItem } from "@/lib/menu";
import { assertItemAvailable, isItemAvailable, itemOrderDate } from "@/lib/shop";
import { itemScheduleSchema } from "@/lib/menu-schedule";

const item: MenuItem = { id: "lunch", name: "Menu midi", price: 12, schedule: { days: [1, 2, 3, 4, 5], start: "11:30", end: "14:00" } };
describe("Paris product availability", () => {
  it("allows a weekday inside 11:30–14:00", () => expect(isItemAvailable(item, new Date("2026-10-26T11:00:00Z"))).toBe(true));
  it("rejects before 11:30", () => expect(isItemAvailable(item, new Date("2026-10-26T10:29:00Z"))).toBe(false));
  it("includes start", () => expect(isItemAvailable(item, new Date("2026-10-26T10:30:00Z"))).toBe(true));
  it("excludes end and after 14:00", () => {
    expect(isItemAvailable(item, new Date("2026-10-26T13:00:00Z"))).toBe(false);
    expect(isItemAvailable(item, new Date("2026-10-26T14:00:00Z"))).toBe(false);
  });
  it("rejects Sunday at lunchtime", () => expect(isItemAvailable(item, new Date("2026-10-25T11:00:00Z"))).toBe(false));
  it("uses the planned slot rather than current time", () => {
    const now = new Date("2026-10-26T08:00:00Z"), slot = "2026-10-26T11:00:00Z";
    expect(isItemAvailable(item, itemOrderDate(false, slot, now))).toBe(true);
    expect(isItemAvailable(item, itemOrderDate(true, slot, now))).toBe(false);
  });
  it("rejects planned orders outside the range", () => expect(() => assertItemAvailable(item, itemOrderDate(false, "2026-10-26T14:00:00Z"))).toThrow("11:30"));
  it("handles summer Paris time", () => expect(isItemAvailable(item, new Date("2026-07-06T09:30:00Z"))).toBe(true));
  it("keeps unscheduled products available", () => expect(isItemAvailable({ ...item, schedule: undefined })).toBe(true));
  it("supports days-only and time-only restrictions", () => {
    expect(isItemAvailable({ ...item, schedule: { days: [0] } }, new Date("2026-10-25T11:00:00Z"))).toBe(true);
    expect(isItemAvailable({ ...item, schedule: { start: "11:00", end: "14:00" } }, new Date("2026-10-25T11:00:00Z"))).toBe(true);
  });
  it("assigns overnight windows to the starting day", () => {
    const overnight = { ...item, schedule: { days: [5], start: "22:00", end: "02:00" } };
    expect(isItemAvailable(overnight, new Date("2026-10-30T22:00:00Z"))).toBe(true);
    expect(isItemAvailable(overnight, new Date("2026-10-31T00:30:00Z"))).toBe(true);
    expect(isItemAvailable(overnight, new Date("2026-10-31T01:00:00Z"))).toBe(false);
  });
  it("validates persisted schedule and rejects invalid time/day/empty range", () => {
    expect(itemScheduleSchema.parse(item.schedule)).toEqual(item.schedule);
    for (const s of [{ days: [7] }, { days: [] }, { start: "25:00" }, { start: "11:00", end: "11:00" }]) expect(itemScheduleSchema.safeParse(s).success).toBe(false);
  });
});