import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { duplicateAgencyRestaurant } from "@/lib/restaurant-duplication.functions";
import { duplicateRestaurantSchema, type DuplicateRestaurantInput } from "@/lib/restaurant-duplication";
import { countries, countrySchema, currencySchema, currencyLabels, currencyOf } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Source = { id: string; name: string; config?: { currency?: string; country?: string } };
export function DuplicateRestaurantDialog({ restaurant, onClose, onCreated }: { restaurant: Source; onClose: () => void; onCreated: (slug: string) => void }) {
  const duplicate = useServerFn(duplicateAgencyRestaurant);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<DuplicateRestaurantInput>({
    sourceId: restaurant.id, name: `${restaurant.name} — Copie`.slice(0, 80), slug: "", city: "", address: "", phone: "", email: "",
    country: countrySchema.catch("FR").parse(restaurant.config?.country), currency: currencyOf(restaurant),
    copyMenu: true, copyBrand: true, copyOpening: false, priceMode: "keep", coefficient: 1,
  });
  const set = <K extends keyof DuplicateRestaurantInput>(key: K, value: DuplicateRestaurantInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    const valid = duplicateRestaurantSchema.safeParse(form);
    if (!valid.success) { setError(valid.error.issues[0]?.message ?? "Vérifiez les champs"); return; }
    setBusy(true); setError("");
    try {
      const result = await duplicate({ data: valid.data });
      toast.success("Restaurant dupliqué — hors ligne, prêt à configurer");
      onCreated(result.slug);
    } catch (e) { setError(e instanceof Error ? e.message : "Duplication impossible"); }
    finally { setBusy(false); }
  };
  const field = (key: "name" | "slug" | "city" | "address" | "phone" | "email", text: string, max: number) => <div className="space-y-1.5">
    <Label htmlFor={`duplicate-${key}`}>{text}</Label>
    <Input id={`duplicate-${key}`} value={form[key]} disabled={busy} maxLength={max} required={key === "name" || key === "slug"} type={key === "email" ? "email" : "text"} onChange={(e) => set(key, e.target.value)} />
  </div>;
  const check = (key: "copyMenu" | "copyBrand" | "copyOpening", text: string) => <label className="flex min-h-12 cursor-pointer items-center gap-3">
    <Checkbox checked={form[key]} disabled={busy} onCheckedChange={(v) => set(key, v === true)} />{text}
  </label>;
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }} onInteractOutside={(e) => { if (busy) e.preventDefault(); }}>
      <DialogHeader className="shrink-0 border-b border-border p-5 pr-12">
        <DialogTitle className="text-2xl">Dupliquer le restaurant</DialogTitle>
        <DialogDescription className="break-words">À partir de {restaurant.name}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="flex min-h-0 flex-col">
        <div className="min-h-0 space-y-5 overflow-y-auto p-5">
          <fieldset disabled={busy} className="space-y-3">
            <legend className="mb-3 font-semibold">Nouvel établissement</legend>
            <div className="grid gap-3 sm:grid-cols-2">{field("name", "Nom", 80)}{field("slug", "Adresse web (slug)", 40)}{field("city", "Ville", 80)}{field("address", "Adresse", 200)}{field("phone", "Téléphone", 30)}{field("email", "E-mail", 120)}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="duplicate-country">Pays de destination</Label><Select value={form.country} disabled={busy} onValueChange={(v) => {
                const country = countrySchema.parse(v); const found = countries.find((c) => c.code === country);
                setForm((f) => ({ ...f, country, currency: found?.currency ?? f.currency }));
              }}><SelectTrigger id="duplicate-country" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{countries.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label htmlFor="duplicate-currency">Devise</Label><Select value={form.currency} disabled={busy} onValueChange={(v) => set("currency", currencySchema.parse(v))}><SelectTrigger id="duplicate-currency" className="w-full [&>span]:truncate"><SelectValue /></SelectTrigger><SelectContent>{currencySchema.options.map((c) => <SelectItem key={c} value={c}>{c} — {currencyLabels[c]}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </fieldset>
          <fieldset className="border-t border-border pt-4"><legend className="font-semibold">Éléments à reprendre</legend>
            {check("copyMenu", "Carte complète, formats, options et ingrédients retirables")}
            {check("copyBrand", "Couleurs de marque et logo")}
            {check("copyOpening", "Horaires d’ouverture (heure de Paris)")}
          </fieldset>
          {form.copyMenu && <fieldset className="border-t border-border pt-4"><legend className="font-semibold">Prix de la carte</legend>
            <RadioGroup value={form.priceMode} disabled={busy} onValueChange={(v) => set("priceMode", v as DuplicateRestaurantInput["priceMode"])} className="mt-2 gap-0">
              {([ ["keep", "Conserver les montants actuels"], ["zero", "Réinitialiser tous les prix à 0"], ["multiply", "Appliquer un coefficient multiplicateur"] ] as const).map(([value, text]) => <label key={value} className="flex min-h-12 items-center gap-3"><RadioGroupItem value={value} />{text}</label>)}
            </RadioGroup>
            {form.priceMode === "multiply" && <div className="mt-2 max-w-xs space-y-1.5"><Label htmlFor="duplicate-coefficient">Coefficient</Label><Input id="duplicate-coefficient" type="number" step="any" min="0.000001" max="1000000" disabled={busy} value={Number.isNaN(form.coefficient) ? "" : form.coefficient} onChange={(e) => set("coefficient", e.target.valueAsNumber)} /></div>}
            {form.currency !== currencyOf(restaurant) && form.priceMode === "keep" && <p className="mt-2 text-sm text-destructive">La devise change, mais les montants ne sont pas convertis.</p>}
          </fieldset>}
          <p className="border-l-2 border-primary pl-3 text-sm text-muted-foreground">Création hors ligne, commandes suspendues. Aucune commande, aucun ticket, client, membre d’équipe, session caisse ou identifiant de paiement n’est repris. Les photos privées des plats ne sont pas copiées.</p>
          {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="shrink-0 border-t border-border bg-background p-4"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Annuler</Button><Button type="submit" disabled={busy || !form.name.trim() || !form.slug}>{busy ? <Loader2 className="animate-spin" /> : <Copy />}{busy ? "Duplication…" : "Créer la copie"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}