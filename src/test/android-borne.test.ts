import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prepareBorne } from "../../scripts/prepare-android-borne.mjs";

describe("APK LC Borne séparée de LC Cuisine", () => {
  it("configure le bon identifiant, nom et démarrage dans un dossier de compilation isolé", () => {
    const root = mkdtempSync(join(tmpdir(), "lc-borne-test-"));
    try {
      mkdirSync(join(root, "android/app/src/main/res/values"), { recursive: true });
      writeFileSync(join(root, "capacitor.borne.config.json"), readFileSync("capacitor.borne.config.json", "utf8"));
      writeFileSync(join(root, "android/app/src/main/res/values/strings.xml"), readFileSync("android/app/src/main/res/values/strings.xml", "utf8"));
      prepareBorne(root);
      const config = JSON.parse(readFileSync(join(root, "capacitor.config.json"), "utf8"));
      expect(config.appId).toBe("fr.lcdigitale.borne");
      expect(config.appName).toBe("LC Borne");
      expect(config.server.url).toBe("https://restaurant.lcdigitale.fr/borne");
      expect(config.server.allowNavigation).toEqual(["*"]);
      const strings = readFileSync(join(root, "android/app/src/main/res/values/strings.xml"), "utf8");
      expect(strings).toContain('<string name="app_name">LC Borne</string>');
      const cuisine = JSON.parse(readFileSync("capacitor.config.json", "utf8"));
      expect(cuisine.appId).toBe("fr.lcdigitale.cuisine");
      expect(cuisine.server.url).toBe("https://restaurant.lcdigitale.fr/espace");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it("force anti-veille et plein écran pour la borne sans modifier les commandes cuisine", () => {
    const java = readFileSync("android/app/src/main/java/fr/lcdigitale/cuisine/LcKitchenPlugin.java", "utf8");
    expect(java.match(/boolean on = BuildConfig.IS_KIOSK \|\| call.getBoolean\("on", true\);/g)).toHaveLength(2);
    const gradle = readFileSync("android/app/build.gradle", "utf8");
    expect(gradle).toContain('applicationId lcBorneApp ? "fr.lcdigitale.borne" : "fr.lcdigitale.cuisine"');
    expect(gradle).toContain('buildConfigField "boolean", "IS_KIOSK", lcBorneApp.toString()');
  });
  it("publie lc-borne.apk sur la release dédiée avec déclenchement manuel et push", () => {
    const workflow = readFileSync(".github/workflows/android-borne-apk.yml", "utf8");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("./gradlew assembleDebug -PlcBorneApp=true --no-daemon");
    expect(workflow).toContain("gh release upload v1.0.0-borne lc-borne.apk#lc-borne.apk --clobber");
    expect(workflow).not.toContain("android-actions/setup-android");
  });
});