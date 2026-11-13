import { describe, expect, it } from "vitest";
import { formatCountdown, remainingMs } from "@/components/AcceptCountdown";
describe("minuteur d'acceptation", () => {
  it("affiche 4:00 au départ du délai de 4 minutes", () => expect(formatCountdown(4 * 60_000)).toBe("4:00"));
  it("ne descend jamais sous zéro après l'échéance", () => expect(remainingMs("2026-01-01T00:00:00Z", Date.parse("2026-01-01T00:05:00Z"))).toBe(0));
});
