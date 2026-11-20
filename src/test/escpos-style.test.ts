import { describe, expect, it } from "vitest";
import { ticketEscpos } from "@/lib/escpos";
import { printingDefaults, printingFields, type TicketOrder } from "@/lib/ticket";

const order: TicketOrder = {
  order_number: 123, mode: "pickup", slot: "2026-11-20T12:00:00Z", total: 15,
  payment_method: "counter", notes: "Sans sauce",
  items: [{ name: "Poulet", qty: 1, details: ["Sauce: Ketchup"], selected_options: [{ name: "Cheddar", price: 1 }] }],
};
const has = (bytes: Uint8Array, command: number[]) => Buffer.from(bytes).includes(Buffer.from(command));
// Decode commands while retaining the actual hardware state for each printed line.
function lines(bytes: Uint8Array) {
  let size = 0, font = 0, spacing = 30, text = "";
  const out: { text: string; size: number; font: number; spacing: number }[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i], op = bytes[i + 1];
    if (b === 0x1b || b === 0x1d) {
      if (b === 0x1d && op === 0x21) size = bytes[i + 2] ?? 0;
      if (b === 0x1b && op === 0x4d) font = bytes[i + 2] ?? 0;
      if (b === 0x1b && op === 0x33) spacing = bytes[i + 2] ?? 30;
      if (b === 0x1b && op === 0x32) spacing = 30;
      i += op === 0x40 || op === 0x32 ? 1 : 2;
    } else if (b === 10) { out.push({ text, size, font, spacing }); text = ""; }
    else if (b !== undefined) text += String.fromCharCode(b);
  }
  return out;
}
describe("ESC/POS hardware style", () => {
  for (const font of ["sans", "mono", "condensed"] as const) {
    it(`selects hardware font ${font === "condensed" ? "B" : "A"} for ${font}`, () => {
      const b = ticketEscpos(order, "kitchen", 80, { name: "Test" }, { font });
      expect(has(b, [0x1b, 0x4d, font === "condensed" ? 1 : 0])).toBe(true);
    });
  }
  it("compact forces font B and 22-dot line spacing even with standard selected", () => {
    const b = ticketEscpos(order, "kitchen", 58, { name: "Test" }, { font: "sans", textSize: "compact" });
    expect(has(b, [0x1b, 0x4d, 1])).toBe(true);
    expect(has(b, [0x1b, 0x33, 22])).toBe(true);
  });
  for (const width of [58, 80] as const) {
    it(`large doubles items, choices, extras, notes and key information at ${width}mm`, () => {
      const b = ticketEscpos(order, "kitchen", width, { name: "Test" }, printingFields(printingDefaults({ textSize: "large" })));
      const printed = lines(b);
      for (const token of ["Poulet", "Ketchup", "Cheddar", "Sans", "sauce", "EMPORTER"]) {
        const line = printed.find((l) => l.text.includes(token));
        expect(line, token).toBeDefined();
        expect(line?.size, token).toBe(0x11);
      }
      for (const line of printed.filter((l) => l.size === 0x11)) expect(line.text.length).toBeLessThanOrEqual(width === 80 ? 24 : 16);
      for (const line of printed.filter((l) => (l.size & 1) === 1)) expect(line.spacing).toBe(60);
      expect(printed.find((l) => l.text.includes("Articles:"))?.spacing).toBe(30);
      expect(has(b, [0x1b, 0x32])).toBe(true);
    });
  }
});