import { describe, expect, it } from "vitest";
import { sha256, verifyChain, verifyArchive, ZERO_HASH } from "@/lib/pos-integrity";
describe("SHA-256 POS integrity", () => {
  const chain = async () => {
    const first = { sequence: 1, previous_hash: ZERO_HASH, payload_text: '{"number":1,"at":"2026-11-07T09:13:00Z","vat":[{"rate":10,"ht":10,"vat":1,"ttc":11}]}', hash: "" };
    first.hash = await sha256(first.previous_hash + "\n" + first.payload_text);
    const second = { sequence: 2, previous_hash: first.hash, payload_text: '{"number":2,"total":20}', hash: "" };
    second.hash = await sha256(second.previous_hash + "\n" + second.payload_text);
    return [first, second];
  };
  it("uses SHA-256 known vector", async () => expect(await sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
  it("accepts continuously chained receipt numbers", async () => expect(await verifyChain(await chain())).toBe(true));
  it("rejects altered VAT totals", async () => { const rows = await chain(); const row = rows[0]; if (!row) throw Error(); row.payload_text = row.payload_text.replace('"vat":1', '"vat":2'); expect(await verifyChain(rows)).toBe(false); });
  it("rejects missing receipts", async () => expect(await verifyChain((await chain()).slice(1))).toBe(false));
  it("rejects replaced previous fingerprint", async () => { const rows = await chain(); const row = rows[1]; if (!row) throw Error(); row.previous_hash = ZERO_HASH; expect(await verifyChain(rows)).toBe(false); });
  it("accepts explicit legacy boundary without claiming historical chaining", async () => { const rows = await chain(); const row = rows[0]; if (!row) throw Error(); expect(await verifyChain(rows.slice(1), row.sequence, row.hash)).toBe(true); });
  it("rejects reordered receipts", async () => expect(await verifyChain((await chain()).reverse())).toBe(false));
  it("global archive hash detects changed bytes", async () => { const text = '{"total":11}'; const hash = await sha256(text); expect(await verifyArchive(text, hash)).toBe(true); expect(await verifyArchive('{"total":12}', hash)).toBe(false); });
});