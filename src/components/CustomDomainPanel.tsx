import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Globe, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveCustomDomains } from "@/lib/restaurant-settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Nettoie une saisie : minuscules, sans protocole, sans slashs ni espaces. */
export function cleanDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/\s].*$/, "")
    .replace(/\.+$/, "");
}

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/;

export function CustomDomainPanel({ restaurantId, initial, onSaved }: { restaurantId: string; initial?: string[]; onSaved?: () => void }) {
  const [domains, setDomains] = useState<string[]>(initial ?? []);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const save = useServerFn(saveCustomDomains);

  const persist = async (next: string[]) => {
    setSaving(true);
    try {
      await save({ data: { restaurantId, domains: next } });
      setDomains(next);
      toast.success("Domaines enregistrés");
      onSaved?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const add = () => {
    const d = cleanDomain(draft);
    if (!d) return;
    if (!DOMAIN_RE.test(d)) { toast.error("Format de domaine invalide (ex. commande.monresto.fr)"); return; }
    if (domains.includes(d)) { toast.error("Domaine déjà ajouté"); return; }
    void persist([...domains, d]);
    setDraft("");
  };

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Globe className="h-5 w-5" /> Domaine personnalisé</h2>
      <p className="text-sm text-muted-foreground">
        La racine d'un domaine listé ici ouvre directement la page du restaurant (ex. <code>https://commande.woknsushi.com</code> → ce restaurant).
      </p>
      <ul className="space-y-2">
        {domains.map((d) => (
          <li key={d} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <span className="font-mono">{d}</span>
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => void persist(domains.filter((x) => x !== d))} aria-label={`Supprimer ${d}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
        {domains.length === 0 && <li className="text-sm text-muted-foreground">Aucun domaine personnalisé.</li>}
      </ul>
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="commande.monresto.fr" onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button onClick={add} disabled={saving || !draft.trim()}><Plus className="h-4 w-4" /> Ajouter</Button>
      </div>
      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
        <p className="font-medium">Réglages DNS à effectuer chez le registrar du domaine :</p>
        <ul className="mt-1 list-inside list-disc space-y-1 text-muted-foreground">
          <li>Type : <strong>CNAME</strong></li>
          <li>Hôte / Nom : le sous-domaine (ex. <code>commande</code> pour <code>commande.woknsushi.com</code>)</li>
          <li>Cible / Valeur : <code>restaurant.lcdigitale.fr</code></li>
          <li>Déclarez aussi le domaine dans les réglages de domaine de l'hébergement Lovable pour activer le certificat SSL (https).</li>
        </ul>
      </div>
    </section>
  );
}
