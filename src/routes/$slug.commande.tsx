import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bike, ShoppingBag, CreditCard, Store, Wallet, Landmark } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { CartLines } from "@/components/CartSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/lib/cart";
import { euro } from "@/lib/menu";
import { availableSlots, deliveryFee, fmtTime, modeEnabled } from "@/lib/shop";
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
  const { lines, subtotal, clear, restaurant } = useCart();
  const DELIVERY = restaurant.delivery;
  const navigate = useNavigate();
  const submitFn = useServerFn(createOrder);
  const [mode, setMode] = useState<"pickup" | "delivery">(modeEnabled(restaurant, "pickup") ? "pickup" : "delivery");
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState("");
  const [f, setF] = useState({ customer_name: "", phone: "", email: "", address: "", postal_code: "", notes: "" });
  const [pay, setPay] = useState<"on_site" | "stripe" | "paypal" | "lyra">("on_site");
  const [busy, setBusy] = useState(false);
  const infoFn = useServerFn(onlinePaymentInfo);
  const [online, setOnline] = useState<{ stripe: string | null; paypal: boolean; lyra: boolean }>({ stripe: null, paypal: false, lyra: false });
  const [payment, setPayment] = useState<{ id: string; clientSecret: string } | null>(null);
  const [promo, setPromo] = useState<{ d: AppliedDiscount | null; code?: string | undefined }>({ d: null });
  const onSiteOk = restaurant.config.payments?.on_site !== false;

  useEffect(() => {
    infoFn({ data: { slug: restaurant.slug } }).then((r) => {
      setOnline(r);
      if (!onSiteOk) setPay(r.stripe ? "stripe" : r.paypal ? "paypal" : r.lyra ? "lyra" : "on_site");
    }).catch(() => {});
  }, [restaurant.slug, infoFn, onSiteOk]);

  useEffect(() => {
    const s = availableSlots(restaurant, mode);
    setSlots(s);
    setSlot(s[0] ?? "");
  }, [mode, restaurant]);

  const fee = mode === "delivery" ? deliveryFee(restaurant, subtotal) : 0;
  const discount = promo.d?.discount ?? 0;
  const total = subtotal - discount + fee;
  const belowMin = mode === "delivery" && subtotal < DELIVERY.minOrder;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const canSubmit = useMemo(
    () => lines.length && slot && f.customer_name.trim().length > 1 && f.phone.trim().length >= 8 && !belowMin &&
      (mode === "pickup" || (f.address.trim().length > 4 && f.postal_code)),
    [lines, slot, f, belowMin, mode],
  );

  const submit = async () => {
    setBusy(true);
    let leaving = false;
    try {
      const res = await submitFn({
        data: {
          ...f, restaurant: restaurant.slug, mode, slot, ...(promo.code ? { promo_code: promo.code } : {}),
          payment_method: pay === "on_site" ? "on_site" : "online",
          ...(pay !== "on_site" ? { provider: pay, origin: window.location.origin } : {}),
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
    ...(onSiteOk ? [{ v: "on_site" as const, Icon: Store, t: mode === "delivery" ? "À la livraison" : "Au retrait", s: "Espèces, CB ou tickets resto", ok: true }] : []),
    { v: "stripe" as const, Icon: CreditCard, t: "Carte bancaire", s: online.stripe ? "Carte, Apple Pay, Google Pay" : "Non proposé par ce restaurant", ok: !!online.stripe },
    ...(online.paypal ? [{ v: "paypal" as const, Icon: Wallet, t: "PayPal", s: "Compte PayPal ou carte via PayPal", ok: true }] : []),
    ...(online.lyra ? [{ v: "lyra" as const, Icon: Landmark, t: "Carte bancaire (banque)", s: "Page de paiement sécurisée Lyra / PayZen", ok: true }] : []),
  ].filter((o) => o.ok || (!online.paypal && !online.lyra));

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
          <section>
            <h2 className="text-3xl">1. Mode de retrait</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {([["pickup", "À emporter", "Click & collect", ShoppingBag], ["delivery", "Livraison", DELIVERY.zones.length ? "Dans notre zone de livraison" : "Indisponible", Bike]] as const).filter(([v]) => modeEnabled(restaurant, v)).map(([v, t, s, Icon]) => (
                <button key={v} onClick={() => setMode(v)} className={cn("rounded-xl border p-4 text-left", mode === v ? "border-primary bg-primary/10" : "border-border")}>
                  <Icon className="mb-2 h-6 w-6 text-primary" />
                  <p className="font-semibold">{t}</p>
                  <p className="text-xs text-muted-foreground">{s}</p>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-3xl">2. Créneau {mode === "delivery" ? "de livraison" : "de retrait"}</h2>
            {slots.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button key={s} onClick={() => setSlot(s)} className={cn("rounded-lg border px-4 py-2 text-sm font-semibold", slot === s ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                    {fmtTime(s)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-lg bg-card p-4 text-sm text-muted-foreground">Plus aucun créneau disponible aujourd'hui. {restaurant.config.hoursLabel ? `Horaires : ${restaurant.config.hoursLabel}.` : ""}</p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-3xl">3. Vos coordonnées</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="n">Nom *</Label><Input id="n" maxLength={80} value={f.customer_name} onChange={set("customer_name")} /></div>
              <div><Label htmlFor="p">Téléphone *</Label><Input id="p" type="tel" maxLength={20} value={f.phone} onChange={set("phone")} /></div>
              <div className="sm:col-span-2"><Label htmlFor="e">Email (pour la confirmation)</Label><Input id="e" type="email" maxLength={255} value={f.email} onChange={set("email")} /></div>
              {mode === "delivery" && (
                <>
                  <div className="sm:col-span-2"><Label htmlFor="a">Adresse *</Label><Input id="a" maxLength={200} placeholder="N°, rue, bâtiment, étage…" value={f.address} onChange={set("address")} /></div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="cp">Ville *</Label>
                    <select id="cp" value={f.postal_code} onChange={set("postal_code")} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">Choisir votre commune…</option>
                      {DELIVERY.zones.map((z) => <option key={z.cp} value={z.cp}>{z.cp} — {z.city}</option>)}
                    </select>
                  </div>
                </>
              )}
              <div className="sm:col-span-2"><Label htmlFor="no">Remarques (allergies, digicode…)</Label><Textarea id="no" maxLength={500} value={f.notes} onChange={set("notes")} /></div>
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
            {(pay === "paypal" || pay === "lyra") && <p className="mt-2 text-xs text-muted-foreground">Vous serez redirigé vers la page de paiement sécurisée, puis ramené au suivi de votre commande.</p>}
          </section>
        </div>

        <aside className="h-fit rounded-xl border border-border bg-card p-5 lg:sticky lg:top-20">
          <h2 className="text-3xl">Récapitulatif</h2>
          <CartLines />
          {!payment && <div className="mb-3"><PromoCodeField slug={restaurant.slug} subtotal={subtotal} channel="web" email={f.email} phone={f.phone} onChange={(d, code) => setPromo({ d, code })} /></div>}
          <div className="space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between"><span>Sous-total</span><span>{euro(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-primary"><span>{promo.d?.label}</span><span>-{euro(discount)}</span></div>}
            {mode === "delivery" && <div className="flex justify-between"><span>Livraison</span><span>{fee ? euro(fee) : "Offerte"}</span></div>}
            <div className="flex justify-between pt-2 text-lg font-bold"><span>Total</span><span className="text-primary">{euro(total)}</span></div>
          </div>
          {belowMin && <p className="mt-3 text-sm text-destructive">Minimum {DELIVERY.minOrder} € en livraison.</p>}
          {payment && online.stripe ? (
            <div className="mt-4">
              <StripePayment publishableKey={online.stripe} clientSecret={payment.clientSecret} label={`Payer ${euro(total)}`}
                returnUrl={`${window.location.origin}/${restaurant.slug}/suivi/${payment.id}`} onCancel={() => setPayment(null)} />
            </div>
          ) : (
            <Button size="lg" className="mt-4 w-full font-semibold" disabled={!canSubmit || busy || (pay === "on_site" && !onSiteOk)} onClick={submit}>
              {busy ? "Envoi…" : pay === "on_site" ? `Valider la commande · ${euro(total)}` : pay === "paypal" ? `Payer avec PayPal · ${euro(total)}` : `Continuer vers le paiement · ${euro(total)}`}
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}
