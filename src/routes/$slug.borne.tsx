import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, CreditCard, Minus, Plus, ShoppingBag, Trash2, UtensilsCrossed, Banknote } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart";
import { createKioskOrder } from "@/lib/orders.functions";
import { euro, groupCost, unitPrice, validateSelections, type MenuItem, type OptionGroup, type Selections } from "@/lib/menu";
import { itemImage, menuImage } from "@/lib/menu-images";
import { BrandLogo } from "@/lib/brand";
import welcomeFood from "@/assets/food-plateau.jpg";

export const Route = createFileRoute("/$slug/borne")({
  head: () => ({
    meta: [
      { title: "Borne de commande" },
      { name: "description", content: "Borne de commande tactile en restaurant." },
      { property: "og:title", content: "Borne de commande" },
      { property: "og:description", content: "Commandez sur place ou à emporter depuis la borne." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Kiosk,
});

const IDLE_MS = 60_000;
type Step = "welcome" | "menu" | "cart" | "pay" | "done";
type Mode = "dine_in" | "pickup";

function Kiosk() {
  const { restaurant, catalog, lines, add, setQty, clear, count, subtotal } = useCart();
  const send = useServerFn(createKioskOrder);
  const [step, setStep] = useState<Step>("welcome");
  const [mode, setMode] = useState<Mode>("dine_in");
  const [cat, setCat] = useState(catalog.categories[0]?.id ?? "");
  const [item, setItem] = useState<MenuItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ n: number; total: number; pay: string } | null>(null);
  const [warn, setWarn] = useState(false);
  const last = useRef(Date.now());

  const reset = useCallback(() => {
    clear(); setItem(null); setResult(null); setError(null); setWarn(false);
    setCat(catalog.categories[0]?.id ?? ""); setStep("welcome");
  }, [clear, catalog]);

  // Remise à zéro après inactivité
  useEffect(() => {
    const touch = () => { last.current = Date.now(); setWarn(false); };
    window.addEventListener("pointerdown", touch);
    const t = setInterval(() => {
      if (step === "welcome") return;
      const idle = Date.now() - last.current;
      const limit = step === "done" ? 15_000 : IDLE_MS;
      if (idle > limit) reset();
      else if (step !== "done" && idle > limit - 15_000) setWarn(true);
    }, 1000);
    return () => { window.removeEventListener("pointerdown", touch); clearInterval(t); };
  }, [step, reset]);

  // Vide un éventuel panier resté sur la borne au démarrage
  useEffect(() => { clear(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pay = async (payment_method: "counter" | "card_terminal") => {
    setBusy(true); setError(null);
    try {
      const row = await send({ data: { restaurant: restaurant.slug, mode, payment_method, lines: lines.map((l) => ({ itemId: l.itemId, qty: l.qty, sel: l.sel })) } });
      setResult({ n: row.order_number, total: Number(row.total), pay: payment_method });
      clear(); setStep("done"); last.current = Date.now();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur, merci de réessayer.");
    } finally { setBusy(false); }
  };

  const category = catalog.categories.find((c) => c.id === cat);

  return (
    <div className="fixed inset-0 z-50 flex select-none flex-col overflow-hidden bg-background text-foreground touch-manipulation">
      {step === "welcome" && (
        <div role="button" tabIndex={0} className="relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-10 overflow-hidden p-10 text-center" onClick={() => setStep("menu")}>
          <img src={welcomeFood} alt="" width={1024} height={768} className="absolute inset-0 h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-background/50" />
          <BrandLogo src={restaurant.logo_url} name={restaurant.name} className="relative h-40 w-40 object-contain" />
          <p className="relative font-display text-8xl text-primary">{restaurant.name}</p>
          <p className="relative text-3xl text-foreground">Bienvenue !</p>
          <span className="relative animate-pulse rounded-full bg-primary px-14 py-8 font-display text-5xl text-primary-foreground">Touchez pour commander</span>
          <div className="relative mt-6 grid w-full max-w-3xl grid-cols-2 gap-6" onClick={(e) => e.stopPropagation()}>
            {([["dine_in", "Sur place", UtensilsCrossed], ["pickup", "À emporter", ShoppingBag]] as const).map(([m, label, Icon]) => (
              <button key={m} onClick={() => { setMode(m); setStep("menu"); }}
                className="flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-card p-10 active:border-primary active:bg-primary/15">
                <Icon className="h-20 w-20 text-primary" />
                <span className="font-display text-5xl">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step !== "welcome" && step !== "done" && (
        <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <button onClick={reset} className="rounded-xl bg-muted px-6 py-4 text-xl font-semibold">Annuler</button>
          <p className="flex items-center gap-3 font-display text-4xl text-primary"><BrandLogo src={restaurant.logo_url} name={restaurant.name} className="h-12 w-12 object-contain" />{restaurant.name}</p>
          <div className="flex rounded-xl bg-muted p-1 text-lg font-semibold">
            {([["dine_in", "Sur place"], ["pickup", "À emporter"]] as const).map(([m, l]) => (
              <button key={m} onClick={() => setMode(m)} className={cn("rounded-lg px-5 py-3", mode === m && "bg-primary text-primary-foreground")}>{l}</button>
            ))}
          </div>
        </header>
      )}

      {step === "menu" && (
        <div className="flex min-h-0 flex-1">
          <nav className="w-60 shrink-0 overflow-y-auto border-r border-border p-3">
            {catalog.categories.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)}
                className={cn("mb-2 block w-full rounded-xl px-4 py-5 text-left text-xl font-semibold", c.id === cat ? "bg-primary text-primary-foreground" : "bg-card")}>
                {c.label}
              </button>
            ))}
          </nav>
          <main className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="mb-4 flex items-center justify-between gap-4 border-b border-border pb-3">
              <h2 className="font-display text-5xl">{category?.label}</h2>
              {category && menuImage(category.id) && <img src={menuImage(category.id)} alt={`Illustration ${category.label}`} loading="lazy" width={1024} height={768} className="h-28 w-40 rounded-md object-cover" />}
            </div>
            {category?.note && <p className="mb-4 text-lg text-muted-foreground">{category.note}</p>}
            <div className="grid grid-cols-2 gap-4 pb-32 xl:grid-cols-3">
              {category?.items.map((it) => (
                <button key={it.id} onClick={() => it.options?.length ? setItem(it) : add(it.id, {}, 1)}
                  className="flex min-h-40 flex-col justify-between rounded-2xl border-2 border-border bg-card p-5 text-left active:border-primary">
                  <span>
                    <span className="block text-2xl font-semibold leading-tight">{it.name}</span>
                    {it.desc && <span className="mt-1 line-clamp-2 block text-base text-muted-foreground">{it.desc}</span>}
                  </span>
                  <span className="mt-3 flex items-center justify-between">
                    <span className="font-display text-3xl text-primary">{euro(it.price)}</span>
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground"><Plus className="h-8 w-8" /></span>
                  </span>
                </button>
              ))}
            </div>
          </main>
        </div>
      )}

      {step === "menu" && count > 0 && (
        <button onClick={() => setStep("cart")}
          className="absolute bottom-6 right-6 flex items-center gap-5 rounded-2xl bg-accent px-10 py-6 font-display text-4xl text-accent-foreground shadow-2xl">
          <ShoppingBag className="h-10 w-10" /> Panier ({count}) · {euro(subtotal)}
        </button>
      )}

      {step === "cart" && (
        <div className="flex min-h-0 flex-1 flex-col p-6">
          <button onClick={() => setStep("menu")} className="mb-4 flex items-center gap-2 self-start rounded-xl bg-muted px-6 py-4 text-xl font-semibold"><ChevronLeft /> Continuer mes achats</button>
          <h2 className="mb-4 font-display text-6xl">Mon panier</h2>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            {lines.length === 0 && <p className="text-2xl text-muted-foreground">Votre panier est vide.</p>}
            {lines.map((l) => {
              const it = catalog.itemsById[l.itemId];
              if (!it) return null;
              return (
                <div key={l.key} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-2xl font-semibold">{it.name}</p>
                    <p className="text-lg text-primary">{euro(unitPrice(it, l.sel) * l.qty)}</p>
                  </div>
                  <button onClick={() => setQty(l.key, l.qty - 1)} className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted" aria-label="Moins">{l.qty === 1 ? <Trash2 className="h-7 w-7" /> : <Minus className="h-8 w-8" />}</button>
                  <span className="w-12 text-center font-display text-4xl">{l.qty}</span>
                  <button onClick={() => setQty(l.key, l.qty + 1)} className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-label="Plus"><Plus className="h-8 w-8" /></button>
                </div>
              );
            })}
          </div>
          <button disabled={!count} onClick={() => setStep("pay")}
            className="mt-6 rounded-2xl bg-accent py-8 font-display text-5xl text-accent-foreground disabled:opacity-40">
            Payer · {euro(subtotal)}
          </button>
        </div>
      )}

      {step === "pay" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 p-10">
          <h2 className="font-display text-6xl">Comment souhaitez-vous payer ?</h2>
          <p className="text-3xl">Total : <span className="font-display text-primary">{euro(subtotal)}</span></p>
          <div className="grid w-full max-w-4xl grid-cols-2 gap-6">
            <button disabled={busy} onClick={() => pay("counter")} className="flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-card p-10 active:border-primary disabled:opacity-50">
              <Banknote className="h-20 w-20 text-primary" />
              <span className="font-display text-4xl">Payer au comptoir</span>
              <span className="text-lg text-muted-foreground">Espèces · Tickets resto</span>
            </button>
            <button disabled={busy} onClick={() => pay("card_terminal")} className="flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-card p-10 active:border-primary disabled:opacity-50">
              <CreditCard className="h-20 w-20 text-primary" />
              <span className="font-display text-4xl">Carte bancaire</span>
              <span className="text-lg text-muted-foreground">Sur le terminal au comptoir</span>
            </button>
          </div>
          {error && <p className="text-2xl text-destructive">{error}</p>}
          <button onClick={() => setStep("cart")} className="rounded-xl bg-muted px-8 py-5 text-xl font-semibold">Retour au panier</button>
        </div>
      )}

      {step === "done" && result && (
        <button onClick={reset} className="flex flex-1 flex-col items-center justify-center gap-6 p-10 text-center">
          <Check className="h-24 w-24 text-primary" />
          <p className="text-4xl">Merci ! Votre numéro de commande</p>
          <p className="font-display text-[12rem] leading-none text-primary">{result.n}</p>
          <p className="text-3xl">{mode === "dine_in" ? "Sur place" : "À emporter"} · {euro(result.total)}</p>
          <p className="max-w-3xl text-2xl text-muted-foreground">
            {result.pay === "counter" ? "Présentez-vous au comptoir pour régler (espèces ou tickets resto)." : "Présentez-vous au comptoir pour régler par carte."} Nous appellerons votre numéro dès que c'est prêt.
          </p>
          <span className="mt-6 rounded-xl bg-muted px-8 py-4 text-xl">Toucher pour terminer</span>
        </button>
      )}

      {item && <KioskItem item={item} image={itemImage(item.id, catalog.categories)} onClose={() => setItem(null)} onAdd={(sel, q) => { add(item.id, sel, q); setItem(null); }} />}

      {warn && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="font-display text-5xl">Êtes-vous toujours là ?</p>
            <p className="mt-4 text-2xl text-muted-foreground">Touchez l'écran pour continuer votre commande.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function KioskItem({ item, image, onClose, onAdd }: { item: MenuItem; image: string | undefined; onClose: () => void; onAdd: (sel: Selections, qty: number) => void }) {
  const [sel, setSel] = useState<Selections>({});
  const [qty, setQ] = useState(1);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const groups = item.options ?? [];
  const stepped = !!item.builder;
  const visible = stepped ? groups.slice(step, step + 1) : groups;
  const isLast = !stepped || step === groups.length - 1;
  const price = unitPrice(item, sel);
  const toggle = (g: OptionGroup, id: string) => setSel((p) => {
    const cur = p[g.id] ?? [];
    if (g.max === 1) return { ...p, [g.id]: [id] };
    if (cur.includes(id)) return { ...p, [g.id]: cur.filter((x) => x !== id) };
    if (cur.length >= g.max) return p;
    return { ...p, [g.id]: [...cur, id] };
  });
  const submit = () => { const e = validateSelections(item, sel); if (e) setErr(e); else onAdd(sel, qty); };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <button onClick={stepped && step > 0 ? () => setStep(step - 1) : onClose} className="flex items-center gap-2 rounded-xl bg-muted px-6 py-4 text-xl font-semibold"><ChevronLeft /> Retour</button>
        <p className="font-display text-4xl">{item.name}</p>
        <span className="w-32" />
      </div>
      {stepped && <div className="flex gap-2 px-6 pt-4">{groups.map((g, i) => <div key={g.id} className={cn("h-2 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />)}</div>}
      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-6">
        {image && <div className="flex items-center gap-4"><img src={image} alt={`Illustration pour ${item.name}`} loading="lazy" width={1024} height={768} className="h-32 w-44 rounded-md object-cover" /><span className="text-base text-muted-foreground">Photo d’illustration</span></div>}
        {visible.map((g) => {
          const picked = sel[g.id] ?? [];
          const extra = groupCost(g, picked);
          return (
            <section key={g.id}>
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="text-3xl font-semibold">{g.label}</h3>
                <span className="text-lg text-muted-foreground">{g.min === g.max ? `${g.min} choix` : `${g.min ? `min ${g.min} · ` : ""}max ${g.max}`}{extra > 0 ? ` · +${euro(extra)}` : ""}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {g.choices.map((c) => {
                  const on = picked.includes(c.id);
                  return (
                    <button key={c.id} onClick={() => toggle(g, c.id)}
                      className={cn("flex min-h-24 items-center justify-between gap-2 rounded-xl border-2 px-4 py-4 text-left text-xl", on ? "border-primary bg-primary/15" : "border-border bg-card")}>
                      <span>{c.label}{c.price ? <span className="block text-base text-primary">+{euro(c.price)}</span> : null}</span>
                      {on && <Check className="h-7 w-7 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {err && <p className="px-6 text-xl text-destructive">{err}</p>}
      <div className="flex items-center justify-between gap-4 border-t border-border p-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setQ(Math.max(1, qty - 1))} className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted" aria-label="Moins"><Minus className="h-8 w-8" /></button>
          <span className="w-12 text-center font-display text-4xl">{qty}</span>
          <button onClick={() => setQ(qty + 1)} className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted" aria-label="Plus"><Plus className="h-8 w-8" /></button>
        </div>
        {isLast ? (
          <button onClick={submit} className="rounded-2xl bg-primary px-12 py-6 font-display text-4xl text-primary-foreground">Ajouter · {euro(price * qty)}</button>
        ) : (
          <button disabled={(sel[groups[step]!.id] ?? []).length < groups[step]!.min} onClick={() => { setErr(null); setStep(step + 1); }}
            className="rounded-2xl bg-primary px-12 py-6 font-display text-4xl text-primary-foreground disabled:opacity-40">Suivant · {euro(price)}</button>
        )}
      </div>
    </div>
  );
}
