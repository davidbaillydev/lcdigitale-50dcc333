import { Crumbs } from "@/components/Crumbs";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, FileUp, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStaff } from "@/hooks/use-staff";
import { loadMenu, saveMenu } from "@/lib/menu-admin.functions";
import { analyzeMenu } from "@/lib/menu-import.functions";
import { readMenuFile } from "@/lib/menu-import";
import { baseCategories } from "@/lib/catalogs";
import type { Category, MenuItem } from "@/lib/menu";
import { ThemeToggle } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AllergenBadges, AllergenPicker } from "@/components/Allergens";
import { DishPhoto } from "@/components/DishPhoto";
import { pretranslateMenu } from "@/lib/menu-translate.functions";
import { FOREIGN_LANGS, LANG_NAMES, missingTranslations, type ForeignLang } from "@/lib/i18n";
import { Languages, PackageX } from "lucide-react";
import { setSoldOut, useSoldOut } from "@/lib/stock";

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
  const soldOut = useSoldOut(r?.id);
  const canManage = r?.role === "agency" || r?.role === "manager";
  const load = useServerFn(loadMenu);
  const save = useServerFn(saveMenu);
  const analyze = useServerFn(analyzeMenu);
  const translate = useServerFn(pretranslateMenu);
  const [translating, setTranslating] = useState(false);
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

  /** Traduit une seule fois les plats/catégories sans traduction ; le résultat est enregistré avec la carte. */
  const pretranslate = async (force = false) => {
    if (!r) return;
    const todo = force ? { items: menu.flatMap((c) => c.items), cats: menu } : missingTranslations(menu);
    if (!todo.items.length && !todo.cats.length) { toast.info("Toute la carte est déjà traduite"); return; }
    setTranslating(true);
    try {
      const items = todo.items.slice(0, 150).map((i) => ({ id: i.id, name: i.name, ...(i.desc ? { desc: i.desc } : {}) }));
      const res = await translate({ data: { restaurantId: r.id, items, categories: todo.cats.map((c) => ({ id: c.id, label: c.label })) } });
      const ti = new Map(res.items.map((x) => [x.id, x])); const tc = new Map(res.categories.map((x) => [x.id, x]));
      update(menu.map((c) => {
        const cl = tc.get(c.id);
        return { ...c, ...(cl ? { translations: { en: cl.en, es: cl.es, de: cl.de } } : {}), items: c.items.map((i) => { const t = ti.get(i.id); return t ? { ...i, translations: { en: t.en, es: t.es, de: t.de } } : i; }) };
      }));
      toast.success(`${res.items.length} plat(s) traduit(s) — relisez puis enregistrez la carte`);
      if (todo.items.length > 150) toast.info("Carte très longue : relancez « Pré-traduire » pour la suite");
    } catch (e) { toast.error((e as Error).message); } finally { setTranslating(false); }
  };
  const setTr = (ci: number, ii: number, l: ForeignLang, k: "name" | "description", v: string) => {
    const it = menu[ci]!.items[ii]!; const cur = it.translations?.[l] ?? { name: "" };
    setItem(ci, ii, { translations: { ...it.translations, [l]: { ...cur, [k]: v || (k === "name" ? "" : undefined) } } });
  };
  const missing = missingTranslations(menu).items.length;

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
      <div className="admin-menu mx-auto max-w-4xl p-6 pb-28">
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

        {menu.length > 0 && <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Languages className="h-6 w-6 text-primary" />
          <div className="min-w-0 flex-1"><p className="font-semibold">Carte en anglais, espagnol et allemand</p>
            <p className="text-sm text-muted-foreground">{missing ? `${missing} plat(s) sans traduction complète.` : "Tous les plats sont traduits."} La traduction est faite une seule fois puis enregistrée : aucun coût quand les clients changent de langue.</p></div>
          <Button onClick={() => pretranslate()} disabled={translating}><Languages /> {translating ? "Traduction…" : "Pré-traduire"}</Button>
          {!missing && <Button variant="ghost" onClick={() => { if (confirm("Retraduire toute la carte ? Vos corrections de traduction seront remplacées.")) void pretranslate(true); }} disabled={translating}>Tout retraduire</Button>}
        </div>}

        <div className="mt-6 space-y-3">
          {menu.map((c, ci) => (
            <section key={c.id} className="rounded-xl border border-border bg-card">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3 sm:flex sm:flex-wrap">
                <Input value={c.label} onChange={(e) => setCat(ci, { label: e.target.value })} className="min-w-0 font-semibold sm:max-w-xs" aria-label="Nom de la catégorie" />
                <span className="text-sm text-muted-foreground">{c.items.length} plat(s) · {c.items.filter((i) => i.image).length} photo(s)</span>
                <div className="col-span-2 flex justify-end gap-1 sm:ml-auto">
                  <Button size="icon" variant="ghost" onClick={() => update(move(menu, ci, -1))} aria-label="Monter"><ArrowUp /></Button>
                  <Button size="icon" variant="ghost" onClick={() => update(move(menu, ci, 1))} aria-label="Descendre"><ArrowDown /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Supprimer la catégorie « ${c.label} » et ses plats ?`)) update(menu.filter((_, i) => i !== ci)); }} aria-label="Supprimer la catégorie"><Trash2 /></Button>
                  <Button size="sm" variant="secondary" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? "Fermer" : "Plats"}</Button>
                </div>
              </div>
              {open === c.id && (
                <div className="space-y-2 border-t border-border p-3">
                  {c.items.map((it, ii) => (
                    <div key={it.id} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border border-border p-3 lg:grid-cols-[minmax(0,1fr)_7rem_auto] ${it.hidden ? "opacity-50" : ""}`}>
                      <div className="col-span-2 min-w-0 space-y-2 lg:col-span-1">
                        <DishPhoto restaurantId={r!.id} item={it} onChange={(image) => setItem(ci, ii, { image })} />
                        <Input value={it.name} onChange={(e) => setItem(ci, ii, { name: e.target.value })} aria-label="Nom du plat" />
                        <Textarea rows={2} value={it.desc ?? ""} placeholder="Description" onChange={(e) => setItem(ci, ii, { desc: e.target.value })} />
                        <label className="flex items-center gap-2 text-xs font-semibold">TVA <select className="min-h-10 rounded-md border border-input bg-background px-2 text-sm" value={it.vatRate ?? ""} onChange={(e) => setItem(ci, ii, { vatRate: e.target.value ? (Number(e.target.value) as 5.5 | 10 | 20) : undefined })}><option value="">Taux par défaut</option><option value="5.5">5,5 % (vente à emporter différée)</option><option value="10">10 % (restauration)</option><option value="20">20 % (alcools)</option></select></label>
                        <div><p className="mb-1 text-xs font-semibold">Allergènes (14 allergènes INCO) · {it.allergens === undefined ? <span className="text-destructive">non renseignés</span> : it.allergens.length ? `${it.allergens.length} coché(s)` : "aucun"} {it.allergens === undefined && <button type="button" className="underline" onClick={() => setItem(ci, ii, { allergens: [] })}>Marquer « aucun allergène »</button>}</p><AllergenPicker value={it.allergens ?? []} onChange={(v) => setItem(ci, ii, { allergens: v })} /></div>
                        <details className="rounded-md border border-border p-2"><summary className="cursor-pointer text-xs font-semibold">Traductions · {FOREIGN_LANGS.filter((l) => it.translations?.[l]?.name).length}/3</summary>
                          <div className="mt-2 space-y-3">{FOREIGN_LANGS.map((l) => <div key={l} className="space-y-1"><p className="text-xs font-semibold text-muted-foreground">{LANG_NAMES[l]}</p>
                            <Input value={it.translations?.[l]?.name ?? ""} placeholder={it.name} onChange={(e) => setTr(ci, ii, l, "name", e.target.value)} aria-label={`Nom en ${LANG_NAMES[l]}`} />
                            {it.desc && <Textarea rows={2} value={it.translations?.[l]?.description ?? ""} placeholder={it.desc} onChange={(e) => setTr(ci, ii, l, "description", e.target.value)} aria-label={`Description en ${LANG_NAMES[l]}`} />}</div>)}</div>
                        </details>
                        {!!it.options?.length && <p className="text-xs text-muted-foreground">Options conservées : {it.options.map((o) => o.label).join(" · ")}</p>}
                      </div>
                      <div>
                        <Input type="number" step="0.1" min="0" value={it.price} onChange={(e) => setItem(ci, ii, { price: Math.max(0, Number(e.target.value)) })} aria-label="Prix" />
                        <span className="text-xs text-muted-foreground">Prix €</span>
                      </div>
                      <div className="flex items-start gap-1">
                        <Button size="sm" variant={soldOut.has(it.id) ? "destructive" : "outline"} className="min-h-10" onClick={async () => { const on = !soldOut.has(it.id); try { await setSoldOut(r!.id, it.id, on); toast.success(on ? `${it.name} : épuisé` : `${it.name} : disponible`); } catch { toast.error("Modification impossible"); } }} title="Effet immédiat sur le site, la borne et le menu QR, sans enregistrer la carte"><PackageX /> {soldOut.has(it.id) ? "Épuisé" : "Marquer épuisé"}</Button>
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
          <div className="mx-auto grid max-w-4xl gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <span className="min-w-0 text-xs text-muted-foreground sm:text-sm">{dirty ? "Modifications non enregistrées" : "À jour"} · les catégories vides et plats masqués n'apparaissent pas aux clients</span>
            <Button onClick={submit} disabled={busy || !dirty}><Save /> {busy ? "Enregistrement…" : "Enregistrer la carte"}</Button>
          </div>
        </div>
      </div>
  );
}
