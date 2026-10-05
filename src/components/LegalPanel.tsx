import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink, Scale } from "lucide-react";
import { saveLegal } from "@/lib/agency.functions";
import { DEFAULT_HOST, DOC_TITLES, LEGAL_FIELDS, missingLegal, type LegalDocKey, type LegalInfo } from "@/lib/legal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LegalPanel({ restaurant, onSaved }: { restaurant: { id: string; slug: string; legal?: LegalInfo }; onSaved: () => void }) {
  const [l, setL] = useState<LegalInfo>({ host: DEFAULT_HOST, ...(restaurant.legal ?? {}) });
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveLegal);
  const missing = missingLegal(l);
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-3xl"><Scale className="h-6 w-6" /> Légal & RGPD</h2>
        <span className={missing.length ? "rounded-full border border-destructive px-3 py-1 text-xs text-destructive" : "rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"}>
          {missing.length ? `À compléter (${missing.length})` : "Complet"}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">Ces informations remplissent automatiquement les mentions légales, la politique de confidentialité, les CGV et la page cookies du site. Modèles à faire relire par un juriste si besoin.</p>
      {missing.length > 0 && <p className="text-sm text-destructive">Manquant : {missing.join(", ")}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {LEGAL_FIELDS.map((f) => (
          <div key={f.key} className={f.key === "host" ? "space-y-1 sm:col-span-2" : "space-y-1"}>
            <Label htmlFor={`legal-${f.key}`}>{f.label}{f.required ? " *" : ""}</Label>
            <Input id={`legal-${f.key}`} value={l[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setL({ ...l, [f.key]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(DOC_TITLES) as LegalDocKey[]).map((k) => (
          <Button key={k} asChild variant="secondary" size="sm"><a href={`/${restaurant.slug}/${k}`} target="_blank" rel="noreferrer"><ExternalLink /> {DOC_TITLES[k]}</a></Button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{restaurant.legal?.updatedAt ? `Mis à jour le ${new Date(restaurant.legal.updatedAt).toLocaleDateString("fr-FR")}` : "Jamais enregistré"}</p>
        <Button disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            const { updatedAt: _u, ...rest } = l;
            await save({ data: { id: restaurant.id, legal: rest } });
            toast.success("Informations légales enregistrées"); onSaved();
          } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
        }}>{busy ? "Enregistrement…" : "Enregistrer"}</Button>
      </div>
    </section>
  );
}
