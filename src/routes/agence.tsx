import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { ChefHat, ExternalLink, LogOut, Pencil, Plus, Tablet, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/use-staff";
import { listAgencyRestaurants, saveRestaurant, setRestaurantActive, type AgencyRestaurant } from "@/lib/agency.functions";
import { MENU_KEYS } from "@/lib/catalogs";
import { brandVars, BrandLogo, fileToLogo } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeToggle } from "@/lib/theme";

export const Route = createFileRoute("/agence")({
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

  useEffect(() => { if (!loading && !user) navigate({ to: "/connexion" }); }, [loading, user, navigate]);
  const load = useCallback(() => list().then(setRows).catch((e) => toast.error(e.message)), [list]);
  useEffect(() => { if (isAgency) load(); }, [isAgency, load]);

  if (loading || !user) return <p className="p-10 text-center text-muted-foreground">Chargement…</p>;
  if (!isAgency) return (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-4xl">Réservé à l'agence</h1>
      <Button asChild className="mt-6"><Link to="/cuisine">Mes restaurants</Link></Button>
    </div>
  );

  const active = rows?.filter((r) => r.active).length ?? 0;
  const today = rows?.reduce((s, r) => s + r.orders_today, 0) ?? 0;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">LC Digitale</p>
          <h1 className="text-5xl">Console agence</h1>
        </div>
        <Button onClick={() => setForm({ ...EMPTY })}><Plus /> Nouveau restaurant</Button>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()} aria-label="Déconnexion"><LogOut /></Button>
      </header>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[["Restaurants", rows?.length ?? 0], ["En ligne", active], ["Commandes aujourd'hui", today]].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{l}</p><p className="font-display text-4xl">{v}</p>
          </div>
        ))}
      </div>

      {!rows ? <p className="mt-10 text-center text-muted-foreground">Chargement du réseau…</p> : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <article key={r.id} style={brandVars(r.brand)} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-4">
                {r.logo_url ? <BrandLogo src={r.logo_url} name={r.name} className="h-14 w-14 rounded-lg object-contain" />
                  : <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary font-display text-3xl text-primary-foreground">{r.name[0]}</div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-3xl">{r.name}</p>
                  <p className="text-sm text-muted-foreground">/{r.slug} · {r.city ?? "—"} · {r.orders_today} cmd aujourd'hui</p>
                  <div className="mt-2 flex gap-1">
                    <span className="h-4 w-8 rounded bg-primary" /><span className="h-4 w-8 rounded bg-accent" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={r.active} onCheckedChange={async (v) => {
                    setRows((p) => p?.map((x) => (x.id === r.id ? { ...x, active: v } : x)) ?? null);
                    try { await toggle({ data: { id: r.id, active: v } }); toast.success(v ? "Restaurant en ligne" : "Restaurant désactivé"); }
                    catch (e) { toast.error((e as Error).message); load(); }
                  }} aria-label={`Activer ${r.name}`} />
                  {r.active ? "En ligne" : "Hors ligne"}
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" asChild><a href={`/${r.slug}`} target="_blank" rel="noreferrer"><ExternalLink /> Site</a></Button>
                <Button size="sm" variant="secondary" asChild><a href={`/${r.slug}/borne`} target="_blank" rel="noreferrer"><Tablet /> Borne</a></Button>
                <Button size="sm" variant="secondary" asChild><Link to="/cuisine/$slug" params={{ slug: r.slug }}><ChefHat /> Cuisine</Link></Button>
                <Button size="sm" variant="secondary" asChild><Link to="/cuisine/$slug/equipe" params={{ slug: r.slug }}><Users /> Équipe</Link></Button>
                <Button size="sm" variant="secondary" asChild><Link to="/cuisine/$slug/carte" params={{ slug: r.slug }}>Carte</Link></Button>
                <Button size="sm" onClick={() => setForm({ ...r })}><Pencil /> Modifier</Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <RestaurantDialog form={form} setForm={setForm} onSaved={load} />
    </div>
  );
}

function RestaurantDialog({ form, setForm, onSaved }: { form: Form | null; setForm: (f: Form | null) => void; onSaved: () => void }) {
  const save = useServerFn(saveRestaurant);
  const [busy, setBusy] = useState(false);
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
      await save({ data: { id: form.id, name: form.name, slug: form.slug, city: n(form.city), address: n(form.address), phone: n(form.phone), email: n(form.email), menu_key: form.menu_key, logo_url: form.logo_url, brand: form.brand, active: form.active } });
      toast.success(form.id ? "Restaurant mis à jour" : "Restaurant créé");
      setForm(null); onSaved();
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
              {MENU_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
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
          <label className="flex items-center gap-2 sm:col-span-2"><Switch checked={form.active} onCheckedChange={(v) => set("active", v)} /> Restaurant en ligne</label>
        </div>
        <div style={brandVars(form.brand)} className="mt-2 flex items-center gap-3 rounded-lg border border-border p-3">
          <span className="text-sm text-muted-foreground">Aperçu</span>
          <span className="rounded-md bg-primary px-3 py-1 text-primary-foreground">Commander</span>
          <span className="rounded-md bg-accent px-3 py-1 text-accent-foreground">Valider</span>
        </div>
        {!form.id && <p className="text-xs text-muted-foreground">Horaires par défaut : lun.–sam. 11h30–14h30 et 18h30–22h30 (modifiables ensuite).</p>}
        <Button onClick={submit} disabled={busy || !form.name || !form.slug}>{busy ? "Enregistrement…" : "Enregistrer"}</Button>
      </DialogContent>
    </Dialog>
  );
}
