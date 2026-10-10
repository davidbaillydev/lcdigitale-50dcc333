import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ExternalLink, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveQrSettings } from "@/lib/restaurant-settings.functions";

type R = { id: string; slug: string; name: string; brand?: { primary?: string } | null; config: { embed?: { label: string; color: string; position: "right" | "left"; mode: "floating" | "inline"; domains: string[] } } };
const HEX = /^#[0-9a-f]{6}$/i;
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function CopyBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="mt-2">
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-muted p-3 text-xs">{value}</pre>
      <Button variant="secondary" size="sm" className="mt-2 min-h-11" onClick={() => { navigator.clipboard.writeText(value); toast.success(label); }}><Copy /> Copier</Button>
    </div>
  );
}

export function EmbedButtonSection({ restaurant: r, onSaved }: { restaurant: R; onSaved: () => void }) {
  const save = useServerFn(saveQrSettings);
  const def = r.brand?.primary && HEX.test(r.brand.primary) ? r.brand.primary.toLowerCase() : "#007af5";
  const [label, setLabel] = useState("Commander en ligne");
  const [color, setColor] = useState(def);
  const [position, setPosition] = useState<"right" | "left">("right");
  const [mode, setMode] = useState<"floating" | "inline">("floating");
  const [domains, setDomains] = useState("");
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => {
    const e = r.config.embed;
    if (!e) return;
    setLabel(e.label); setColor(e.color); setPosition(e.position); setMode(e.mode); setDomains(e.domains.join("\n"));
  }, [r]);

  const okColor = HEX.test(color);
  const list = domains.split("\n").map((d) => d.trim()).filter(Boolean);
  const badDomain = list.find((d) => !/^https:\/\/[a-z0-9.-]+(:\d+)?\/?$/i.test(d));
  const lbl = label.trim() || "Commander en ligne";
  const code = `<script src="${origin}/embed.js" data-restaurant="${r.slug}" data-label="${esc(lbl)}" data-color="${okColor ? color.toLowerCase() : def}" data-position="${position}" data-mode="${mode}" async></script>`;
  const link = `${origin}/${r.slug}?src=link`;
  const fb = `${origin}/${r.slug}?src=facebook`;

  const submit = async () => {
    if (!okColor) { toast.error("Couleur invalide (format #rrggbb)"); return; }
    if (badDomain) { toast.error(`Domaine invalide : ${badDomain} (https:// obligatoire)`); return; }
    setBusy(true);
    try { await save({ data: { restaurantId: r.id, embed: { label: lbl.slice(0, 30), color: color.toLowerCase(), position, mode, domains: list } } }); onSaved(); toast.success("Bouton enregistré"); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const test = () => {
    const q = new URLSearchParams({ r: r.slug, label: lbl, color: okColor ? color : def, position, mode });
    window.open(`/embed-test.html?${q}`, "_blank", "noopener");
  };

  return (
    <section id="bouton-site" className="mt-4 rounded-xl border border-border bg-card p-4 print:hidden">
      <h2 className="text-2xl">Bouton pour votre site</h2>
      <p className="text-sm text-muted-foreground">Un bouton « Commander » sur le site du restaurant, qui ouvre la carte sans quitter la page.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div><Label htmlFor="emb-label">Texte du bouton</Label><Input id="emb-label" maxLength={30} value={label} onChange={(e) => setLabel(e.target.value)} /></div>
        <div>
          <Label htmlFor="emb-hex">Couleur</Label>
          <div className="flex gap-2">
            <input type="color" aria-label="Choisir la couleur" className="h-11 w-14 shrink-0 cursor-pointer rounded border border-border bg-transparent" value={okColor ? color : def} onChange={(e) => setColor(e.target.value)} />
            <Input id="emb-hex" value={color} onChange={(e) => setColor(e.target.value.trim())} aria-invalid={!okColor} />
          </div>
        </div>
        <div>
          <Label>Position</Label>
          <div className="flex gap-2">{(["right", "left"] as const).map((p) => <Button key={p} type="button" variant={position === p ? "default" : "outline"} className="min-h-11 flex-1" onClick={() => setPosition(p)}>{p === "right" ? "Droite" : "Gauche"}</Button>)}</div>
        </div>
        <div>
          <Label>Affichage</Label>
          <div className="flex gap-2">{(["floating", "inline"] as const).map((m) => <Button key={m} type="button" variant={mode === m ? "default" : "outline"} className="min-h-11 flex-1" onClick={() => setMode(m)}>{m === "floating" ? "Flottant" : "Dans la page"}</Button>)}</div>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="emb-dom">Domaines autorisés (facultatif, un par ligne)</Label>
          <textarea id="emb-dom" rows={3} className="w-full rounded-md border border-input bg-background p-2 text-sm" placeholder="https://www.mon-restaurant.fr" value={domains} onChange={(e) => setDomains(e.target.value)} />
          {badDomain && <p className="text-xs text-destructive">« {badDomain} » doit commencer par https://</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={submit} disabled={busy}><Save /> {busy ? "Enregistrement…" : "Enregistrer le bouton"}</Button>
        <Button variant="outline" onClick={test}><ExternalLink /> Tester</Button>
      </div>

      <h3 className="mt-6 text-xl">Code à coller sur votre site</h3>
      <CopyBox value={code} label="Code copié" />
      <p className="mt-2 text-xs text-muted-foreground">Collez ce code juste avant <code>&lt;/body&gt;</code> sur votre site (WordPress : extension « Insert Headers and Footers » ; Wix : Paramètres → Code personnalisé ; Shopify : theme.liquid).</p>

      <h3 className="mt-6 text-xl">Lien simple</h3>
      <p className="text-sm text-muted-foreground">Si votre site n'accepte pas de code : un lien vers votre carte.</p>
      <CopyBox value={link} label="Lien copié" />
      <CopyBox value={`<a href="${link}" target="_blank" rel="noopener">Commander en ligne</a>`} label="Code copié" />

      <h3 className="mt-6 text-xl">Page Facebook</h3>
      <CopyBox value={fb} label="Lien copié" />
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Sur votre Page Facebook, cliquez sur « Modifier le bouton d'action ».</li>
        <li>Choisissez « Commander » ou « Réserver », puis « Lien vers un site web ».</li>
        <li>Collez le lien ci-dessus et enregistrez.</li>
      </ol>
      <p className="mt-1 text-xs text-muted-foreground">Facebook n'autorise pas les scripts : on utilise uniquement le lien.</p>
    </section>
  );
}
