import { countries, countrySchema, type zCountry } from "./money";

export function countryOf(restaurant?: { config?: unknown } | null): zCountry {
  const config = restaurant?.config;
  const value = config && typeof config === "object" && "country" in config ? config.country : undefined;
  const parsed = countrySchema.safeParse(value);
  return parsed.success ? parsed.data : "FR";
}
export function countryFromHostname(hostname: string): zCountry | null {
  const host = hostname.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  const extension = host.split(".").pop()?.toUpperCase();
  if (!host.includes(".")) return null;
  return countries.find((c) => c.code === extension)?.code ?? null;
}
export function countryFlag(code: zCountry): string {
  return [...code].map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join("");
}
export const countryName = (code: zCountry) => countries.find((c) => c.code === code)?.name ?? "France";
export function restaurantsInCountry<T extends { config?: unknown }>(rows: T[], country: zCountry): T[] {
  return rows.filter((r) => countryOf(r) === country);
}