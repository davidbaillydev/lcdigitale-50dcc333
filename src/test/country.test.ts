import { describe, expect, it } from "vitest";
import { countryOf, countryFromHostname, countryFlag, restaurantsInCountry } from "@/lib/country";

describe("Pays et annuaire", () => {
  it.each([["restaurant.fr","FR"],["commande.ga","GA"],["menu.sn","SN"],["site.ci","CI"],["site.cm","CM"],["site.tg","TG"]] as const)("détecte %s comme %s", (host, expected) => expect(countryFromHostname(host)).toBe(expected));
  it.each(["localhost", "localhost:8080", "lcdigitale.lovable.app", "restaurant.com", "127.0.0.1"])("ne détecte pas de pays national sur %s", (host) => expect(countryFromHostname(host)).toBeNull());
  it("filtre par domaine sans tenir compte du pays dans l’URL publique", () => {
    const rows = [{ name: "France", config: { country: "FR" } }, { name: "Sénégal", config: { country: "SN" } }];
    const national = new URL("https://restaurant.sn/?country=FR");
    const generic = new URL("https://lcdigitale.lovable.app/?country=SN");
    expect(restaurantsInCountry(rows, countryFromHostname(national.hostname) ?? "FR").map((r) => r.name)).toEqual(["Sénégal"]);
    expect(restaurantsInCountry(rows, countryFromHostname(generic.hostname) ?? "FR").map((r) => r.name)).toEqual(["France"]);
  });
  it("ne se laisse pas tromper par un sous-domaine national", () => expect(countryFromHostname("site.fr.example.com")).toBeNull());
  it("utilise la France pour un ancien restaurant sans pays", () => { expect(countryOf({ config: {} })).toBe("FR"); expect(countryOf({ config: { country: "invalid" } })).toBe("FR"); });
  it("ne montre que les restaurants du pays choisi", () => {
    const rows = [{ name:"France" },{ name:"Gabon", config:{ country:"GA" } },{ name:"Sénégal", config:{ country:"SN" } }];
    expect(restaurantsInCountry(rows,"SN").map((r)=>r.name)).toEqual(["Sénégal"]);
    expect(restaurantsInCountry(rows,"GA").map((r)=>r.name)).toEqual(["Gabon"]);
    expect(restaurantsInCountry(rows,"FR").map((r)=>r.name)).toEqual(["France"]);
  });
  it("rend les drapeaux correspondant au pays", () => { expect(countryFlag("FR")).toBe("🇫🇷"); expect(countryFlag("GA")).toBe("🇬🇦"); expect(countryFlag("SN")).toBe("🇸🇳"); expect(countryFlag("CI")).toBe("🇨🇮"); expect(countryFlag("CM")).toBe("🇨🇲"); expect(countryFlag("TG")).toBe("🇹🇬"); });
});