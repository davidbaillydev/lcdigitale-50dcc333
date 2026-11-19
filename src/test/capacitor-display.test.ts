import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Règle : l'application Android « LC Cuisine » affiche le site publié. Le gabarit
// d'activité ne doit contenir aucune WebView (Capacitor ajoute la sienne), sinon
// l'écran reste noir, et le trafic local (imprimantes) doit rester autorisé.
const config = JSON.parse(readFileSync("capacitor.config.json", "utf8"));
const layout = readFileSync("android/app/src/main/res/layout/activity_main.xml", "utf8");
const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");

describe("affichage de l'application cuisine Android", () => {
  it("ouvre le site de la plateforme et permet toute navigation interne", () => {
    expect(config.server.url).toBe("https://restaurant.lcdigitale.fr/espace");
    expect(config.server.allowNavigation).toEqual(["*"]);
  });

  it("mélange contenu sûr et local, avec le fond sombre de la marque", () => {
    expect(config.android.allowMixedContent).toBe(true);
    expect(config.server.cleartext).toBe(true);
    expect(config.android.backgroundColor).toBe("#141210");
  });

  it("ne laisse aucune WebView vide dans le gabarit d'activité", () => {
    expect(layout).not.toMatch(/<WebView/i);
  });

  it("autorise le trafic en clair sur l'application", () => {
    const application = manifest.slice(manifest.indexOf("<application"), manifest.indexOf("<activity"));
    expect(application).toContain('android:usesCleartextTraffic="true"');
  });
});
