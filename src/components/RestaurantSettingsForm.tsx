import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveRestaurantSettings, type Settings } from "@/lib/restaurant-settings.functions";
import { timingOf, type Restaurant } from "@/lib/shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RestaurantBannerUpload } from "@/components/RestaurantBannerUpload";
import { RestaurantCoverUpload } from "@/components/RestaurantCoverUpload";
import { PrinterSetup } from "@/components/PrinterSetup";
import { OrdersPausedToggle } from "@/components/OrdersPausedToggle";
import { SettingsGroup, useSettingsGroup, type SettingsGroupKey } from "@/components/SettingsWorkspace";

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
      ordersPaused: c.ordersPaused === true,
      timing: timingOf(r),
      modes: { pickup: c.modes?.pickup !== false, delivery: c.modes?.delivery !== false, dine_in: c.modes?.dine_in !== false },
      pickupMinOrder: typeof c.pickupMinOrder === "number" && c.pickupMinOrder > 0 ? c.pickupMinOrder : null,
      payments: { online: c.payments?.online !== false, onlineDeliveryOnly: c.payments?.onlineDeliveryOnly === true, on_site: c.payments?.on_site !== false, counter: c.payments?.counter !== false, card_terminal: c.payments?.card_terminal !== false, qr: c.payments?.qr === true },
      kiosk: { cardOnly: c.kiosk?.cardOnly === true },
      printing: printingDefaults(c.printing),
      serviceFee: serviceFeeDefaults(c.serviceFee),
    },
  };
}

import { serviceFeeDefaults } from "@/lib/service-fee";
import { printingDefaults, printingFields, printTickets, sampleOrder, ticketHtml } from "@/lib/ticket";
function Section({ title, group, children }: { title: string; group: SettingsGroupKey; children: React.ReactNode }) {
  return <SettingsGroup name={group}><section className="border-t border-border py-6"><h2 className="mb-4 text-2xl">{title}</h2>{children}</section></SettingsGroup>;
}
function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string | undefined; checked: boolean; onChange: (v: boolean) => void }) {
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
  const [confirmOnlineOff, setConfirmOnlineOff] = useState(false);
  const [confirmOnlineOn, setConfirmOnlineOn] = useState(false);
  const activeGroup = useSettingsGroup();
  const [savedSettings, setSavedSettings] = useState(() => JSON.stringify(initialSettings(restaurant)));
  const dirty = JSON.stringify(s) !== savedSettings;
  const [testResult, setTestResult] = useState<null | "ok" | "failed">(null);
  const [previewKind, setPreviewKind] = useState<"kitchen" | "receipt">("kitchen");
  const shop = { name: restaurant.name, address: restaurant.address, phone: restaurant.phone, slug: restaurant.slug, customDomains: restaurant.config.customDomains };
  const testPrint = async () => {
    setTestResult(null);
    const ok = await printTickets(sampleOrder(), [previewKind], shop, s.config.printing.width, printingFields(s.config.printing));
    setTestResult(ok ? "ok" : "failed");
  };
  const [cp, setCp] = useState(""); const [city, setCity] = useState("");
  const cfg = (patch: Partial<Settings["config"]>) => setS({ ...s, config: { ...s.config, ...patch } });
  const del = (patch: Partial<Settings["delivery"]>) => setS({ ...s, delivery: { ...s.delivery, ...patch } });
  const setDay = (d: keyof Settings["opening"], ranges: [number, number][]) => setS({ ...s, opening: { ...s.opening, [d]: ranges } });

  const submit = async () => {
    setBusy(true);
    try { await save({ data: { restaurantId: restaurant.id, settings: s } }); setSavedSettings(JSON.stringify(s)); toast.success("Réglages enregistrés"); onSaved?.(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <SettingsGroup name="appearance"><RestaurantCoverUpload restaurant={restaurant} onSaved={onSaved} />{agency && <RestaurantBannerUpload restaurant={restaurant} onSaved={onSaved} />}</SettingsGroup>
      <Section group="service" title="Horaires d'ouverture">
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

      <Section group="service" title="Commandes & acceptation">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
          <span><span className="block font-medium">Prise de commandes</span><span className="block text-sm text-muted-foreground">Enregistré immédiatement. Suspendue : le menu reste consultable, aucune commande acceptée (site, borne, QR, téléphone).</span></span>
          <OrdersPausedToggle restaurant={restaurant} />
        </div>
        <Toggle label="À emporter (site)" checked={s.config.modes.pickup} onChange={(v) => cfg({ modes: { ...s.config.modes, pickup: v } })} />
        <Toggle label="Livraison (site)" hint={s.config.payments.online === false ? "Indisponible : la livraison nécessite le paiement en ligne (Paiements acceptés)." : undefined} checked={s.config.modes.delivery && s.config.payments.online !== false} onChange={(v) => { if (s.config.payments.online !== false) cfg({ modes: { ...s.config.modes, delivery: v } }); }} />
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

      {agency && <Section group="payments" title="Frais de service">
        {(() => { const sf = serviceFeeDefaults(s.config.serviceFee); const set = (p: Partial<typeof sf>) => cfg({ serviceFee: { ...sf, ...p } }); return (<>
        <Toggle label="Appliquer des frais de service" hint="Ajoutés automatiquement au panier, aux tickets et aux factures (TVA au taux par défaut de l'établissement)." checked={sf.enabled} onChange={(v) => set({ enabled: v })} />
        {sf.enabled && <>
          <div className="my-3 flex flex-wrap gap-2">
            <Button type="button" variant={sf.kind === "fixed" ? "default" : "secondary"} onClick={() => set({ kind: "fixed" })}>Montant fixe (€)</Button>
            <Button type="button" variant={sf.kind === "percent" ? "default" : "secondary"} onClick={() => set({ kind: "percent" })}>Pourcentage du sous-total (%)</Button>
          </div>
          <div className="max-w-xs"><label htmlFor="sfv" className="text-sm font-medium">{sf.kind === "fixed" ? "Montant TTC (€)" : "Pourcentage (%)"}</label>
            <input id="sfv" type="number" min={0} max={100} step="0.01" inputMode="decimal" className="mt-1 h-12 w-full rounded-md border border-input bg-background px-3" value={sf.value} onChange={(e) => set({ value: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /></div>
          <p className="mt-3 text-sm font-semibold">Appliquer sur</p>
          {([["delivery", "Livraison"], ["pickup", "À emporter"], ["dine_in", "Sur place (site / QR)"], ["kiosk", "Borne"]] as const).map(([k, l]) => (
            <Toggle key={k} label={l} checked={sf.modes[k]} onChange={(v) => set({ modes: { ...sf.modes, [k]: v } })} />
          ))}
        </>}
        </>); })()}
      </Section>}

      {agency && <Section group="appearance" title="Impression des tickets">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div>
        <div className="mb-3 flex gap-2">
          {([80, 58] as const).map((w) => (
            <Button key={w} type="button" variant={s.config.printing.width === w ? "default" : "secondary"} onClick={() => cfg({ printing: { ...s.config.printing, width: w } })}>{w} mm</Button>
          ))}
        </div>
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Taille du texte du ticket
            <select className="mt-1 h-12 w-full rounded-md border border-input bg-background px-3" value={s.config.printing.textSize} onChange={(e) => cfg({ printing: { ...s.config.printing, textSize: e.target.value as "compact" | "normal" | "large" } })}>
              <option value="compact">Compact (économise le papier)</option><option value="normal">Normal</option><option value="large">Grand (lecture en cuisine)</option>
            </select></label>
          <label className="text-sm font-medium">Police du ticket
            <select className="mt-1 h-12 w-full rounded-md border border-input bg-background px-3" value={s.config.printing.font} onChange={(e) => cfg({ printing: { ...s.config.printing, font: e.target.value as "sans" | "mono" | "condensed" } })}>
              <option value="sans">Moderne sans-serif</option><option value="mono">Classique caisse</option><option value="condensed">Condensée</option>
            </select></label>
          <p className="text-xs text-muted-foreground sm:col-span-2">La police s'applique à l'impression navigateur ; les imprimantes thermiques directes utilisent leur police interne mais respectent la taille.</p>
        </div>
        <Toggle label="Impression auto du ticket cuisine" hint="Imprime automatiquement le ticket cuisine dès qu'une commande arrive." checked={!!s.config.printing.autoKitchen} onChange={(v) => cfg({ printing: { ...s.config.printing, autoKitchen: v, auto: v || !!s.config.printing.autoReceipt } })} />
        <Toggle label="Impression auto du ticket de caisse" hint="Imprime automatiquement le ticket de caisse dès qu'une commande arrive." checked={!!s.config.printing.autoReceipt} onChange={(v) => cfg({ printing: { ...s.config.printing, autoReceipt: v, auto: v || !!s.config.printing.autoKitchen } })} />
        <p className="mt-3 text-sm font-semibold">Afficher sur le ticket cuisine</p>
        {([["allergens", "Allergènes des plats"], ["options", "Options et suppléments"], ["notes", "Notes du client"], ["customer", "Nom et téléphone du client"], ["contact", "Coordonnées du restaurant"], ["prices", "Prix, total et TVA"], ["paid", "Encadré Payé / Non payé"], ["qc", "Contrôle qualité emballage (cases + visa)"]] as const).map(([k, l]) => (
          <Toggle key={k} label={l} checked={s.config.printing.kitchen[k]} onChange={(v) => cfg({ printing: { ...s.config.printing, kitchen: { ...s.config.printing.kitchen, [k]: v } } })} />
        ))}
        </div>
        <div>
          <div className="mb-2 flex gap-2" role="group" aria-label="Choix de l'aperçu">
            {([["kitchen", "Ticket cuisine"], ["receipt", "Ticket caisse"]] as const).map(([k, l]) => (
              <Button key={k} type="button" size="sm" variant={previewKind === k ? "default" : "secondary"} aria-pressed={previewKind === k} onClick={() => setPreviewKind(k)}>{l}</Button>
            ))}
          </div>
          <p className="mb-2 text-sm font-semibold">Aperçu du {previewKind === "kitchen" ? "ticket cuisine" : "ticket caisse"} ({s.config.printing.width} mm)</p>
          <iframe title={previewKind === "kitchen" ? "Aperçu du ticket cuisine" : "Aperçu du ticket caisse"} className="max-w-full rounded border border-border bg-card"
            style={{ width: `${s.config.printing.width === 80 ? 330 : 250}px`, height: 460 }}
            srcDoc={ticketHtml(sampleOrder(), previewKind, s.config.printing.width, shop, printingFields(s.config.printing))} />
          <div className="mt-3"><PrinterSetup width={s.config.printing.width} shop={shop} /></div>
          <Button type="button" variant="secondary" className="mt-3 w-full" onClick={testPrint}>Imprimer un ticket de test ({previewKind === "kitchen" ? "cuisine" : "caisse"})</Button>
          {testResult === "ok" && <p role="status" className="mt-2 rounded bg-primary/15 p-2 text-sm">Ticket de test envoyé à l'imprimante. Vérifiez qu'il est bien sorti.</p>}
          {testResult === "failed" && <p role="alert" className="mt-2 rounded bg-destructive/20 p-2 text-sm">Échec : le ticket n'a pas pu être envoyé. Vérifiez l'imprimante et réessayez.</p>}
        </div>
        </div>
      </Section>}

      <Section group="payments" title="Paiements acceptés">
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-semibold">Site de commande en ligne</p>
            <div className="space-y-1 rounded-lg border border-border p-3">
              <Toggle label="Paiement en mains propres au retrait / comptoir" hint="Le client commande sur le site et paie au retrait ou au comptoir (espèces, carte ou tickets restaurant). Non disponible pour la livraison, qui exige toujours un paiement en ligne." checked={s.config.payments.on_site} onChange={(v) => cfg({ payments: { ...s.config.payments, on_site: v } })} />
              <Toggle label="Paiement en ligne par carte" hint="Le client paie sur le site via le prestataire connecté par l'agence. Le désactiver conserve la connexion : la réactivation est immédiate." checked={s.config.payments.online !== false} onChange={(v) => { if (v && s.config.modes.delivery === false) setConfirmOnlineOn(true); else if (v) cfg({ payments: { ...s.config.payments, online: true } }); else setConfirmOnlineOff(true); }} />
              <div className="space-y-2 py-2">
                <Label htmlFor="online-payment-modes">Modes acceptant le paiement en ligne</Label>
                <select id="online-payment-modes" className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm" value={s.config.payments.onlineDeliveryOnly ? "delivery" : "all"} onChange={(e) => cfg({ payments: { ...s.config.payments, onlineDeliveryOnly: e.target.value === "delivery" } })}>
                  <option value="all">Tous les modes : livraison, retrait et sur place</option>
                  <option value="delivery">Paiement en ligne réservé à la livraison</option>
                </select>
                {s.config.payments.onlineDeliveryOnly && !s.config.payments.on_site && <p role="alert" className="text-sm text-destructive">Le retrait ne dispose d'aucun paiement accepté. Activez le paiement en mains propres ou choisissez tous les modes.</p>}
              </div>
              <p className="pt-1 text-sm text-muted-foreground">Le paiement en ligne par carte sur le site s'active en connectant un prestataire (Stripe, Mollie, PayPal ou Lyra) dans la section « Prestataires de paiement » ci-dessous.</p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Borne tactile en magasin</p>
            <div className="space-y-1 rounded-lg border border-border p-3">
              <Toggle label="Carte bancaire sur le terminal de paiement relié à la borne" hint="Le client insère ou approche sa carte sur le TPE de la borne (Stripe Terminal, Mollie POS ou SumUp) ; la commande part en cuisine une fois le paiement accepté." checked={s.config.payments.card_terminal} onChange={(v) => cfg({ payments: { ...s.config.payments, card_terminal: v } })} />
              <Toggle label="QR code affiché sur la borne" hint="Le client scanne le QR code avec son téléphone et paie en ligne (Mollie ou Stripe) ; la commande est validée automatiquement après paiement." checked={!!s.config.payments.qr} onChange={(v) => cfg({ payments: { ...s.config.payments, qr: v } })} />
              <Toggle label="Paiement au comptoir" hint="La borne imprime un bon de commande à régler au comptoir ; le client le présente en caisse et paie au comptoir (espèces, carte ou tickets restaurant)." checked={s.config.payments.counter && !s.config.kiosk?.cardOnly} onChange={(v) => { if (!s.config.kiosk?.cardOnly) cfg({ payments: { ...s.config.payments, counter: v } }); }} />
            </div>
          </div>
          {agency && (
            <div className="rounded-lg border border-border p-3">
              <Toggle label="Borne 100 % carte bancaire (Voie B — dispense de caisse sécurisée)" checked={!!s.config.kiosk?.cardOnly} onChange={(v) => cfg({ kiosk: { cardOnly: v }, ...(v ? { payments: { ...s.config.payments, counter: false, card_terminal: true } } : {}) })} />
              {s.config.kiosk?.cardOnly && <p className="mt-2 rounded bg-muted p-2 text-sm text-muted-foreground">La borne n'accepte que la carte sur son terminal connecté (Stripe Terminal, Mollie POS ou SumUp). Aucune espèce, chèque ou ticket restaurant papier n'est proposé ni enregistré ; une commande n'est envoyée en cuisine qu'une fois le paiement accepté (BOI-TVA-DECLA-30-10-30, § 35 et § 37 ex. 4).</p>}
            </div>
          )}
        </div>
      </Section>

      <Section group="delivery" title="Livraison">
        <div className="mb-4 rounded-lg border border-border p-3">
          <Toggle label="Montant minimum de commande à emporter" hint="Par défaut, le client peut commander à emporter quel que soit le montant. Activez cette option pour exiger un minimum." checked={s.config.pickupMinOrder != null} onChange={(v) => cfg({ pickupMinOrder: v ? (s.config.pickupMinOrder ?? 10) : null })} />
          {s.config.pickupMinOrder != null && <div className="mt-2 max-w-48"><Num id="pickup-min" label="Minimum à emporter (€)" step={0.5} value={s.config.pickupMinOrder} onChange={(v) => cfg({ pickupMinOrder: v })} /></div>}
        </div>
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

      {["service", "delivery", "payments", ...(agency ? ["appearance"] : [])].includes(activeGroup) && <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-y border-border bg-background px-1 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <span role="status" className="text-sm text-muted-foreground">{dirty ? "Modifications non enregistrées" : "Réglages enregistrés"}</span>
        <Button size="lg" className="w-full sm:w-auto" onClick={submit} disabled={busy || !dirty}><Save aria-hidden="true" />{busy ? "Enregistrement…" : "Enregistrer les réglages"}</Button>
      </div>}
      <AlertDialog open={confirmOnlineOff} onOpenChange={setConfirmOnlineOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver le paiement en ligne ?</AlertDialogTitle>
            <AlertDialogDescription>Attention : la désactivation du paiement en ligne désactive également la livraison à domicile. Les commandes en livraison nécessitent obligatoirement le paiement en ligne sécurisé pour couvrir les frais de service et garantir le règlement avant le départ du livreur. Votre site fonctionnera alors exclusivement en retrait sur place (Click &amp; Collect).</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-12">Annuler</AlertDialogCancel>
            <AlertDialogAction className="min-h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => cfg({ payments: { ...s.config.payments, online: false }, modes: { ...s.config.modes, delivery: false } })}>Confirmer et désactiver les livraisons</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmOnlineOn} onOpenChange={setConfirmOnlineOn}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réactiver le paiement en ligne ?</AlertDialogTitle>
            <AlertDialogDescription>La livraison à domicile est actuellement désactivée. Confirmez-vous la réactivation du paiement en ligne par carte ? Les livraisons restent coupées si vous choisissez de les laisser désactivées ; votre site fonctionnera alors en retrait sur place (Click &amp; Collect). Vous pourrez réactiver la livraison à tout moment dans « Modes de commande ».</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction className="min-h-12 w-full" onClick={() => cfg({ payments: { ...s.config.payments, online: true }, modes: { ...s.config.modes, delivery: true } })}>Confirmer et réactiver les livraisons</AlertDialogAction>
            <AlertDialogAction className="min-h-12 w-full bg-secondary text-secondary-foreground hover:bg-secondary/80" onClick={() => cfg({ payments: { ...s.config.payments, online: true }, modes: { ...s.config.modes, delivery: false } })}>Activer le paiement seulement (livraisons désactivées)</AlertDialogAction>
            <AlertDialogCancel className="min-h-12 w-full">Annuler</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
