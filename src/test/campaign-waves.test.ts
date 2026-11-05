import { describe, expect, it } from "vitest";
import { selectWave, waveSizeSchema } from "@/lib/campaign-waves";

const rows = Array.from({ length: 650 }, (_, i) => ({ id: `c${i}`, email: `client${i}@example.com`, name: null }));
const ids = rows.map((r) => r.id);

describe("Vagues de campagnes", () => {
  it("defaults to 100, never the entire address book", () => {
    const wave = selectWave(ids, rows, waveSizeSchema.parse(undefined));
    expect(wave.recipients).toHaveLength(100);
    expect(wave.remainingIds).toHaveLength(550);
  });
  it("allows 300 recipients but never 301 in a wave", () => {
    expect(selectWave(ids, rows, 300).recipients).toHaveLength(300);
    expect(() => selectWave(ids, rows, 301)).toThrow();
  });
  it("rejects sizes below 100 and non integers", () => {
    for (const size of [99, 0, 150.5]) expect(() => waveSizeSchema.parse(size)).toThrow();
    expect(waveSizeSchema.parse(150)).toBe(150);
  });
  it("only sends the final remainder and needs no padding to 100", () => {
    const first = selectWave(ids, rows, 300);
    const second = selectWave(first.remainingIds, rows, 300, first.recipients.map((r) => r.email));
    const third = selectWave(second.remainingIds, rows, 300);
    expect(third.recipients).toHaveLength(50);
    expect(third.remainingIds).toEqual([]);
    expect(new Set([...first.recipients, ...second.recipients, ...third.recipients].map((r) => r.id)).size).toBe(650);
  });
  it("removes unsubscribed or removed clients on the next wave", () => {
    const first = selectWave(ids, rows, 100);
    const next = selectWave(first.remainingIds, rows.filter((r) => r.id !== "c100"), 100);
    expect(next.recipients[0]?.id).toBe("c101");
    expect(next.remainingIds).not.toContain("c100");
  });
  it("deduplicates IDs and normalized emails, including earlier waves", () => {
    const customers = [{ id: "c0", email: "client0@example.com", name: null }, { id: "duplicate", email: " CLIENT0@example.com ", name: null }, { id: "c1", email: "client1@example.com", name: null }, { id: "invalid", email: "bad", name: null }];
    const next = selectWave(["c0", "duplicate", "c1", "c1", "invalid"], customers, 100, ["client0@example.com"]);
    expect(next.recipients.map((r) => r.id)).toEqual(["c1"]);
  });
});