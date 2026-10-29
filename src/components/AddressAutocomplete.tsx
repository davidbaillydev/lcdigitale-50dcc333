import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { banFeatureToAddress, banSearchUrl, type BanAddress, type BanFeature } from "@/lib/address-autocomplete";

/**
 * Champ d'adresse avec suggestions officielles (Base Adresse Nationale) dès la saisie.
 * La sélection remonte une adresse complète et géolocalisée via onSelect.
 */
export function AddressAutocomplete({ id, value, onChange, onSelect, placeholder }: {
  id?: string | undefined;
  value: string;
  onChange: (v: string) => void;
  onSelect: (a: BanAddress) => void;
  placeholder?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BanAddress[]>([]);
  const [hi, setHi] = useState(-1);
  const seq = useRef(0);
  const skip = useRef<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 4 || q === skip.current) { setItems([]); setOpen(false); return; }
    skip.current = null;
    const n = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(banSearchUrl(q));
        if (!res.ok) return;
        const json = (await res.json()) as { features?: BanFeature[] };
        if (n !== seq.current) return; // réponse en retard : ignorée
        const list = (json.features ?? []).map(banFeatureToAddress).filter((a) => a.address && a.postcode);
        setItems(list);
        setOpen(list.length > 0);
        setHi(-1);
      } catch { /* réseau indisponible : la saisie manuelle reste possible */ }
    }, 300);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (a: BanAddress) => {
    seq.current++; // bloque la réouverture par la requête en cours
    skip.current = a.address; // ne pas relancer une recherche sur l'adresse choisie
    setOpen(false);
    setItems([]);
    onSelect(a);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && hi >= 0) { e.preventDefault(); pick(items[hi]!); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div ref={box} className="relative">
      <Input
        id={id}
        maxLength={200}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => { if (items.length) setOpen(true); }}
        role="combobox"
        aria-expanded={open}
        aria-controls={id ? `${id}-suggestions` : undefined}
        aria-activedescendant={hi >= 0 && id ? `${id}-suggestion-${hi}` : undefined}
      />
      {open && (
        <ul
          id={id ? `${id}-suggestions` : undefined}
          role="listbox"
          aria-label="Suggestions d'adresses"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-popover py-1 shadow-lg"
        >
          {items.map((a, i) => (
            <li key={`${a.label}-${i}`} role="option" aria-selected={i === hi} id={id ? `${id}-suggestion-${i}` : undefined}>
              <button
                type="button"
                onClick={() => pick(a)}
                onMouseEnter={() => setHi(i)}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-sm",
                  i === hi ? "bg-primary/10" : "hover:bg-muted",
                )}
              >
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 truncate">{a.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
