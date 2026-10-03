import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bike, ShoppingBag, CreditCard, Store } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { CartLines } from "@/components/CartSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/lib/cart";
import { euro } from "@/lib/menu";
import { availableSlots, deliveryFee, fmtTime } from "@/lib/shop";
import { createOrder } from "@/lib/orders.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/$slug/commande")({
  head: () => ({
    meta: [
      { title: "Finaliser ma commande" },
      { name: "description", content: "Choisissez click & collect ou livraison, votre créneau et votre mode de paiement." },
      { property: "og:title", content: "Finaliser ma commande" },
      { property: "og:description", content: "Click & collect ou livraison." },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { lines, subtotal, clear, restaurant } = useCart();
  const DELIVERY = restaurant.delivery;
  const navigate = useNavigate();
  const submitFn = useServerFn(createOrder);
  const [mode, setMode] = useState<"pickup" | "delivery">("pickup");
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState("");
  const [f, setF] = useState({ customer_name: "", phone: "", email: "", address: "", postal_code: "", notes: "" });
  const [pay, setPay] = useState<"on_site" | "online">("on_site");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = availableSlots(restaurant, mode);
    setSlots(s);
    setSlot(s[0] ?? "");
  }, [mode, restaurant]);

  const fee = mode === "delivery" ? deliveryFee(restaurant, subtotal) : 0;
  const total = subtotal + fee;
  const belowMin = mode === "delivery" && subtotal < DELIVERY.minOrder;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const canSubmit = useMemo(
    () => lines.length && slot && f.customer_name.trim().length > 1 && f.phone.trim().length >= 8 && !belowMin &&
      (mode === "pickup" || (f.address.trim().length > 4 && f.postal_code)),
    [lines, slot, f, belowMin, mode],
  );

  const submit = async () => {
    setBusy(true);
    try {
      const res = await submitFn({
        data: { ...f, restaurant: restaurant.slug, mode, slot, payment_method: pay, lines: lines.map((l) => ({ itemId: l.itemId, qty: l.qty, sel: l.sel })) },
      });
      clear();
      navigate({ to: "/$slug/suivi/$id", params: { slug: restaurant.slug, id: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la commande");
    } finally {
      setBusy(false);
    }
  };

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
              {([["pickup", "À emporter", "Click & collect", ShoppingBag], ["delivery", "Livraison", DELIVERY.zones.length ? "Dans notre zone de livraison" : "Indisponible", Bike]] as const).map(([v, t, s, Icon]) => (
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
              <button onClick={() => setPay("on_site")} className={cn("rounded-xl border p-4 text-left", pay === "on_site" ? "border-primary bg-primary/10" : "border-border")}>
                <Store className="mb-2 h-6 w-6 text-primary" />
                <p className="font-semibold">{mode === "delivery" ? "À la livraison" : "Au retrait"}</p>
                <p className="text-xs text-muted-foreground">Espèces, CB ou tickets resto</p>
              </button>
              <button disabled className="cursor-not-allowed rounded-xl border border-border p-4 text-left opacity-50">
                <CreditCard className="mb-2 h-6 w-6 text-primary" />
                <p className="font-semibold">Carte en ligne</p>
                <p className="text-xs text-muted-foreground">Bientôt disponible</p>
              </button>
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-xl border border-border bg-card p-5 lg:sticky lg:top-20">
          <h2 className="text-3xl">Récapitulatif</h2>
          <CartLines />
          <div className="space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between"><span>Sous-total</span><span>{euro(subtotal)}</span></div>
            {mode === "delivery" && <div className="flex justify-between"><span>Livraison</span><span>{fee ? euro(fee) : "Offerte"}</span></div>}
            <div className="flex justify-between pt-2 text-lg font-bold"><span>Total</span><span className="text-primary">{euro(total)}</span></div>
          </div>
          {belowMin && <p className="mt-3 text-sm text-destructive">Minimum {DELIVERY.minOrder} € en livraison.</p>}
          <Button size="lg" className="mt-4 w-full font-semibold" disabled={!canSubmit || busy} onClick={submit}>
            {busy ? "Envoi…" : `Valider la commande · ${euro(total)}`}
          </Button>
        </aside>
      </div>
    </div>
  );
}
