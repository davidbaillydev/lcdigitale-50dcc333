import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveRestaurantSettings, type Settings } from "@/lib/restaurant-settings.functions";
import { timingOf, type Restaurant } from "@/lib/shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RestaurantBannerUpload } from "@/components/RestaurantBannerUpload";
import { PrinterSetup } from "@/components/PrinterSetup";

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
      timing: timingOf(r),
      modes: { pickup: c.modes?.pickup !== false, delivery: c.modes?.delivery !== false, dine_in: c.modes?.dine_in !== false },
      payments: { on_site: c.payments?.on_site !== false, counter: c.payments?.counter !== false, card_terminal: c.payments?.card_terminal !== false },
      printing: printingDefaults(c.printing),
    },
  };
}

import { printingDefaults, printTickets, sampleOrder, ticketHtml } from "@/lib/ticket";
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
export function RestaurantSettingsForm({ restaurant, onSaved, agency = true }: { restaurant: Restaurant; onSaved?: () => void; agency?: boolean }) {
  const save = useServerFn(saveRestaurantSettings);
  const [s, setS] = useState<Settings>(() => initialSettings(restaurant));
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<null | "ok" | "failed">(null);
  const shop = { name: restaurant.name, address: restaurant.address, phone: restaurant.phone };
  const testPrint = async () => {
    setTestResult(null);
    const ok = await printTickets(sampleOrder(), ["kitchen"], shop, s.config.printing.width, s.config.printing.kitchen);
    setTestResult(ok ? "ok" : "failed");
  };
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
      <RestaurantBannerUpload restaurant={restaurant} onSaved={onSaved} />
      <Section title="Horaires d'ouverture">
        <div className="space-y-3">
          {DAYS.map(([d, label]) => {
            const ranges = s.opening[d] ?? [];
            return (
              <div key={d} className="flex flex-wrap items-center gap-2">
                <span className="w-24 font-medium">{label}</span>
                {!ranges.length && <span className="text-sm text-muted-foreground">Fermé</span>}
                {ranges.map(([a, b], i) => (
                  <span key={i} className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1 rounded-lg border border-border px-2 py-1 sm:w-auto">
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
        <p className="mt-4 text-sm font-semibold">Moment de la commande</p>
        <Toggle label="Autoriser les commandes « Dès que possible »" checked={s.config.timing.asap} onChange={(v) => cfg({ timing: { ...s.config.timing, asap: v } })} />
        <Toggle label="Autoriser les commandes planifiées" hint="Le client choisit un horaire dans vos heures d'ouverture." checked={s.config.timing.scheduled} onChange={(v) => cfg({ timing: { ...s.config.timing, scheduled: v } })} />
        {!s.config.timing.asap && !s.config.timing.scheduled && <p role="alert" className="text-sm text-destructive">Activez au moins une des deux options.</p>}
        <p className="mt-4 text-sm font-semibold">À l'acceptation en cuisine</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {([["auto", "Délai par défaut", "Heure prévue = acceptation + délai"], ["manual", "Délai à chaque commande", "La cuisine choisit +15/+30/+45 min ou une heure"]] as const).map(([v, t, h]) => (
            <button key={v} type="button" aria-pressed={s.config.timing.prepMode === v} onClick={() => cfg({ timing: { ...s.config.timing, prepMode: v } })}
              className={"min-h-12 rounded-lg border p-3 text-left " + (s.config.timing.prepMode === v ? "border-primary bg-primary/10" : "border-border")}>
              <span className="block font-medium">{t}</span><span className="block text-sm text-muted-foreground">{h}</span>
            </button>
          ))}
        </div>
        {s.config.timing.prepMode === "auto" && <div className="mt-3 max-w-xs"><Num id="dp" label="Délai de préparation par défaut (min)" value={s.config.timing.defaultPrep} onChange={(v) => cfg({ timing: { ...s.config.timing, defaultPrep: v } })} /></div>}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Num id="slot" label="Créneaux (minutes)" value={s.config.slotMinutes} onChange={(v) => cfg({ slotMinutes: v })} />
          <Num id="lp" label="Préparation à emporter (min)" value={s.config.lead.pickup} onChange={(v) => cfg({ lead: { ...s.config.lead, pickup: v } })} />
          <Num id="ld" label="Délai de livraison (min)" value={s.config.lead.delivery} onChange={(v) => cfg({ lead: { ...s.config.lead, delivery: v } })} />
        </div>
      </Section>

      {agency && <Section title="Impression des tickets">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div>
        <div className="mb-3 flex gap-2">
          {([80, 58] as const).map((w) => (
            <Button key={w} type="button" variant={s.config.printing.width === w ? "default" : "secondary"} onClick={() => cfg({ printing: { ...s.config.printing, width: w } })}>{w} mm</Button>
          ))}
        </div>
        <Toggle label="Impression automatique" hint="Imprime le ticket cuisine et le ticket de caisse dès qu'une commande arrive. Sinon, impression manuelle." checked={s.config.printing.auto} onChange={(v) => cfg({ printing: { ...s.config.printing, auto: v } })} />
        <p className="mt-3 text-sm font-semibold">Afficher sur le ticket cuisine</p>
        {([["allergens", "Allergènes des plats"], ["options", "Options et suppléments"], ["notes", "Notes du client"], ["customer", "Nom et téléphone du client"], ["contact", "Coordonnées du restaurant"], ["prices", "Prix, total et TVA"], ["paid", "Encadré Payé / Non payé"], ["qc", "Contrôle qualité emballage (cases + visa)"]] as const).map(([k, l]) => (
          <Toggle key={k} label={l} checked={s.config.printing.kitchen[k]} onChange={(v) => cfg({ printing: { ...s.config.printing, kitchen: { ...s.config.printing.kitchen, [k]: v } } })} />
        ))}
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Aperçu du ticket cuisine ({s.config.printing.width} mm)</p>
          <iframe title="Aperçu du ticket cuisine" className="max-w-full rounded border border-border bg-card"
            style={{ width: `${s.config.printing.width === 80 ? 330 : 250}px`, height: 460 }}
            srcDoc={ticketHtml(sampleOrder(), "kitchen", s.config.printing.width, shop, s.config.printing.kitchen)} />
          <div className="mt-3"><PrinterSetup width={s.config.printing.width} shop={shop} /></div>
          <Button type="button" variant="secondary" className="mt-3 w-full" onClick={testPrint}>Imprimer un ticket de test</Button>
          {testResult === "ok" && <p role="status" className="mt-2 rounded bg-primary/15 p-2 text-sm">Ticket de test envoyé à l'imprimante. Vérifiez qu'il est bien sorti.</p>}
          {testResult === "failed" && <p role="alert" className="mt-2 rounded bg-destructive/20 p-2 text-sm">Échec : le ticket n'a pas pu être envoyé. Vérifiez l'imprimante et réessayez.</p>}
        </div>
        </div>
      </Section>}

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
