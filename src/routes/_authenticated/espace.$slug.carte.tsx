import { Crumbs } from "@/components/Crumbs";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, FileUp, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStaff } from "@/hooks/use-staff";
import { loadMenu, saveMenu } from "@/lib/menu-admin.functions";
import { analyzeMenu } from "@/lib/menu-import.functions";
import { readMenuFile } from "@/lib/menu-import";
import { baseCategories } from "@/lib/catalogs";
import type { Category, MenuItem } from "@/lib/menu";
import { BrandTheme } from "@/lib/brand";
import { ThemeToggle } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AllergenBadges, AllergenPicker } from "@/components/Allergens";

export const Route = createFileRoute("/_authenticated/espace/$slug/carte")({
  head: () => ({
    meta: [
      { title: "Gestion de la carte — Back-office restaurant" },
      { name: "description", content: "Créer et modifier les catégories, plats et prix de votre restaurant." },
      { property: "og:title", content: "Gestion de la carte" },
      { property: "og:description", content: "Back-office de la carte du restaurant." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MenuEditor,
});

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
function move<T>(a: T[], i: number, d: number) { const b = [...a]; const j = i + d; if (j < 0 || j >= b.length) return b; [b[i], b[j]] = [b[j]!, b[i]!]; return b; }

function MenuEditor() {
  const { slug } = Route.useParams();
  const { loading, restaurants } = useStaff();
  const r = restaurants.find((x) => x.slug === slug);
  const canManage = r?.role === "agency" || r?.role === "manager";
  const load = useServerFn(loadMenu);
  const save = useServerFn(saveMenu);
  const analyze = useServerFn(analyzeMenu);
  const input = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<Category[] | null>(null);
  const [custom, setCustom] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [candidate, setCandidate] = useState<Category[] | null>(null);

  useEffect(() => {
    if (!canManage || !r) return;
    load({ data: { restaurantId: r.id } }).then((row) => {
      const m = row.menu as Category[] | null;
      setCustom(!!m?.length);
      setMenu(m?.length ? m : baseCategories(row.menu_key));
    }).catch((e) => toast.error(e.message));
  }, [canManage, r?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p className="p-10 text-center text-muted-foreground">Chargement…</p>;
  if (!canManage) return <p className="p-10 text-center">Réservé au gérant. <Link to="/espace" className="underline">Retour</Link></p>;
  if (!menu) return <p className="p-10 text-center text-muted-foreground">Chargement de la carte…</p>;

  const update = (m: Category[]) => { setMenu(m); setDirty(true); };
  const setCat = (ci: number, c: Partial<Category>) => update(menu.map((x, i) => (i === ci ? { ...x, ...c } : x)));
  const setItem = (ci: number, ii: number, it: Partial<MenuItem>) =>
    setCat(ci, { items: menu[ci]!.items.map((x, i) => (i === ii ? { ...x, ...it } : x)) });

  const submit = async () => {
    setBusy(true);
    try { await save({ data: { restaurantId: r!.id, menu } }); setDirty(false); setCustom(true); toast.success("Carte enregistrée et en ligne"); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const importFile = async (file?: File) => {
    if (!file || !r) return;
    setImporting(true); setCandidate(null);
    try {
      const pages = await readMenuFile(file);
      const result = await analyze({ data: { restaurantId: r.id, pages } });
      setCandidate(result);
      toast.success("Carte analysée : vérifiez les plats et les prix avant de valider");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Import impossible"); }
    finally { setImporting(false); if (input.current) input.current.value = ""; }
  };

  return (
    <BrandTheme brand={r?.brand}>
      <div className="mx-auto max-w-4xl p-6 pb-28">
        <div className="flex items-center justify-between gap-3"><Crumbs slug={slug} page="Carte" /><ThemeToggle /></div>
        <h1 className="mt-4 text-5xl">Carte · {r?.name}</h1>
        <p className="text-sm text-muted-foreground">
          {!menu.length ? "Carte vierge : déposez votre menu ci-dessous ou ajoutez vos catégories à la main." : custom ? "Carte personnalisée de ce restaurant." : "Vous partez de la carte de base : elle deviendra propre à ce restaurant dès le premier enregistrement."} Les modifications n'affectent aucun autre établissement.
        </p>

        <div className="mt-6 space-y-3">
          <input ref={input} className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,application/pdf,image/jpeg,image/png,image/webp,text/plain,text/csv" onChange={(e) => void importFile(e.target.files?.[0])} aria-label="Choisir une carte à importer" />
          <div role="button" tabIndex={0} onClick={() => input.current?.click()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); void importFile(e.dataTransfer.files[0]); }}
            className={`cursor-pointer rounded-xl border-2 border-dashed text-center transition-colors ${menu.length ? "p-6" : "p-10"} ${dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary"}`}>
            <FileUp className={`mx-auto mb-2 text-primary ${menu.length ? "h-7 w-7" : "h-12 w-12"}`} />
            <p className={menu.length ? "font-semibold" : "font-display text-3xl"}>{importing ? "Analyse de la carte en cours…" : "Déposer votre menu (PDF ou photo) pour le créer avec l'IA"}</p>
            {!importing && <span className="mt-3 inline-flex h-10 items-center rounded-md bg-primary px-5 font-semibold text-primary-foreground">Choisir un fichier</span>}
            <p className="text-sm text-muted-foreground">PDF, photo, TXT ou CSV · 8 Mo maximum · 8 pages maximum</p>
          </div>
          {candidate && <div className="border border-primary bg-primary/5 p-4" aria-live="polite">
            <h2 className="text-2xl">Carte proposée · {candidate.reduce((n, c) => n + c.items.length, 0)} plats</h2>
            <p className="text-sm text-muted-foreground">Relisez les prix, intitulés, suppléments et allergènes détectés : l'analyse peut se tromper. Votre carte actuelle reste en ligne jusqu'à l'enregistrement.</p>
            <div className="mt-3 max-h-64 overflow-auto border-y border-border py-2 text-sm">
              {candidate.map((c) => <div key={c.id} className="mb-3"><strong>{c.label}</strong>{c.items.map((it) => <div key={it.id} className="flex justify-between gap-3 border-b border-border/50 py-1"><span>{it.name}<AllergenBadges ids={it.allergens} className="mt-1" /></span><span className="shrink-0">{it.price.toFixed(2)} €</span></div>)}</div>)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => { update(candidate); setCandidate(null); setOpen(candidate[0]?.id ?? null); toast.info("Carte proposée prête à corriger ; enregistrez-la après vérification"); }}>Reprendre et corriger</Button><Button variant="secondary" onClick={() => setCandidate(null)}>Annuler l'import</Button></div>
          </div>}
        </div>

        <div className="mt-6 space-y-3">
          {menu.map((c, ci) => (
            <section key={c.id} className="rounded-xl border border-border bg-card">
              <div className="flex flex-wrap items-center gap-2 p-3">
                <Input value={c.label} onChange={(e) => setCat(ci, { label: e.target.value })} className="max-w-xs font-semibold" aria-label="Nom de la catégorie" />
                <span className="text-sm text-muted-foreground">{c.items.length} plat(s)</span>
                <div className="ml-auto flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => update(move(menu, ci, -1))} aria-label="Monter"><ArrowUp /></Button>
                  <Button size="icon" variant="ghost" onClick={() => update(move(menu, ci, 1))} aria-label="Descendre"><ArrowDown /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Supprimer la catégorie « ${c.label} » et ses plats ?`)) update(menu.filter((_, i) => i !== ci)); }} aria-label="Supprimer la catégorie"><Trash2 /></Button>
                  <Button size="sm" variant="secondary" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? "Fermer" : "Plats"}</Button>
                </div>
              </div>
              {open === c.id && (
                <div className="space-y-2 border-t border-border p-3">
                  {c.items.map((it, ii) => (
                    <div key={it.id} className={`grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_7rem_auto] ${it.hidden ? "opacity-50" : ""}`}>
                      <div className="space-y-2">
                        <Input value={it.name} onChange={(e) => setItem(ci, ii, { name: e.target.value })} aria-label="Nom du plat" />
                        <Textarea rows={2} value={it.desc ?? ""} placeholder="Description" onChange={(e) => setItem(ci, ii, { desc: e.target.value })} />
                        <div><p className="mb-1 text-xs font-semibold">Allergènes (14 allergènes INCO) · {it.allergens === undefined ? <span className="text-destructive">non renseignés</span> : it.allergens.length ? `${it.allergens.length} coché(s)` : "aucun"} {it.allergens === undefined && <button type="button" className="underline" onClick={() => setItem(ci, ii, { allergens: [] })}>Marquer « aucun allergène »</button>}</p><AllergenPicker value={it.allergens ?? []} onChange={(v) => setItem(ci, ii, { allergens: v })} /></div>
                        {!!it.options?.length && <p className="text-xs text-muted-foreground">Options conservées : {it.options.map((o) => o.label).join(" · ")}</p>}
                      </div>
                      <div>
                        <Input type="number" step="0.1" min="0" value={it.price} onChange={(e) => setItem(ci, ii, { price: Math.max(0, Number(e.target.value)) })} aria-label="Prix" />
                        <span className="text-xs text-muted-foreground">Prix €</span>
                      </div>
                      <div className="flex items-start gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setItem(ci, ii, { hidden: !it.hidden })} aria-label={it.hidden ? "Afficher" : "Masquer"} title={it.hidden ? "Indisponible — cliquer pour afficher" : "Masquer (rupture)"}>{it.hidden ? <EyeOff /> : <Eye />}</Button>
                        <Button size="icon" variant="ghost" onClick={() => setCat(ci, { items: move(c.items, ii, -1) })} aria-label="Monter"><ArrowUp /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setCat(ci, { items: c.items.filter((_, i) => i !== ii) })} aria-label="Supprimer le plat"><Trash2 /></Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="secondary" onClick={() => setCat(ci, { items: [...c.items, { id: uid(c.id), name: "Nouveau plat", price: 0 }] })}><Plus /> Ajouter un plat</Button>
                </div>
              )}
            </section>
          ))}
        </div>
        <Button className="mt-4" variant="secondary" onClick={() => { const id = uid("cat"); update([...menu, { id, label: "Nouvelle catégorie", items: [] }]); setOpen(id); }}><Plus /> Ajouter une catégorie</Button>
        {custom && (
          <Button className="ml-2 mt-4" variant="ghost" onClick={async () => {
            if (!confirm("Revenir à la carte de base ? Vos modifications seront perdues.")) return;
            await save({ data: { restaurantId: r!.id, menu: null } }); toast.success("Carte de base rétablie"); location.reload();
          }}>Revenir à la carte de base</Button>
        )}

        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center gap-3">
            <span className="mr-auto text-sm text-muted-foreground">{dirty ? "Modifications non enregistrées" : "À jour"} · les catégories vides et plats masqués n'apparaissent pas aux clients</span>
            <Button onClick={submit} disabled={busy || !dirty}><Save /> {busy ? "Enregistrement…" : "Enregistrer la carte"}</Button>
          </div>
        </div>
      </div>
    </BrandTheme>
  );
}
