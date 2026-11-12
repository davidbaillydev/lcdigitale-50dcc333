import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, CreditCard, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ItemConfigurator } from "@/components/ItemDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { listAgencyRestaurants } from "@/lib/agency.functions";
import { loadRestaurantAdmin } from "@/lib/restaurant-settings.functions";
import { createAdminTestOrder } from "@/lib/orders.functions";
import { getCatalog } from "@/lib/catalogs";
import { withOptions, loadOptionData, EMPTY_OPTIONS } from "@/lib/menu-options";
import { euro, unitPrice, type Selections } from "@/lib/menu";

export const Route = createFileRoute("/_authenticated/admin/commande-test")({
  head: () => ({
    meta: [
      { title: "Commande test (Livraison, Retrait, Sur place) — Console agence" },
      { name: "description", content: "Passer une commande test en livraison, retrait ou sur place, payée par CB simulée, réservée à l'agence." },
      { property: "og:title", content: "Commande test (Livraison, Retrait, Sur place)" },
      { property: "og:description", content: "Commande test CB simulée envoyée en cuisine et aux livreurs." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type Mode = "delivery" | "pickup" | "dine_in";
const MODES: { value: Mode; label: string; cta: string }[] = [
  { value: "delivery", label: "Livraison", cta: "Commander en livraison (CB Test)" },
  { value: "pickup", label: "À emporter", cta: "Commander en retrait (CB Test)" },
  { value: "dine_in", label: "Sur place", cta: "Commander sur place (CB Test)" },
];

type Line = { key: string; itemId: string; sel: Selections; qty: number };

function Page() {
  const list = useServerFn(listAgencyRestaurants);
  const { data: restaurants } = useQuery({ queryKey: ["agency-restaurants-test"], queryFn: () => list() });
  const [slug, setSlug] = useState("");
  const active = (restaurants ?? []).filter((r) => r.active);
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <Button variant="ghost" asChild><Link to="/admin"><ArrowLeft />Console agence</Link></Button>
      <div>
        <h1 className="text-3xl font-semibold">Commande test (Livraison, Retrait, Sur place)</h1>
        <p className="text-muted-foreground">Commande réelle envoyée en cuisine et aux livreurs, marquée « CB Test (Admin) » : payée par carte simulée, aucun encaissement, exclue des ventes et commissions.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="resto">Restaurant</Label>
        <select id="resto" className="h-12 w-full rounded-md border border-input bg-background px-3" value={slug} onChange={(e) => setSlug(e.target.value)}>
          <option value="">Choisir un restaurant…</option>
          {active.map((r) => <option key={r.id} value={r.slug}>{r.name}{r.city ? ` — ${r.city}` : ""}</option>)}
        </select>
      </div>
      {slug && <OrderForm key={slug} slug={slug} />}
    </main>
  );
}

function OrderForm({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const load = useServerFn(loadRestaurantAdmin);
  const create = useServerFn(createAdminTestOrder);
  const { data: r } = useQuery({ queryKey: ["test-order-restaurant", slug], queryFn: () => load({ data: { slug } }) });
  const { data: options } = useQuery({ enabled: !!r, queryKey: ["test-order-options", r?.id], queryFn: () => loadOptionData(supabase, r!.id) });
  const catalog = useMemo(() => (r ? withOptions(getCatalog(r), options ?? EMPTY_OPTIONS) : null), [r, options]);
  const [lines, setLines] = useState<Line[]>([]);
  const [item, setItem] = useState<string | null>(null);
  const [f, setF] = useState({ first_name: "Test", last_name: "Agence", phone: "0600000000", address: "", postal_code: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("delivery");
  const [table, setTable] = useState("1");
  if (!r || !catalog) return <p className="text-muted-foreground">Chargement de la carte…</p>;

  const subtotal = lines.reduce((s, l) => { const it = catalog.itemsById[l.itemId]; return s + (it ? unitPrice(it, l.sel) * l.qty : 0); }, 0);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    if (!lines.length) { toast.error("Ajoutez au moins un plat."); return; }
    if (mode === "dine_in" && !/^\d{1,3}$/.test(table.trim())) { toast.error("Numéro de table invalide."); return; }
    if (mode === "delivery" && (!f.address.trim() || !/^\d{5}$/.test(f.postal_code.trim()))) { toast.error("Adresse et code postal (5 chiffres) obligatoires."); return; }
    setBusy(true);
    try {
      const res = await create({ data: { restaurant: slug, mode, asap: true, slot: "", ...f, ...(mode === "delivery" ? {} : { address: "", postal_code: "" }), ...(mode === "dine_in" ? { table: table.trim() } : {}), payment_method: "online", cgv: true, lines: lines.map(({ itemId, qty, sel }) => ({ itemId, qty, sel })) } }) as { id: string; order_number: number };
      toast.success(`Commande test n°${res.order_number} envoyée en cuisine (CB Test).`);
      setLines([]);
      void navigate({ to: "/espace/$slug", params: { slug } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Échec de la commande test"); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-4">
        {catalog.categories.map((c) => c.items.filter((i) => !i.hidden).length > 0 && (
          <div key={c.id}>
            <h2 className="mb-2 font-semibold">{c.label}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {c.items.filter((i) => !i.hidden).map((i) => (
                <button key={i.id} type="button" onClick={() => setItem(i.id)} className="flex min-h-14 items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-left hover:bg-accent">
                  <span>{i.name}</span><span className="text-sm text-muted-foreground">{euro(i.price)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
      <aside className="space-y-4 rounded-lg border border-border bg-card p-4 lg:sticky lg:top-4 lg:self-start">
        <div role="radiogroup" aria-label="Mode de commande" className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
          {MODES.map((m) => (
            <button key={m.value} type="button" role="radio" aria-checked={mode === m.value} onClick={() => setMode(m.value)} className={`min-h-11 rounded px-1 text-sm font-medium leading-tight ${mode === m.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>{m.label}</button>
          ))}
        </div>
        <h2 className="font-semibold">Panier test</h2>
        {lines.length === 0 ? <p className="text-sm text-muted-foreground">Aucun plat.</p> : lines.map((l) => {
          const it = catalog.itemsById[l.itemId];
          return (
            <div key={l.key} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{it?.name}</span>
              <Button size="icon" variant="ghost" aria-label="Moins" onClick={() => setLines(lines.flatMap((x) => x.key !== l.key ? [x] : x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []))}><Minus /></Button>
              <span>{l.qty}</span>
              <Button size="icon" variant="ghost" aria-label="Plus" onClick={() => setLines(lines.map((x) => x.key === l.key ? { ...x, qty: x.qty + 1 } : x))}><Plus /></Button>
              <Button size="icon" variant="ghost" aria-label="Retirer" onClick={() => setLines(lines.filter((x) => x.key !== l.key))}><Trash2 /></Button>
            </div>
          );
        })}
        <p className="text-sm">Sous-total : <strong>{euro(subtotal)}</strong> <span className="text-muted-foreground">(frais recalculés au serveur)</span></p>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Prénom</Label><Input value={f.first_name} onChange={set("first_name")} /></div>
          <div><Label>Nom</Label><Input value={f.last_name} onChange={set("last_name")} /></div>
        </div>
        <div><Label>Téléphone</Label><Input value={f.phone} onChange={set("phone")} /></div>
        {mode === "delivery" && <>
          <div><Label htmlFor="t-addr">Adresse de livraison *</Label><Input id="t-addr" value={f.address} onChange={set("address")} placeholder={r.address ?? ""} required /></div>
          <div><Label htmlFor="t-cp">Code postal *</Label><Input id="t-cp" value={f.postal_code} onChange={set("postal_code")} inputMode="numeric" required /></div>
        </>}
        {mode === "pickup" && <p className="text-sm text-muted-foreground">Retrait au restaurant : aucune adresse requise.</p>}
        {mode === "dine_in" && <div><Label htmlFor="t-table">Numéro de table</Label><Input id="t-table" value={table} onChange={(e) => setTable(e.target.value)} inputMode="numeric" /></div>}
        <div><Label>Note</Label><Input value={f.notes} onChange={set("notes")} /></div>
        <Button className="min-h-12 w-full" disabled={busy} onClick={() => void submit()}><CreditCard />{busy ? "Envoi…" : MODES.find((m) => m.value === mode)!.cta}</Button>
      </aside>
      <ItemConfigurator item={item ? catalog.itemsById[item] ?? null : null} catalog={catalog} onClose={() => setItem(null)} onAdd={(id, sel, qty) => { setLines([...lines, { key: crypto.randomUUID(), itemId: id, sel, qty }]); setItem(null); }} />
    </div>
  );
}
