import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const widgetSrc = readFileSync("scripts/embed.src.js", "utf8");
const widgetServed = readFileSync("public/embed.js", "utf8");
const section = readFileSync("src/components/EmbedButtonSection.tsx", "utf8");
const lib = readFileSync("src/lib/embed.ts", "utf8");

// Règle : partir du bouton « Commander en ligne » ne doit jamais ouvrir la
// plateforme dans un nouvel onglet, quel que soit l'écran.
describe("entrée de commande : toujours dans le même onglet", () => {
  it("le widget n'ouvre pas de nouvel onglet (source et fichier servi)", () => {
    expect(widgetSrc).not.toContain("_blank");
    expect(widgetServed).not.toContain("_blank");
    expect(widgetSrc).toContain("window.top.location=u");
    expect(widgetServed).toContain("window.top.location=u");
  });

  it("le widget servi reste sous 6 Ko", () => {
    expect(Buffer.byteLength(widgetServed)).toBeLessThan(6144);
  });

  it("le lien simple fourni au restaurant ne force pas un nouvel onglet", () => {
    expect(section).not.toContain('target="_blank"');
    expect(section).toContain('<a href="${link}">Commander en ligne</a>');
  });

  it("openTop tente le même onglet avant tout nouvel onglet", () => {
    const sameTab = lib.indexOf("t.location.href = url");
    expect(sameTab).toBeGreaterThan(-1);
    expect(sameTab).toBeLessThan(lib.indexOf('"_blank"'));
  });
});
