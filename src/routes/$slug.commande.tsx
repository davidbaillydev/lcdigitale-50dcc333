import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bike, CalendarClock, Clock, ShoppingBag, CreditCard, Store, Wallet, Landmark, MapPin, LocateFixed } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { CartLines } from "@/components/CartSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/lib/cart";
import { euro } from "@/lib/menu";
import { useTable } from "@/lib/table";
import { findZone, zoneFee, type GeoZone } from "@/lib/geo";
import { geocodeAddress } from "@/lib/delivery.functions";
import { computeServiceFee, serviceFeeLabel, type ServiceFeeChannel } from "@/lib/service-fee";
import { asapSlot, availableSlots, deliveryFee, fmtTime, isOpenNow, modeEnabled, timingOf } from "@/lib/shop";
import { createOrder } from "@/lib/orders.functions";
import { onlinePaymentInfo } from "@/lib/payments.functions";
import { StripePayment } from "@/components/StripePayment";
import { cn } from "@/lib/utils";
import { PromoCodeField, type AppliedDiscount } from "@/components/PromoCodeField";

export const Route = createFileRoute("/$slug/commande")({
  head: () => ({
    meta: [
      { title: "Finaliser ma commande — LC Digitale" },
      { name: "description", content: "Choisissez click & collect ou livraison, votre créneau et votre mode de paiement." },
      { property: "og:title", content: "Finaliser ma commande — LC Digitale" },
      { property: "og:description", content: "Click & collect ou livraison." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { lines, subtotal, clear, restaurant, qr } = useCart();
  const DELIVERY = restaurant.delivery;
  const navigate = useNavigate();
  const submitFn = useServerFn(createOrder);
  const [mode, setMode] = useState<"pickup" | "delivery">(modeEnabled(restaurant, "pickup") ? "pickup" : "delivery");
  const tableNo = useTable(restaurant.slug, restaurant.config.qr?.tables ?? 0);
  const table = tableNo ?? qr.room ?? (qr.self ? "self" : null);
  const onsiteTitle = qr.room ? `Room service · Chambre ${qr.room}` : qr.self && !tableNo ? "Libre-service" : `Sur place · Table ${tableNo}`;
  const onsiteText = qr.room ? "Votre commande est préparée puis livrée dans votre chambre." : qr.self || restaurant.config.qr?.tableValidation ? "Votre commande sera vérifiée par notre équipe avant d'être envoyée en cuisine." : "Votre commande part directement en cuisine et vous est servie à table.";
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState("");
  const timing = timingOf(restaurant);
  const [openNow, setOpenNow] = useState(false);
  const [when, setWhen] = useState<"asap" | "later">(timing.asap ? "asap" : "later");
  const [f, setF] = useState({ customer_name: "", phone: "", email: "", address: "", postal_code: "", notes: "" });
  const [pay, setPay] = useState<"on_site" | "stripe" | "paypal" | "lyra" | "mollie">("on_site");
  const [busy, setBusy] = useState(false);
  const [cgv, setCgv] = useState(false);
  const [pro, setPro] = useState(false);
  const [bill, setBill] = useState({ company: "", siren: "", vatNumber: "", address: "", postalCode: "", city: "", email: "" });
  const setB = (k: keyof typeof bill) => (e: { target: { value: string } }) => setBill((b) => ({ ...b, [k]: k === "siren" ? e.target.value.replace(/\D/g, "").slice(0, 9) : k === "vatNumber" ? e.target.value.toUpperCase().replace(/\s/g, "") : e.target.value }));
  const proOk = !pro || (bill.company.trim().length >= 2 && /^\d{9}$/.test(bill.siren) && bill.address.trim().length >= 3 && /^\d{5}$/.test(bill.postalCode) && !!bill.city.trim());
  const infoFn = useServerFn(onlinePaymentInfo);
  const [online, setOnline] = useState<{ stripe: string | null; paypal: boolean; lyra: boolean; mollie: boolean }>({ stripe: null, paypal: false, lyra: false, mollie: false });
  const [payment, setPayment] = useState<{ id: string; clientSecret: string } | null>(null);
  const [promo, setPromo] = useState<{ d: AppliedDiscount | null; code?: string | undefined }>({ d: null });
  const onSiteOk = restaurant.config.payments?.on_site !== false;

  useEffect(() => {
    infoFn({ data: { slug: restaurant.slug } }).then((r) => {
      setOnline(r);
      if (!onSiteOk) setPay(r.stripe ? "stripe" : r.mollie ? "mollie" : r.paypal ? "paypal" : r.lyra ? "lyra" : "on_site");
    }).catch(() => {});
  }, [restaurant.slug, infoFn, onSiteOk]);

  useEffect(() => {
    const s = availableSlots(restaurant, mode);
    setSlots(s);
    setSlot(s[0] ?? "");
    const o = timingOf(restaurant).asap && isOpenNow(restaurant, mode);
    setOpenNow(o);
    if (!o) setWhen("later"); else if (!timingOf(restaurant).scheduled) setWhen("asap");
  }, [mode, restaurant]);
  const asap = when === "asap" && openNow;

  const geoZones = DELIVERY.geoZones ?? [];
  const geoFn = useServerFn(geocodeAddress);
  const [geo, setGeo] = useState<{ lat: number; lng: number; zone: GeoZone | null; label?: string | undefined } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const checkPoint = (lat: number, lng: number, label?: string) => setGeo({ lat, lng, zone: findZone([lat, lng], geoZones), label });
  const checkAddress = async () => {
    setGeoBusy(true);
    try { const r = await geoFn({ data: { q: `${f.address} ${f.postal_code}`.trim() } }); if (!r) toast.error("Adresse introuvable, précisez la rue et la ville."); else checkPoint(r.lat, r.lng, r.label); }
    catch (e) { toast.error((e as Error).message); } finally { setGeoBusy(false); }
  };
  const locateMe = () => {
    if (!navigator.geolocation) { toast.error("Géolocalisation indisponible"); return; }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition((p) => { checkPoint(p.coords.latitude, p.coords.longitude); setGeoBusy(false); }, () => { toast.error("Position refusée : saisissez votre adresse."); setGeoBusy(false); }, { enableHighAccuracy: true, timeout: 10000 });
  };
  const fee = mode === "delivery" ? (geoZones.length ? (geo?.zone ? zoneFee(geo.zone, subtotal) : 0) : deliveryFee(restaurant, subtotal)) : 0;
  const discount = promo.d?.discount ?? 0;
  const serviceFee = computeServiceFee(restaurant.config.serviceFee, subtotal, mode as ServiceFeeChannel);
  const total = Math.round((subtotal - discount + fee + serviceFee) * 100) / 100;
  const belowMin = mode === "delivery" && subtotal < (geoZones.length ? (geo?.zone?.minOrder ?? 0) : DELIVERY.minOrder);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const canSubmit = useMemo(
    () => table ? lines.length && f.customer_name.trim().length > 1 && f.phone.trim().length >= 8 : lines.length && (asap || (timing.scheduled && slot)) && f.customer_name.trim().length > 1 && f.phone.trim().length >= 8 && !belowMin &&
      (mode === "pickup" || (f.address.trim().length > 4 && (geoZones.length ? !!geo?.zone : f.postal_code))),
    [lines, slot, f, belowMin, mode, table, asap, timing.scheduled, geo, geoZones.length],
  );

  const submit = async () => {
    setBusy(true);
    let leaving = false;
    try {
      const res = await submitFn({
        data: {
          ...f, restaurant: restaurant.slug, ...(table ? { mode: "dine_in" as const, ...(tableNo ? { table: tableNo } : {}), ...(qr.room ? { room: qr.room } : {}), ...(qr.self ? { qr: "self" as const } : {}), slot: new Date().toISOString(), address: "", postal_code: "" } : { mode, slot: asap ? new Date().toISOString() : slot, asap, ...(mode === "delivery" && geo ? { lat: geo.lat, lng: geo.lng } : {}) }), ...(promo.code ? { promo_code: promo.code } : {}),
          payment_method: pay === "on_site" ? "on_site" : "online", cgv: true as const,
          ...(pro ? { billing: bill } : {}),
          origin: window.location.origin,
          ...(pay !== "on_site" ? { provider: pay } : {}),
          lines: lines.map((l) => ({ itemId: l.itemId, qty: l.qty, sel: l.sel })),
        },
      });
      if (res.clientSecret) { setPayment({ id: res.id, clientSecret: res.clientSecret }); return; }
      if (res.redirectUrl) { leaving = true; window.location.assign(res.redirectUrl); return; }
      if (res.form) {
        // Formulaire signé envoyé à la page de paiement sécurisée Lyra / PayZen
        leaving = true;
        const form = document.createElement("form");
        form.method = "POST"; form.action = res.form.action;
        for (const [k, v] of Object.entries(res.form.fields)) {
          const i = document.createElement("input"); i.type = "hidden"; i.name = k; i.value = v; form.appendChild(i);
        }
        document.body.appendChild(form); form.submit();
        return;
      }
      clear();
      navigate({ to: "/$slug/suivi/$id", params: { slug: restaurant.slug, id: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la commande");
    } finally {
      if (!leaving) setBusy(false);
    }
  };

  const options = [
    ...(onSiteOk ? [{ v: "on_site" as const, Icon: Store, t: table ? "À table / au comptoir" : mode === "delivery" ? "À la livraison" : "Au retrait", s: "Espèces, CB ou tickets resto", ok: true }] : []),
    { v: "stripe" as const, Icon: CreditCard, t: "Carte bancaire", s: online.stripe ? "Carte, Apple Pay, Google Pay" : "Non proposé par ce restaurant", ok: !!online.stripe },
    ...(online.mollie ? [{ v: "mollie" as const, Icon: CreditCard, t: "Carte · Bancontact · Apple Pay", s: "Page de paiement sécurisée Mollie", ok: true }] : []),
    ...(online.paypal ? [{ v: "paypal" as const, Icon: Wallet, t: "PayPal", s: "Compte PayPal ou carte via PayPal", ok: true }] : []),
    ...(online.lyra ? [{ v: "lyra" as const, Icon: Landmark, t: "Carte bancaire (banque)", s: "Page de paiement sécurisée Lyra / PayZen", ok: true }] : []),
  ].filter((o) => o.ok || (!online.paypal && !online.lyra && !online.mollie));

  if (!lines.length)
    return (
      <div className="min-h-screen"><SiteHeader hideCart />
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <p className="text-muted-foreground">Votre panier est vide.</p>
          <Button asChild className="mt-4"><Link to="/$slug" params={{ slug: restaurant.slug }}>Voir la carte</Link></Button>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen pb-16">
      <SiteHeader hideCart />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          {table ? <section className="rounded-xl border border-primary bg-primary/10 p-4"><h2 className="text-3xl">{onsiteTitle}</h2><p className="text-sm text-muted-foreground">{onsiteText}</p></section> : <>
          <section>
            <h2 className="text-3xl">1. Mode de retrait</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {([["pickup", "À emporter", "Click & collect", ShoppingBag], ["delivery", "Livraison", DELIVERY.zones.length || geoZones.length ? "Dans notre zone de livraison" : "Indisponible", Bike]] as const).filter(([v]) => modeEnabled(restaurant, v)).map(([v, t, s, Icon]) => (
                <button key={v} onClick={() => setMode(v)} className={cn("rounded-xl border p-4 text-left", mode === v ? "border-primary bg-primary/10" : "border-border")}>
                  <Icon className="mb-2 h-6 w-6 text-primary" />
                  <p className="font-semibold">{t}</p>
                  <p className="text-xs text-muted-foreground">{s}</p>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-3xl">2. Quand souhaitez-vous votre commande ?</h2>
            {(openNow || timing.scheduled) ? (
              <div role="radiogroup" aria-label="Moment de la commande" className="mt-3 grid grid-cols-2 gap-3">
                {openNow && (
                  <button type="button" role="radio" aria-checked={when === "asap"} onClick={() => setWhen("asap")} className={cn("rounded-xl border p-4 text-left", when === "asap" ? "border-primary bg-primary/10" : "border-border")}>
                    <Clock className="mb-2 h-6 w-6 text-primary" />
                    <p className="font-semibold">Dès que possible</p>
                    <p className="text-xs text-muted-foreground">Vers {fmtTime(asapSlot(restaurant, mode))} · heure confirmée par le restaurant</p>
                  </button>
                )}
                {timing.scheduled && (
                  <button type="button" role="radio" aria-checked={when === "later"} onClick={() => setWhen("later")} className={cn("rounded-xl border p-4 text-left", when === "later" ? "border-primary bg-primary/10" : "border-border")}>
                    <CalendarClock className="mb-2 h-6 w-6 text-primary" />
                    <p className="font-semibold">Choisir un horaire</p>
                    <p className="text-xs text-muted-foreground">{slots.length ? `${slots.length} créneau(x) aujourd'hui` : "Aucun créneau restant"}</p>
                  </button>
                )}
              </div>
            ) : null}
            {when === "later" && timing.scheduled && slots.length > 0 && (
              <div className="mt-3 max-w-xs">
                <Label htmlFor="slot-select">Horaire {mode === "delivery" ? "de livraison" : "de retrait"}</Label>
                <select id="slot-select" value={slot} onChange={(e) => setSlot(e.target.value)} className="mt-1 h-12 w-full rounded-lg border border-input bg-background px-3 text-base">
                  {slots.map((s) => <option key={s} value={s}>{fmtTime(s)}</option>)}
                </select>
              </div>
            )}
            {!openNow && (!timing.scheduled || !slots.length) && (
              <p className="mt-3 rounded-lg bg-card p-4 text-sm text-muted-foreground">Plus aucun créneau disponible aujourd'hui. {restaurant.config.hoursLabel ? `Horaires : ${restaurant.config.hoursLabel}.` : ""}</p>
            )}
          </section>
          </>}

          <section className="space-y-3">
            <h2 className="text-3xl">{table ? "Vos coordonnées" : "3. Vos coordonnées"}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="n">Nom *</Label><Input id="n" maxLength={80} value={f.customer_name} onChange={set("customer_name")} /></div>
              <div><Label htmlFor="p">Téléphone *</Label><Input id="p" type="tel" maxLength={20} value={f.phone} onChange={set("phone")} /></div>
              <div className="sm:col-span-2"><Label htmlFor="e">Email (pour la confirmation)</Label><Input id="e" type="email" maxLength={255} value={f.email} onChange={set("email")} /></div>
              {mode === "delivery" && !table && (
                <>
                  <div className="sm:col-span-2"><Label htmlFor="a">Adresse *</Label><Input id="a" maxLength={200} placeholder="N°, rue, bâtiment, étage…" value={f.address} onChange={(e) => { setGeo(null); set("address")(e); }} /></div>
                  {geoZones.length > 0 ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="cp">Code postal et ville *</Label>
                    <Input id="cp" maxLength={80} placeholder="31770 Colomiers" value={f.postal_code} onChange={(e) => { setGeo(null); set("postal_code")(e); }} />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" className="min-h-11" disabled={geoBusy || f.address.trim().length < 5} onClick={checkAddress}><MapPin /> Vérifier mon adresse</Button>
                      <Button type="button" variant="ghost" className="min-h-11" disabled={geoBusy} onClick={locateMe}><LocateFixed /> Me géolocaliser</Button>
                    </div>
                    {geo && (geo.zone
                      ? <p role="status" className="rounded-lg border border-primary bg-primary/10 p-3 text-sm">✓ Livrable — {geo.zone.name} · minimum {geo.zone.minOrder} € · frais {zoneFee(geo.zone, subtotal) ? `${zoneFee(geo.zone, subtotal).toFixed(2)} €` : "offerts"}</p>
                      : <p role="alert" className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm">Désolé, cette adresse est hors de notre zone de livraison.</p>)}
                  </div>
                  ) : (
                  <div className="sm:col-span-2">
                    <Label htmlFor="cp">Ville *</Label>
                    <select id="cp" value={f.postal_code} onChange={set("postal_code")} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">Choisir votre commune…</option>
                      {DELIVERY.zones.map((z) => <option key={z.cp} value={z.cp}>{z.cp} — {z.city}</option>)}
                    </select>
                  </div>
                  )}
                </>
              )}
              <div className="sm:col-span-2"><Label htmlFor="no">Remarques (allergies, digicode…)</Label><Textarea id="no" maxLength={500} value={f.notes} onChange={set("notes")} /></div>
              <div className="sm:col-span-2 rounded-lg border border-border p-3">
                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-medium">
                  <span>Commande professionnelle <span className="block text-xs font-normal opacity-70">Facture au nom de votre société (SIREN)</span></span>
                  <input type="checkbox" role="switch" aria-label="Commande professionnelle" className="h-6 w-6 accent-[var(--primary)]" checked={pro} onChange={(e) => setPro(e.target.checked)} />
                </label>
                {pro && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2"><Label htmlFor="bc">Raison sociale *</Label><Input id="bc" maxLength={120} value={bill.company} onChange={setB("company")} /></div>
                    <div><Label htmlFor="bs">SIREN (9 chiffres) *</Label><Input id="bs" inputMode="numeric" value={bill.siren} onChange={setB("siren")} aria-invalid={!!bill.siren && !/^\d{9}$/.test(bill.siren)} /></div>
                    <div><Label htmlFor="bv">N° TVA intracom.</Label><Input id="bv" maxLength={15} placeholder="FR…" value={bill.vatNumber} onChange={setB("vatNumber")} /></div>
                    <div className="sm:col-span-2"><Label htmlFor="ba">Adresse de facturation *</Label><Input id="ba" maxLength={200} value={bill.address} onChange={setB("address")} /></div>
                    <div><Label htmlFor="bp">Code postal *</Label><Input id="bp" inputMode="numeric" maxLength={5} value={bill.postalCode} onChange={setB("postalCode")} /></div>
                    <div><Label htmlFor="bt">Ville *</Label><Input id="bt" maxLength={80} value={bill.city} onChange={setB("city")} /></div>
                    <div className="sm:col-span-2"><Label htmlFor="be">Email de facturation</Label><Input id="be" type="email" maxLength={255} value={bill.email} onChange={setB("email")} /></div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-3xl">4. Paiement</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {options.map(({ v, Icon, t, s, ok }) => (
                <button key={v} disabled={!ok || !!payment} onClick={() => setPay(v)} className={cn("rounded-xl border p-4 text-left", !ok && "cursor-not-allowed opacity-50", pay === v ? "border-primary bg-primary/10" : "border-border")}>
                  <Icon className="mb-2 h-6 w-6 text-primary" />
                  <p className="font-semibold">{t}</p>
                  <p className="text-xs text-muted-foreground">{s}</p>
                </button>
              ))}
            </div>
            {(pay === "paypal" || pay === "lyra" || pay === "mollie") && <p className="mt-2 text-xs text-muted-foreground">Vous serez redirigé vers la page de paiement sécurisée, puis ramené au suivi de votre commande.</p>}
          </section>
        </div>

        <aside className="h-fit rounded-xl border border-border bg-card p-5 lg:sticky lg:top-20">
          <h2 className="text-3xl">Récapitulatif</h2>
          <CartLines />
          {!payment && <div className="mb-3"><PromoCodeField slug={restaurant.slug} subtotal={subtotal} channel="web" email={f.email} phone={f.phone} onChange={(d, code) => setPromo({ d, code })} /></div>}
          <div className="space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between"><span>Sous-total</span><span>{euro(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-primary"><span>{promo.d?.label}</span><span>-{euro(discount)}</span></div>}
            {serviceFee > 0 && <div className="flex justify-between"><span>{serviceFeeLabel(restaurant.config.serviceFee)}</span><span>{euro(serviceFee)}</span></div>}
            {mode === "delivery" && <div className="flex justify-between"><span>Livraison</span><span>{fee ? euro(fee) : "Offerte"}</span></div>}
            <div className="flex justify-between pt-2 text-lg font-bold"><span>Total</span><span className="text-primary">{euro(total)}</span></div>
          </div>
          {belowMin && <p className="mt-3 text-sm text-destructive">Minimum {DELIVERY.minOrder} € en livraison.</p>}
          {payment && online.stripe ? (
            <div className="mt-4">
              <StripePayment publishableKey={online.stripe} clientSecret={payment.clientSecret} label={`Payer ${euro(total)}`}
                returnUrl={`${window.location.origin}/${restaurant.slug}/suivi/${payment.id}`} onCancel={() => setPayment(null)} />
            </div>
          ) : (<>
            <label className="mt-4 flex min-h-11 items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]" checked={cgv} onChange={(e) => setCgv(e.target.checked)} />
              <span>J'accepte les <Link to="/$slug/cgv" params={{ slug: restaurant.slug }} target="_blank" className="underline">conditions générales de vente</Link> et la <Link to="/$slug/confidentialite" params={{ slug: restaurant.slug }} target="_blank" className="underline">politique de confidentialité</Link>.</span>
            </label>
            <Button size="lg" className="mt-4 w-full font-semibold" disabled={!canSubmit || !proOk || !cgv || busy || (pay === "on_site" && !onSiteOk)} onClick={submit}>
              {busy ? "Envoi…" : pay === "on_site" ? `Valider la commande · ${euro(total)}` : pay === "paypal" ? `Payer avec PayPal · ${euro(total)}` : `Continuer vers le paiement · ${euro(total)}`}
            </Button>
          </>)}
        </aside>
      </div>
    </div>
  );
}
