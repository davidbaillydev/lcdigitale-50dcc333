import { ALLERGENS, allergenIcon, allergenLabel } from "@/lib/allergens";
import { cn } from "@/lib/utils";

/** Badges d'allergènes d'un plat (pictogramme + libellé) */
export function AllergenBadges({ ids, size = "sm", className }: { ids?: string[]; size?: "sm" | "lg"; className?: string }) {
  if (!ids?.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1", className)} aria-label="Allergènes">
      {ids.map((a) => (
        <li key={a} title={allergenLabel(a)} className={cn("inline-flex items-center gap-1 rounded-full border border-border bg-muted font-medium", size === "lg" ? "px-3 py-1.5 text-base" : "px-2 py-0.5 text-xs")}>
          <span aria-hidden>{allergenIcon(a)}</span>{allergenLabel(a)}
        </li>
      ))}
    </ul>
  );
}

/** Bloc « Contient » pour la fiche du plat — mention obligatoire même si vide */
export function AllergenInfo({ ids, size = "sm" }: { ids?: string[]; size?: "sm" | "lg" }) {
  return (
    <div className="space-y-1">
      <p className={cn("font-semibold", size === "lg" ? "text-lg" : "text-sm")}>Allergènes</p>
      {ids?.length ? <AllergenBadges ids={ids} size={size} /> : <p className="text-sm text-muted-foreground">Aucun allergène majeur déclaré pour ce plat.</p>}
      <p className="text-xs text-muted-foreground">En cas d'allergie, signalez-le au restaurant : des traces peuvent subsister en cuisine.</p>
    </div>
  );
}

/** Sélecteur d'allergènes à exclure (client) ou à cocher (back-office) */
export function AllergenPicker({ value, onChange, size = "sm" }: { value: string[]; onChange: (v: string[]) => void; size?: "sm" | "lg" }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ALLERGENS.map((a) => {
        const on = value.includes(a.id);
        return (
          <button key={a.id} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== a.id) : [...value, a.id])}
            className={cn("inline-flex items-center gap-1 rounded-full border font-medium transition", size === "lg" ? "min-h-14 px-5 text-lg" : "px-3 py-1 text-sm",
              on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary")}>
            <span aria-hidden>{a.icon}</span>{a.label}
          </button>
        );
      })}
    </div>
  );
}
