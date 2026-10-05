import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { ChefHat, ExternalLink, LogOut, Pencil, Plus, Settings, Tablet, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/use-staff";
import { listAgencyRestaurants, saveRestaurant, setRestaurantActive, type AgencyRestaurant } from "@/lib/agency.functions";
import { MENU_KEYS, MENU_LABELS } from "@/lib/catalogs";
import { inviteMember } from "@/lib/staff.functions";
import { brandVars, BrandLogo, fileToLogo } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Console Agence LC Digitale — Réseau de restaurants" },
      { name: "description", content: "Console agence : créer, personnaliser et piloter les restaurants partenaires." },
      { property: "og:title", content: "Console Agence LC Digitale" },
      { property: "og:description", content: "Gestion du réseau de restaurants partenaires." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Console,
});

type Form = Omit<AgencyRestaurant, "id" | "orders_today"> & { id?: string };
const EMPTY: Form = { name: "", slug: "", city: "", address: "", phone: "", email: "", menu_key: MENU_KEYS[0] ?? "", logo_url: null, brand: { primary: "#d4a017", accent: "#c8102e" }, active: true };
const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function Console() {
  const { loading, user, isAgency } = useStaff();
  const navigate = useNavigate();
  const list = useServerFn(listAgencyRestaurants);
  const toggle = useServerFn(setRestaurantActive);
  const [rows, setRows] = useState<AgencyRestaurant[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(() => list().then(setRows).catch((e) => toast.error(e.message)), [list]);
  useEffect(() => { if (isAgency) load(); }, [isAgency, load]);

  if (loading || !user) return <p className="p-10 text-center text-muted-foreground">Chargement…</p>;
  if (!isAgency) return (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-4xl">Réservé à l'agence</h1>
      <Button asChild className="mt-6"><Link to="/espace">Mes restaurants</Link></Button>
    </div>
  );

  const active = rows?.filter((r) => r.active).length ?? 0;
  const today = rows?.reduce((s, r) => s + r.orders_today, 0) ?? 0;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap">
        <div className="col-span-2 min-w-0 sm:mr-auto">
          <p className="text-sm font-semibold text-primary">Réseau de restaurants</p>
          <h1 className="text-5xl">Console agence</h1>
        </div>
        <Button variant="secondary" asChild><Link to="/espace/tableau-de-bord">Tableau de bord</Link></Button>
        <Button className="min-w-0" onClick={() => setForm({ ...EMPTY })}><Plus /> Nouveau restaurant</Button>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/connexion", replace: true }); }} aria-label="Déconnexion"><LogOut /></Button>
      </header>
      <Input className="mt-6" placeholder="Rechercher un restaurant (nom, ville, adresse web)…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />

      <div className="admin-metrics mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {[["Restaurants", rows?.length ?? 0], ["En ligne", active], ["Commandes aujourd'hui", today]].map(([l, v]) => (
          <div key={l} className="border-b border-border pb-5">
            <p className="text-sm text-muted-foreground">{l}</p><p className="font-display text-4xl">{v}</p>
          </div>
        ))}
      </div>

      {!rows ? <p className="mt-10 text-center text-muted-foreground">Chargement du réseau…</p> : (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {rows.filter((r) => `${r.name} ${r.city ?? ""} ${r.slug}`.toLowerCase().includes(q.toLowerCase())).map((r) => (
            <article key={r.id} className="admin-restaurant-card rounded-lg border border-border bg-card p-4 sm:p-6">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 lg:flex lg:flex-wrap lg:gap-4">
                {r.logo_url ? <BrandLogo src={r.logo_url} name={r.name} className="h-14 w-14 shrink-0 rounded-lg object-contain" />
                  : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-3xl text-primary-foreground">{r.name[0]}</div>}
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-2xl font-semibold">{r.name}</h2>
                  <p className="break-words text-sm text-muted-foreground">/{r.slug} · {r.city ?? "—"} · {r.orders_today} cmd aujourd'hui</p>
                  <div style={brandVars(r.brand)} className="mt-3 flex gap-1" aria-label="Couleurs du restaurant">
                    <span className="h-4 w-8 rounded bg-primary" /><span className="h-4 w-8 rounded bg-accent" />
                  </div>
                </div>
                <label className="col-span-2 flex shrink-0 items-center gap-2 border-t border-border pt-3 text-sm lg:border-0 lg:pt-0">
                  <Switch checked={r.active} onCheckedChange={async (v) => {
                    setRows((p) => p?.map((x) => (x.id === r.id ? { ...x, active: v } : x)) ?? null);
                    try { await toggle({ data: { id: r.id, active: v } }); toast.success(v ? "Restaurant en ligne" : "Restaurant désactivé"); }
                    catch (e) { toast.error((e as Error).message); load(); }
                  }} aria-label={`Activer ${r.name}`} />
                  {r.active ? "En ligne" : "Hors ligne"}
                </label>
              </div>
              <div className="admin-card-actions mt-5 grid grid-cols-2 gap-2 border-t border-border pt-4 sm:flex sm:flex-wrap">
                <Button size="sm" variant="secondary" asChild><a href={`/${r.slug}`} target="_blank" rel="noreferrer"><ExternalLink /> Site</a></Button>
                <Button size="sm" variant="secondary" asChild><a href={`/${r.slug}/borne`} target="_blank" rel="noreferrer"><Tablet /> Borne</a></Button>
                <Button size="sm" variant="secondary" asChild><Link to="/espace/$slug" params={{ slug: r.slug }}><ChefHat /> Cuisine</Link></Button>
                <Button size="sm" variant="secondary" asChild><Link to="/espace/$slug/equipe" params={{ slug: r.slug }}><Users /> Équipe</Link></Button>
                <Button size="sm" variant="secondary" asChild><Link to="/espace/$slug/carte" params={{ slug: r.slug }}>Carte</Link></Button>
                <Button size="sm" variant="secondary" asChild><Link to="/espace/$slug/clients" params={{ slug: r.slug }}>Clients</Link></Button>
                <Button size="sm" variant="secondary" asChild><Link to="/admin/$slug" params={{ slug: r.slug }}><Settings /> Réglages</Link></Button>
                <Button size="sm" onClick={() => setForm({ ...r })}><Pencil /> Modifier</Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <RestaurantDialog form={form} setForm={setForm} onSaved={(slug, created) => { load(); if (created) navigate({ to: "/admin/$slug", params: { slug } }); }} />
    </div>
  );
}

function RestaurantDialog({ form, setForm, onSaved }: { form: Form | null; setForm: (f: Form | null) => void; onSaved: (slug: string, created: boolean) => void }) {
  const save = useServerFn(saveRestaurant);
  const invite = useServerFn(inviteMember);
  const [busy, setBusy] = useState(false);
  const [manager, setManager] = useState("");
  if (!form) return null;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const field = (k: "name" | "city" | "address" | "phone" | "email", label: string) => (
    <div className="space-y-1"><Label htmlFor={k}>{label}</Label>
      <Input id={k} value={form[k] ?? ""} onChange={(e) => {
        const v = e.target.value;
        if (k === "name" && !form.id) setForm({ ...form, name: v, slug: slugify(v) }); else set(k, v);
      }} /></div>
  );
  const submit = async () => {
    setBusy(true);
    try {
      const n = (s: string | null) => (s?.trim() ? s.trim() : null);
      const res = await save({ data: { id: form.id, name: form.name, slug: form.slug, city: n(form.city), address: n(form.address), phone: n(form.phone), email: n(form.email), menu_key: form.menu_key, logo_url: form.logo_url, brand: form.brand, active: form.active } });
      toast.success(form.id ? "Restaurant mis à jour" : "Restaurant créé");
      if (!form.id && manager.includes("@")) {
        try { const r = await invite({ data: { restaurantId: res.id, email: manager, role: "manager", origin: window.location.origin } }); toast.success(r.invited ? `Invitation envoyée à ${manager}` : `${manager} rattaché au restaurant`); }
        catch (e) { toast.error(`Invitation non envoyée : ${(e as Error).message}`); }
        setManager("");
      }
      const created = !form.id; setForm(null); onSaved(form.slug, created);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && setForm(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle className="text-3xl">{form.id ? `Modifier ${form.name}` : "Nouveau restaurant"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("name", "Nom")}
          <div className="space-y-1"><Label htmlFor="slug">Adresse web</Label>
            <div className="flex items-center gap-1"><span className="text-muted-foreground">/</span><Input id="slug" value={form.slug} onChange={(e) => set("slug", slugify(e.target.value))} /></div></div>
          {field("address", "Adresse")}{field("city", "Ville")}{field("phone", "Téléphone")}{field("email", "Email")}
          <div className="space-y-1"><Label htmlFor="menu">Carte</Label>
            <select id="menu" value={form.menu_key} onChange={(e) => set("menu_key", e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2">
              {MENU_KEYS.map((k) => <option key={k} value={k}>{MENU_LABELS[k] ?? k}</option>)}
            </select></div>
          <div className="space-y-1"><Label htmlFor="logo">Logo</Label>
            <div className="flex items-center gap-2">
              <BrandLogo src={form.logo_url} name={form.name} />
              <Input id="logo" type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) set("logo_url", await fileToLogo(f)); }} />
              {form.logo_url && <Button size="sm" variant="ghost" onClick={() => set("logo_url", null)}>Retirer</Button>}
            </div></div>
          {(["primary", "accent"] as const).map((k) => (
            <div key={k} className="space-y-1"><Label htmlFor={k}>{k === "primary" ? "Couleur principale" : "Couleur d'action"}</Label>
              <div className="flex gap-2">
                <input id={k} type="color" value={form.brand[k] ?? "#000000"} onChange={(e) => set("brand", { ...form.brand, [k]: e.target.value })} className="h-9 w-14 rounded border border-input bg-background" />
                <Input value={form.brand[k] ?? ""} onChange={(e) => set("brand", { ...form.brand, [k]: e.target.value })} />
              </div></div>
          ))}
          {!form.id && <div className="space-y-1 sm:col-span-2"><Label htmlFor="manager">Email du gérant (invitation avec lien d'activation)</Label>
            <Input id="manager" type="email" placeholder="gerant@restaurant.fr" value={manager} onChange={(e) => setManager(e.target.value)} /></div>}
          <label className="flex items-center gap-2 sm:col-span-2"><Switch checked={form.active} onCheckedChange={(v) => set("active", v)} /> Restaurant en ligne</label>
        </div>
        <div style={brandVars(form.brand)} className="mt-2 flex items-center gap-3 rounded-lg border border-border p-3">
          <span className="text-sm text-muted-foreground">Aperçu</span>
          <span className="rounded-md bg-primary px-3 py-1 text-primary-foreground">Commander</span>
          <span className="rounded-md bg-accent px-3 py-1 text-accent-foreground">Valider</span>
        </div>
        {!form.id && <p className="text-xs text-muted-foreground">Horaires par défaut : lun.–sam. 11h30–14h30 et 18h30–22h30 — le restaurant démarre avec une carte vierge : déposez ensuite son menu (PDF ou photo) pour la créer avec l'IA.</p>}
        <Button onClick={submit} disabled={busy || !form.name || !form.slug}>{busy ? "Enregistrement…" : "Enregistrer"}</Button>
      </DialogContent>
    </Dialog>
  );
}
