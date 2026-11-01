import { describe, it, expect } from "vitest";
import { isNewerBuild } from "@/lib/app-version";
describe("isNewerBuild", () => {
  it("détecte une version différente", () => expect(isNewerBuild("1", "2")).toBe(true));
  it("ignore la même version", () => expect(isNewerBuild("1", "1")).toBe(false));
  it("ignore une réponse invalide", () => expect(isNewerBuild("1", undefined)).toBe(false));
});
