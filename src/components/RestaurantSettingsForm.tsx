import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveRestaurantSettings, type Settings } from "@/lib/restaurant-settings.functions";
import type { Restaurant } from "@/lib/shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const DAYS = [["1", "Lundi"], ["2", "Mardi"], ["3", "Mercredi"], ["4", "Jeudi"], ["5", "Vendredi"], ["6", "Samedi"], ["0", "Dimanche"]] as const;
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fromHHMM = (s: string) => { const [h, m] = s.split(":").map(Number); return (h || 0) * 60 + (m || 0); };

export function initialSettings(r: Restaurant): Settings {
  const c = r.config ?? {};
  const opening = Object.fromEntries(DAYS.map(([d]) => [d, r.opening?.[d] ?? []])) as Settings["opening"];
  return {
    opening,
    delivery: { minOrder: r.delivery?.minOrder ?? 20, fee: r.delivery?.fee ?? 2.5, freeFrom: r.delivery?.freeFrom ?? 40, zones: r.delivery?.zones ?? [] },
    config: {
      slotMinutes: c.slotMinutes ?? 20, lead: c.lead ?? { pickup: 20, delivery: 40 }, hoursLabel: c.hoursLabel ?? "", tagline: c.tagline,
      autoAccept: c.autoAccept ?? false,
      modes: { pickup: c.modes?.pickup !== false, delivery: c.modes?.delivery !== false, dine_in: c.modes?.dine_in !== false },
      payments: { on_site: c.payments?.on_site !== false, counter: c.payments?.counter !== false, card_terminal: c.payments?.card_terminal !== false },
    },
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-5"><h2 className="mb-4 text-3xl">{title}</h2>{children}</section>;
}
function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2">
      <span><span className="font-medium">{label}</span>{hint && <span className="block text-sm text-muted-foreground">{hint}</span>}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
function Num({ id, label, value, onChange, step = 1 }: { id: string; label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" min={0} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} /></div>;
}

/** Horaires, modes de commande, acceptation, paiements et livraison d'un restaurant. */
export function RestaurantSettingsForm({ restaurant, onSaved }: { restaurant: Restaurant; onSaved?: () => void }) {
  const save = useServerFn(saveRestaurantSettings);
  const [s, setS] = useState<Settings>(() => initialSettings(restaurant));
  const [busy, setBusy] = useState(false);
  const [cp, setCp] = useState(""); const [city, setCity] = useState("");
  const cfg = (patch: Partial<Settings["config"]>) => setS({ ...s, config: { ...s.config, ...patch } });
  const del = (patch: Partial<Settings["delivery"]>) => setS({ ...s, delivery: { ...s.delivery, ...patch } });
  const setDay = (d: keyof Settings["opening"], ranges: [number, number][]) => setS({ ...s, opening: { ...s.opening, [d]: ranges } });

  const submit = async () => {
    setBusy(true);
    try { await save({ data: { restaurantId: restaurant.id, settings: s } }); toast.success("Réglages enregistrés"); onSaved?.(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <Section title="Horaires d'ouverture">
        <div className="space-y-3">
          {DAYS.map(([d, label]) => {
            const ranges = s.opening[d] ?? [];
            return (
              <div key={d} className="flex flex-wrap items-center gap-2">
                <span className="w-24 font-medium">{label}</span>
                {!ranges.length && <span className="text-sm text-muted-foreground">Fermé</span>}
                {ranges.map(([a, b], i) => (
                  <span key={i} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1">
                    <input aria-label={`${label} début`} type="time" value={toHHMM(a)} onChange={(e) => setDay(d, ranges.map((r, j) => (j === i ? [fromHHMM(e.target.value), r[1]] : r)))} className="bg-transparent" />
                    –
                    <input aria-label={`${label} fin`} type="time" value={toHHMM(b)} onChange={(e) => setDay(d, ranges.map((r, j) => (j === i ? [r[0], fromHHMM(e.target.value)] : r)))} className="bg-transparent" />
                    <button type="button" aria-label="Retirer la plage" onClick={() => setDay(d, ranges.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
                  </span>
                ))}
                {ranges.length < 3 && <Button type="button" size="sm" variant="ghost" onClick={() => setDay(d, [...ranges, ranges.length ? [1110, 1350] : [690, 870]])}><Plus /> Plage</Button>}
              </div>
            );
          })}
          <div className="space-y-1 pt-2"><Label htmlFor="hl">Texte des horaires affiché aux clients</Label>
            <Input id="hl" value={s.config.hoursLabel ?? ""} placeholder="11h30–14h30 · 18h30–22h30 · Dimanche fermé" onChange={(e) => cfg({ hoursLabel: e.target.value })} /></div>
        </div>
      </Section>

      <Section title="Commandes & acceptation">
        <Toggle label="À emporter (site)" checked={s.config.modes.pickup} onChange={(v) => cfg({ modes: { ...s.config.modes, pickup: v } })} />
        <Toggle label="Livraison (site)" checked={s.config.modes.delivery} onChange={(v) => cfg({ modes: { ...s.config.modes, delivery: v } })} />
        <Toggle label="Sur place (borne)" checked={s.config.modes.dine_in} onChange={(v) => cfg({ modes: { ...s.config.modes, dine_in: v } })} />
        <Toggle label="Acceptation automatique" hint="Sinon, chaque commande doit être acceptée en cuisine." checked={s.config.autoAccept} onChange={(v) => cfg({ autoAccept: v })} />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Num id="slot" label="Créneaux (minutes)" value={s.config.slotMinutes} onChange={(v) => cfg({ slotMinutes: v })} />
          <Num id="lp" label="Préparation à emporter (min)" value={s.config.lead.pickup} onChange={(v) => cfg({ lead: { ...s.config.lead, pickup: v } })} />
          <Num id="ld" label="Délai de livraison (min)" value={s.config.lead.delivery} onChange={(v) => cfg({ lead: { ...s.config.lead, delivery: v } })} />
        </div>
      </Section>

      <Section title="Paiements acceptés">
        <Toggle label="Paiement au retrait / à la livraison (site)" checked={s.config.payments.on_site} onChange={(v) => cfg({ payments: { ...s.config.payments, on_site: v } })} />
        <Toggle label="Payer au comptoir — espèces, tickets resto (borne)" checked={s.config.payments.counter} onChange={(v) => cfg({ payments: { ...s.config.payments, counter: v } })} />
        <Toggle label="Carte bancaire au comptoir (borne)" checked={s.config.payments.card_terminal} onChange={(v) => cfg({ payments: { ...s.config.payments, card_terminal: v } })} />
        <p className="mt-2 text-sm text-muted-foreground">Le paiement en ligne par carte n'est pas encore activé.</p>
      </Section>

      <Section title="Livraison">
        <div className="grid gap-3 sm:grid-cols-3">
          <Num id="fee" label="Frais de livraison (€)" step={0.5} value={s.delivery.fee} onChange={(v) => del({ fee: v })} />
          <Num id="min" label="Minimum de commande (€)" value={s.delivery.minOrder} onChange={(v) => del({ minOrder: v })} />
          <Num id="free" label="Offerte à partir de (€)" value={s.delivery.freeFrom} onChange={(v) => del({ freeFrom: v })} />
        </div>
        <p className="mt-4 font-medium">Zone de livraison (codes postaux)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {s.delivery.zones.map((z, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm">{z.cp} {z.city}
              <button type="button" aria-label={`Retirer ${z.city}`} onClick={() => del({ zones: s.delivery.zones.filter((_, j) => j !== i) })}><Trash2 className="h-3 w-3" /></button></span>
          ))}
          {!s.delivery.zones.length && <span className="text-sm text-muted-foreground">Aucune zone : la livraison sera indisponible.</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input aria-label="Code postal" placeholder="31770" value={cp} onChange={(e) => setCp(e.target.value)} className="w-28" />
          <Input aria-label="Ville" placeholder="Colomiers" value={city} onChange={(e) => setCity(e.target.value)} className="w-48" />
          <Button type="button" variant="secondary" disabled={!/^\d{5}$/.test(cp) || !city.trim()} onClick={() => { del({ zones: [...s.delivery.zones, { cp, city: city.trim() }] }); setCp(""); setCity(""); }}><Plus /> Ajouter</Button>
        </div>
      </Section>

      <Button size="lg" onClick={submit} disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer les réglages"}</Button>
    </div>
  );
}
