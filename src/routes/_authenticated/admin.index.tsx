import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, BarChart3, BookOpen, ChefHat, ChevronDown, Contact, Copy, Globe, GripVertical, ExternalLink, FileText, Landmark, LogOut, Mail, MessageSquare, MoreHorizontal, Pencil, Plus, QrCode, Search, Settings, ShieldCheck, ShoppingBag, Tablet, Trash2, Users, Wallet, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/hooks/use-staff";
import { getAgencyPublicDomain, listAgencyRestaurants, reorderRestaurants, saveAgencyPublicDomain, saveRestaurant, setRestaurantActive, type AgencyRestaurant } from "@/lib/agency.functions";
import { MENU_KEYS, MENU_LABELS } from "@/lib/catalogs";
import { inviteMember } from "@/lib/staff.functions";
import { brandVars, BrandLogo, fileToLogo } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeToggle } from "@/lib/theme";
import { OrdersPausedToggle } from "@/components/OrdersPausedToggle";
import { MenuAiSettings } from "@/components/MenuAiSettings";
import { WhatsAppAccess } from "@/components/WhatsAppAccess";
import { DeleteRestaurantDialog } from "@/components/DeleteRestaurantDialog";
import { DuplicateRestaurantDialog } from "@/components/DuplicateRestaurantDialog";
import { CountrySelect } from "@/components/CountryFlag";
import { countryOf } from "@/lib/country";
import type { zCountry } from "@/lib/money";

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
const EMPTY: Form = { name: "", slug: "", city: "", address: "", phone: "", email: "", menu_key: MENU_KEYS[0] ?? "", logo_url: null, brand: { primary: "#d4a017", accent: "#c8102e" }, active: true, config: {} };
const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function AgencyMenu({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="ghost" className="min-h-11 gap-2 px-3">{icon}{label}<ChevronDown className="size-4 text-muted-foreground" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-64 max-w-[calc(100vw-2rem)] [&_[role=menuitem]]:min-h-12 [&_[role=menuitem]]:px-3">
      <DropdownMenuLabel>{label}</DropdownMenuLabel><DropdownMenuSeparator />{children}
    </DropdownMenuContent>
  </DropdownMenu>;
}

function Console() {
  const { loading, user, isAgency } = useStaff();
  const navigate = useNavigate();
  const list = useServerFn(listAgencyRestaurants);
  const toggle = useServerFn(setRestaurantActive);
  const [rows, setRows] = useState<AgencyRestaurant[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [deleting, setDeleting] = useState<AgencyRestaurant | null>(null);
  const [duplicating, setDuplicating] = useState<AgencyRestaurant | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [countryFilter, setCountryFilter] = useState<zCountry | "all">("all");
  const [domainOpen, setDomainOpen] = useState(false);
  const reorder = useServerFn(reorderRestaurants);
  const [dragId, setDragId] = useState<string | null>(null);
  const loadDomain = useServerFn(getAgencyPublicDomain);
  const saveDomain = useServerFn(saveAgencyPublicDomain);
  const [publicDomain, setPublicDomain] = useState<string | null>(null);
  const [domainDraft, setDomainDraft] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);
  const submitDomain = async () => {
    setSavingDomain(true);
    try {
      const { domain } = await saveDomain({ data: { domain: domainDraft } });
      setPublicDomain(domain);
      setDomainDraft(domain);
      toast.success("Domaine public enregistré");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSavingDomain(false); }
  };
  const move = async (from: string, to: string | number) => {
    if (!rows) return;
    const list = [...rows];
    const i = list.findIndex((x) => x.id === from);
    const j = typeof to === "number" ? i + to : list.findIndex((x) => x.id === to);
    if (i < 0 || j < 0 || j >= list.length || i === j) return;
    const [it] = list.splice(i, 1);
    if (!it) return;
    list.splice(j, 0, it);
    setRows(list);
    try { await reorder({ data: { ids: list.map((x) => x.id) } }); }
    catch (e) { toast.error((e as Error).message); load(); }
  };

  const load = useCallback(() => list().then(setRows).catch((e) => toast.error(e.message)), [list]);
  useEffect(() => { if (isAgency) load(); }, [isAgency, load]);
  useEffect(() => {
    if (!isAgency) return;
    loadDomain().then((domain) => { setPublicDomain(domain); setDomainDraft(domain); }).catch(() => {});
  }, [isAgency, loadDomain]);

  if (loading || !user) return <p className="p-10 text-center text-muted-foreground">Chargement…</p>;
  if (!isAgency) return (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-4xl">Réservé à l'agence</h1>
      <Button asChild className="mt-6"><Link to="/espace">Mes restaurants</Link></Button>
    </div>
  );

  const active = rows?.filter((r) => r.active).length ?? 0;
  const today = rows?.reduce((s, r) => s + r.orders_today, 0) ?? 0;
  const filteredRows = rows?.filter((r) =>
    `${r.name} ${r.city ?? ""} ${r.slug}`.toLowerCase().includes(q.trim().toLowerCase()) &&
    (statusFilter === "all" || r.active === (statusFilter === "online")) &&
    (countryFilter === "all" || countryOf(r) === countryFilter)
  ) ?? [];
  const canReorder = !q.trim() && statusFilter === "all" && countryFilter === "all";

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <p className="text-sm font-semibold text-primary">Réseau de restaurants</p>
          <h1 className="text-3xl sm:text-5xl">Console agence</h1>
        </div>
        <Button className="min-h-11 max-sm:order-last sm:min-h-12" onClick={() => setForm({ ...EMPTY })}><Plus /> Nouveau restaurant</Button>
        <div className="flex items-center gap-1">
        <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="size-11" aria-label="Domaine public" onClick={() => setDomainOpen(true)}><Globe /></Button></TooltipTrigger><TooltipContent>Domaine public</TooltipContent></Tooltip></TooltipProvider>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/connexion", replace: true }); }} aria-label="Déconnexion"><LogOut /></Button>
        </div>
        </div>
        <nav aria-label="Navigation agence" className="flex flex-wrap gap-1 border-t border-border pt-2">
          <AgencyMenu label="Opérations" icon={<ChefHat />}>
            <DropdownMenuItem asChild><Link to="/espace"><ChefHat />Écrans cuisine</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/admin/commande-test"><ShoppingBag />Commande test</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/admin/clients"><Contact />Clients</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/admin/qrcodes"><QrCode />QR codes</Link></DropdownMenuItem>
          </AgencyMenu>
          <AgencyMenu label="Finance & Ventes" icon={<Landmark />}>
            <DropdownMenuItem asChild><Link to="/admin/sms"><MessageSquare />Campagnes SMS</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/admin/campagnes-email"><Mail />Campagnes e-mail</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/espace/tableau-de-bord"><BarChart3 />Ventes & statistiques</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/admin/statistiques"><ShoppingBag />Conversion & abandons</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/espace/factures"><FileText />Factures</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/admin/gains"><Wallet />Gains agence</Link></DropdownMenuItem>
          </AgencyMenu>
          <AgencyMenu label="Outils & Agence" icon={<Settings />}>
            <DropdownMenuItem asChild><Link to="/admin/licences"><Tablet />Licences bornes</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/admin/inalterabilite"><ShieldCheck />Inaltérabilité caisse</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/admin/emails"><Mail />Aperçu des e-mails</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/admin/administrateurs"><Users />Administrateurs</Link></DropdownMenuItem>
          </AgencyMenu>
        </nav>
      </header>
      <Dialog open={domainOpen} onOpenChange={setDomainOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle className="pr-8 text-2xl">Domaine public</DialogTitle>
            <DialogDescription>Base des liens partagés pour les clients, livreurs et messages WhatsApp. Utilisez le domaine publié de la plateforme.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="public-domain">Adresse du site public</Label>
            <Input id="public-domain" type="url" inputMode="url" placeholder="https://restaurant.lcdigitale.fr" value={domainDraft} onChange={(e) => setDomainDraft(e.target.value)} />
          </div>
          {publicDomain && <p className="break-words text-sm text-muted-foreground">Domaine actuel : <span className="font-medium text-foreground">{publicDomain}</span></p>}
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setDomainOpen(false)}>Fermer</Button><Button disabled={savingDomain || !domainDraft.trim()} onClick={submitDomain}>{savingDomain ? "Enregistrement…" : "Enregistrer"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-4 flex flex-col gap-2 border-b border-border pb-3 lg:flex-row lg:items-center lg:gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="min-h-11 pl-10 pr-12" placeholder="Rechercher par nom, ville ou adresse web…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
          {q && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 size-10 -translate-y-1/2" aria-label="Effacer la recherche" onClick={() => setQ("")}><X /></Button>}
        </div>
        <div className="flex items-center gap-2">
          {rows && <div className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm shadow-sm" aria-label="Commandes du jour">
            <ShoppingBag className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="font-semibold tabular-nums">{today}</span>
            <span className="text-muted-foreground">commande{today > 1 ? "s" : ""} aujourd'hui</span>
          </div>}
          <div className="min-w-0 flex-1 lg:w-48 lg:flex-none"><CountrySelect value={countryFilter} onChange={setCountryFilter} all label="Filtrer par pays" /></div>
        </div>
        <div role="group" aria-label="Filtrer les restaurants" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 lg:flex">
          {([{ value: "all", label: "Tous", count: rows?.length }, { value: "online", label: "En ligne", count: rows ? active : undefined }, { value: "offline", label: "Hors ligne", count: rows ? rows.length - active : undefined }] as const).map((filter) =>
            <Button key={filter.value} variant={statusFilter === filter.value ? "secondary" : "ghost"} aria-pressed={statusFilter === filter.value} onClick={() => setStatusFilter(filter.value)} className={`min-h-10 gap-2 px-3 lg:min-h-11 ${statusFilter === filter.value ? "shadow-sm" : "text-muted-foreground"}`}>{filter.label}<span className="text-xs tabular-nums text-muted-foreground">{filter.count ?? "—"}</span></Button>
          )}
        </div>
      </div>
      {rows && <p className="mt-2 text-xs text-muted-foreground sm:text-sm" aria-live="polite">{filteredRows.length} restaurant{filteredRows.length > 1 ? "s" : ""} affiché{filteredRows.length > 1 ? "s" : ""} sur {rows.length}</p>}
      {!rows ? <p className="mt-10 text-center text-muted-foreground">Chargement du réseau…</p> : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filteredRows.length === 0 && <div className="col-span-full py-12 text-center"><Search className="mx-auto mb-3 size-7 text-muted-foreground" /><h2 className="text-xl font-semibold">Aucun restaurant trouvé</h2><Button variant="link" className="mt-2" onClick={() => { setQ(""); setStatusFilter("all"); setCountryFilter("all"); }}>Réinitialiser les filtres</Button></div>}
          {filteredRows.map((r) => { const pos = rows.indexOf(r); return (
            <article key={r.id} draggable={canReorder} onDragStart={(e) => { setDragId(r.id); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDragId(null)}
              onDragOver={(e) => { if (dragId) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (dragId) move(dragId, r.id); setDragId(null); }}
              className={`admin-restaurant-card group flex flex-col rounded-xl border border-border bg-card p-3 transition-shadow hover:shadow-md ${dragId === r.id ? "opacity-50" : ""}`}>
              <div className="mb-2 flex items-center gap-1">
                {canReorder && <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-muted-foreground" aria-hidden />}
                <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">N° {pos + 1}</span>
                {canReorder && <div className="ml-auto flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-9 w-9" disabled={pos === 0} onClick={() => move(r.id, -1)} aria-label={`Monter ${r.name}`}><ArrowUp /></Button>
                  <Button size="icon" variant="outline" className="h-9 w-9" disabled={pos === rows.length - 1} onClick={() => move(r.id, 1)} aria-label={`Descendre ${r.name}`}><ArrowDown /></Button>
                  <select className="h-9 rounded-md border border-input bg-background px-1 text-sm" value={pos + 1} aria-label={`Position de ${r.name}`}
                    onChange={(e) => move(r.id, Number(e.target.value) - 1 - pos)}>
                    {rows.map((_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                  </select>
                </div>}
              </div>
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                {r.logo_url ? <BrandLogo src={r.logo_url} name={r.name} className="h-10 w-10 shrink-0 rounded-lg object-contain" />
                  : <div style={brandVars(r.brand)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-xl text-primary-foreground">{r.name[0]}</div>}
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate font-display text-lg font-semibold">{r.name}</h2>
                    <span style={brandVars(r.brand)} className="hidden shrink-0 gap-0.5 sm:flex" aria-label="Couleurs du restaurant">
                      <span className="h-2.5 w-2.5 rounded-full bg-primary" /><span className="h-2.5 w-2.5 rounded-full bg-accent" />
                    </span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{r.city ?? "—"} · /{r.slug}</p>
                  <p className="mt-1 text-sm"><span className="font-semibold">{r.orders_today}</span> <span className="text-muted-foreground">commande{r.orders_today > 1 ? "s" : ""} aujourd'hui</span></p>
                </div>
                <div className="flex items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-11 w-11" aria-label={`Actions pour ${r.name}`}><MoreHorizontal /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="truncate">{r.name}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild className="min-h-11"><a href={`/${r.slug}`} target="_blank" rel="noreferrer"><ExternalLink /> Voir le site</a></DropdownMenuItem>
                      <DropdownMenuItem asChild className="min-h-11"><a href={`/${r.slug}/borne`} target="_blank" rel="noreferrer"><Tablet /> Ouvrir la borne</a></DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild className="min-h-11"><Link to="/espace/$slug" params={{ slug: r.slug }}><ChefHat /> Cuisine</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild className="min-h-11"><Link to="/espace/$slug/carte" params={{ slug: r.slug }}><BookOpen /> Carte</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild className="min-h-11"><Link to="/espace/$slug/equipe" params={{ slug: r.slug }}><Users /> Équipe</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild className="min-h-11"><Link to="/espace/$slug/clients" params={{ slug: r.slug }}><Contact /> Clients</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild className="min-h-11"><Link to="/admin/$slug" params={{ slug: r.slug }}><Settings /> Réglages</Link></DropdownMenuItem>
                      <DropdownMenuItem className="min-h-11" onSelect={() => setForm({ ...r })}><Pencil /> Modifier l'identité</DropdownMenuItem>
                      <DropdownMenuItem className="min-h-12" onSelect={() => setDuplicating(r)}><Copy /> Dupliquer le restaurant</DropdownMenuItem>
                      {canReorder && <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="min-h-11" disabled={rows[0]?.id === r.id} onSelect={() => move(r.id, -1)}><ArrowUp /> Monter</DropdownMenuItem>
                        <DropdownMenuItem className="min-h-11" disabled={rows[rows.length - 1]?.id === r.id} onSelect={() => move(r.id, 1)}><ArrowDown /> Descendre</DropdownMenuItem>
                      </>}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="min-h-12 text-destructive focus:text-destructive" onSelect={() => setDeleting(r)}><Trash2 /> Supprimer le restaurant</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="mt-3 grid gap-2 rounded-lg bg-muted/50 p-2">
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <Switch checked={r.active} onCheckedChange={async (v) => {
                    setRows((p) => p?.map((x) => (x.id === r.id ? { ...x, active: v } : x)) ?? null);
                    try { await toggle({ data: { id: r.id, active: v } }); toast.success(v ? "Restaurant en ligne" : "Restaurant désactivé"); }
                    catch (e) { toast.error((e as Error).message); load(); }
                  }} aria-label={`Activer ${r.name}`} />
                  <span className="flex items-center gap-2 font-medium">
                    <span className={`h-2 w-2 rounded-full ${r.active ? "bg-primary" : "bg-muted-foreground"}`} aria-hidden />
                    {r.active ? "En ligne" : "Hors ligne"}
                  </span>
                </label>
                <OrdersPausedToggle restaurant={{ id: r.id, config: r.config }} className="w-full" />
              </div>

              <div className="admin-card-actions mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" className="min-h-10 flex-1 sm:flex-none" asChild><Link to="/espace/$slug" params={{ slug: r.slug }}><ChefHat /> Cuisine</Link></Button>
                <Button size="sm" variant="secondary" className="min-h-10 flex-1 sm:flex-none" asChild><Link to="/admin/$slug" params={{ slug: r.slug }}><Settings /> Réglages</Link></Button>
                <TooltipProvider delayDuration={200}>
                  <div className="ml-auto hidden items-center gap-0.5 2xl:flex" role="toolbar" aria-label={`Raccourcis ${r.name}`}>
                    {([
                      [<ExternalLink key="i" />, "Voir le site", `/${r.slug}`, true],
                      [<Tablet key="i" />, "Ouvrir la borne", `/${r.slug}/borne`, true],
                    ] as const).map(([icon, label, href]) => (
                      <Tooltip key={label}><TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" asChild><a href={href} target="_blank" rel="noreferrer" aria-label={label}>{icon}</a></Button>
                      </TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>
                    ))}
                    <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" asChild><Link to="/espace/$slug/carte" params={{ slug: r.slug }} aria-label="Carte"><BookOpen /></Link></Button></TooltipTrigger><TooltipContent>Carte</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" asChild><Link to="/espace/$slug/equipe" params={{ slug: r.slug }} aria-label="Équipe"><Users /></Link></Button></TooltipTrigger><TooltipContent>Équipe</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" asChild><Link to="/espace/$slug/clients" params={{ slug: r.slug }} aria-label="Clients"><Contact /></Link></Button></TooltipTrigger><TooltipContent>Clients</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" onClick={() => setForm({ ...r })} aria-label="Modifier l'identité"><Pencil /></Button></TooltipTrigger><TooltipContent>Modifier l'identité</TooltipContent></Tooltip>
                  </div>
                </TooltipProvider>
                <div className="w-full sm:w-auto lg:ml-0"><WhatsAppAccess restaurant={r} compact origin={publicDomain} /></div>
              </div>
            </article>
          ); })}
        </div>
      )}

      <MenuAiSettings />
      {duplicating && <DuplicateRestaurantDialog key={duplicating.id} restaurant={duplicating} onClose={() => setDuplicating(null)} onCreated={(slug) => { setDuplicating(null); load(); navigate({ to: "/admin/$slug", params: { slug } }); }} />}
      {deleting && <DeleteRestaurantDialog key={deleting.id} restaurant={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); load(); }} />}
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
