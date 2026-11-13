import { describe, expect, it } from "vitest";
import { preauthEnabled } from "@/lib/shop";
describe("pré-autorisation CB par restaurant", () => {
  it("désactivée par défaut : débit immédiat habituel", () => { expect(preauthEnabled({ payments: { online: true } })).toBe(false); expect(preauthEnabled(null)).toBe(false); });
  it("activée seulement si l'option est cochée", () => expect(preauthEnabled({ payments: { preauth: true } })).toBe(true));
});
