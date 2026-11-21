import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Used only in the isolated Borne build job; Cuisine source configuration stays the default. */
export function borneStrings(source) {
  const values = { app_name: "LC Borne", title_activity_main: "LC Borne", package_name: "fr.lcdigitale.borne", custom_url_scheme: "fr.lcdigitale.borne" };
  return source.replace(/(<string name="([^"]+)">)[^<]*(<\/string>)/g, (match, open, name, close) => values[name] ? `${open}${values[name]}${close}` : match);
}

export function prepareBorne(root = process.cwd()) {
  const config = JSON.parse(readFileSync(resolve(root, "capacitor.borne.config.json"), "utf8"));
  if (config.appId !== "fr.lcdigitale.borne" || config.server.url !== "https://restaurant.lcdigitale.fr/borne") throw new Error("Unexpected Borne configuration");
  writeFileSync(resolve(root, "capacitor.config.json"), JSON.stringify(config, null, 2) + "\n");
  const stringsPath = resolve(root, "android/app/src/main/res/values/strings.xml");
  writeFileSync(stringsPath, borneStrings(readFileSync(stringsPath, "utf8")));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareBorne();
  console.log("LC Borne configuration prepared; build Gradle with -PlcBorneApp=true.");
}