import { describe, it, expect } from "vitest";
(globalThis as any).__APP_BUILD_ID__ = "1";
const { isNewerBuild } = await import("@/components/UpdateNotice");
describe("isNewerBuild", () => {
  it("détecte une version différente", () => expect(isNewerBuild("1", "2")).toBe(true));
  it("ignore la même version", () => expect(isNewerBuild("1", "1")).toBe(false));
  it("ignore une réponse invalide", () => expect(isNewerBuild("1", undefined)).toBe(false));
});
