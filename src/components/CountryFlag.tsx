import { countryFlag, countryName } from "@/lib/country";
import { countries, countrySchema, type zCountry } from "@/lib/money";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export function CountryFlag({ country, showName = false }: { country: zCountry; showName?: boolean }) {
  return <span className="inline-flex shrink-0 items-center gap-1.5" title={countryName(country)}><span role="img" aria-label={countryName(country)} className="text-xl leading-none">{countryFlag(country)}</span>{showName && <span className="text-sm">{countryName(country)}</span>}</span>;
}
export function CountrySelect({ value, onChange, all = false, label = "Pays" }: { value: zCountry | "all"; onChange: (country: zCountry | "all") => void; all?: boolean; label?: string }) {
  return <Select value={value} onValueChange={(v) => { if (all && v === "all") onChange("all"); else onChange(countrySchema.parse(v)); }}>
    <SelectTrigger aria-label={label} className="min-h-11 w-full min-w-0 [&>span]:truncate"><SelectValue>{value === "all" ? "Tous les pays" : <span className="inline-flex items-center gap-1.5"><span aria-hidden>{countryFlag(value)}</span>{countryName(value)}</span>}</SelectValue></SelectTrigger>
    <SelectContent>{all && <SelectItem value="all">Tous les pays</SelectItem>}{countries.map((c) => <SelectItem key={c.code} value={c.code}><span aria-hidden>{countryFlag(c.code)}</span> {c.name}</SelectItem>)}</SelectContent>
  </Select>;
}