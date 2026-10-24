import { useEffect, useState } from "react";
import { Bluetooth, CheckCircle2, Printer, Search, Smartphone, Usb, Wifi, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { sampleOrder, useTicketWidth, type TicketShop, type TicketWidth } from "@/lib/ticket";
import { ticketEscpos } from "@/lib/escpos";
import {
  bridgeHealth, DEFAULT_BRIDGE, detectBluetooth, detectUsb, discoverNetwork, getPrinter, isAndroid, savePrinter, sendToPrinter, support,
  type PrinterConfig, type PrinterType,
} from "@/lib/printer";

const TYPES: { t: PrinterType; label: string; hint: string; icon: typeof Wifi }[] = [
  { t: "rawbt", label: "RawBT (Android)", hint: "Toutes marques d'imprimantes, via l'application RawBT sur tablette Android.", icon: Smartphone },
  { t: "bluetooth", label: "Bluetooth", hint: "Imprimante sans fil appairée à la tablette (Chrome Android / ordinateur).", icon: Bluetooth },
  { t: "network", label: "Wi-Fi / réseau", hint: "Imprimante branchée sur la box ou en Wi-Fi, via le pont LC Print.", icon: Wifi },
  { t: "usb", label: "USB", hint: "Imprimante reliée par câble à l'ordinateur (Chrome / Edge).", icon: Usb },
];
const RAWBT_DRAFT: PrinterConfig = { type: "rawbt", name: "RawBT (Android)" };

/** Ajout, détection, test et validation de l'imprimante de cet appareil. */
export function PrinterSetup({ shop, width: defaultWidth, compact }: { shop: TicketShop; width: TicketWidth; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<PrinterConfig | null>(null);
  const [type, setType] = useState<PrinterType>("bluetooth");
  const [draft, setDraft] = useState<PrinterConfig | null>(null);
  const [bridge, setBridge] = useState(DEFAULT_BRIDGE);
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);
  const [found, setFound] = useState<{ host: string; port: number }[]>([]);
  const [host, setHost] = useState(""); const [port, setPort] = useState(9100);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tested, setTested] = useState(false);
  const [width, setWidth] = useTicketWidth(defaultWidth);
  const [sup, setSup] = useState<Record<PrinterType, boolean>>({ rawbt: true, bluetooth: false, usb: false, network: true });

  const reset = (t: PrinterType) => { setType(t); setDraft(t === "rawbt" ? RAWBT_DRAFT : null); setMsg(null); setTested(false); setFound([]); };
  useEffect(() => {
    if (!open) return;
    const cur = getPrinter(); setCurrent(cur);
    const s = support(); setSup(s);
    reset(cur?.type ?? (isAndroid() ? "rawbt" : s.bluetooth ? "bluetooth" : "network"));
  }, [open]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ ok: false, text: (e as Error).message || "Opération annulée" }); } finally { setBusy(false); }
  };
  const detect = () => run(async () => {
    if (type === "bluetooth") { const name = await detectBluetooth(); setDraft({ type, name }); setMsg({ ok: true, text: `${name} détectée et connectée.` }); }
    else if (type === "usb") { const name = await detectUsb(); setDraft({ type, name, baud: 9600 }); setMsg({ ok: true, text: `${name} autorisée.` }); }
    else if (type === "network") {
      await bridgeHealth(bridge).catch(() => { setBridgeOk(false); throw new Error("Pont LC Print introuvable sur cet ordinateur. Lancez-le puis réessayez."); });
      setBridgeOk(true);
      const list = await discoverNetwork(bridge); setFound(list);
      setMsg(list.length ? { ok: true, text: `${list.length} imprimante(s) trouvée(s) sur le réseau.` } : { ok: false, text: "Aucune imprimante trouvée. Saisissez son adresse IP (imprimée sur sa page de test)." });
    }
  });
  const pickNetwork = (h: string, p: number) => { setHost(h); setPort(p); setDraft({ type: "network", name: `Imprimante ${h}`, host: h, port: p, bridgeUrl: bridge }); setTested(false); };
  const test = () => run(async () => {
    const d = type === "network" ? { type, name: `Imprimante ${host}`, host, port, bridgeUrl: bridge } as PrinterConfig : type === "rawbt" ? RAWBT_DRAFT : draft;
    if (!d) throw new Error("Détectez d'abord l'imprimante.");
    if (d.type === "network" && !/^[\w.-]+$/.test(host)) throw new Error("Adresse IP invalide.");
    setDraft(d);
    await sendToPrinter(d, ticketEscpos(sampleOrder(), "kitchen", width, shop));
    setTested(true);
    setMsg({ ok: true, text: d.type === "rawbt" ? "Ticket envoyé à RawBT. S'il est bien sorti, validez l'imprimante." : "Ticket de test envoyé. S'il est bien sorti, validez l'imprimante." });
  });
  const validate = () => { if (!draft) return; const p = { ...draft, width }; savePrinter(p); setCurrent(p); setMsg({ ok: true, text: `Imprimante enregistrée sur cet appareil (format ${width} mm mémorisé). Les tickets partiront directement, sans fenêtre d'impression.` }); };
  const remove = () => { savePrinter(null); setCurrent(null); setMsg({ ok: true, text: "Imprimante retirée : retour à l'impression par le navigateur." }); };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size={compact ? "sm" : "default"}><Printer /> {current ? current.name : "Ajouter une imprimante"}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Imprimante de cet appareil</DialogTitle></DialogHeader>
        {current && (
          <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
            <span><b>{current.name}</b> · {TYPES.find((x) => x.t === current.type)?.label} · {width} mm</span>
            <Button size="sm" variant="ghost" onClick={remove}>Retirer</Button>
          </div>
        )}

        <p className="text-sm text-muted-foreground">Format du rouleau sur cet appareil</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Largeur du rouleau">
          {([80, 58] as TicketWidth[]).map((w) => (
            <button key={w} type="button" role="radio" aria-checked={width === w} onClick={() => { setWidth(w); setTested(false); }}
              className={cn("min-h-12 rounded-lg border p-2 text-sm font-semibold", width === w ? "border-primary bg-primary/10" : "border-border")}>{w} mm</button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">1. Choisissez le type de connexion</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TYPES.map(({ t, label, icon: Icon }) => (
            <button key={t} type="button" disabled={!sup[t]} onClick={() => reset(t)}
              className={cn("flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center text-xs disabled:opacity-40", type === t ? "border-primary bg-primary/10" : "border-border")}>
              <Icon className="h-5 w-5" />{label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{TYPES.find((x) => x.t === type)?.hint}{!sup[type] && " Non pris en charge par ce navigateur."}</p>

        <details className="rounded-lg border border-border p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Marques et modèles compatibles</summary>
          <p className="mt-2 text-xs text-muted-foreground">Toute imprimante thermique de tickets <b>ESC/POS</b> (la norme de 90 % des imprimantes de caisse) fonctionne. Marques courantes testées ou signalées :</p>
          <ul className="mt-2 space-y-1.5 text-xs">
            <li><b>Epson</b> — TM-T20, TM-T70, TM-T88, TM-m30 (référence du marché, Wi-Fi / USB / Bluetooth selon modèle)</li>
            <li><b>Star Micronics</b> — TSP100, TSP650, mC-Print3 (très répandues en restauration)</li>
            <li><b>Xprinter</b> — XP-58, XP-80, XP-Q200 (entrée de gamme fiable, 58 et 80 mm)</li>
            <li><b>Metapace, Custom, Bixolon, Sewoo, Citizen</b> — compatibles ESC/POS</li>
            <li><b>Imprimantes « no-name » 58/80 mm</b> (Amazon, AliExpress) — la plupart parlent ESC/POS ; vérifiez la mention « ESC/POS » sur la fiche produit</li>
          </ul>
          <p className="mt-2 text-xs text-muted-foreground"><b>Conseil de connexion :</b> Wi-Fi/réseau = le plus stable en cuisine · Bluetooth = pratique sur tablette · USB = ordinateur fixe · RawBT = n'importe quelle imprimante reliée à une tablette Android. Évitez les imprimantes « étiquettes » (Zebra, Dymo) : ce ne sont pas des imprimantes de tickets.</p>
        </details>

        {type === "rawbt" ? (
          <ol className="list-decimal space-y-2 rounded-lg border border-border p-3 pl-7 text-sm">
            <li>Installez <b>RawBT Print Service</b> depuis le <a className="underline" href="https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter" target="_blank" rel="noreferrer">Google Play Store</a> sur la tablette Android.</li>
            <li>Dans l'application RawBT, connectez votre imprimante (Wi-Fi, Bluetooth ou USB, n'importe quelle marque).</li>
            <li>Revenez ici, imprimez un test puis validez : les tickets sortiront directement.</li>
            {!isAndroid() && <li className="list-none text-xs text-muted-foreground">RawBT fonctionne uniquement sur Android : ouvrez cette page sur la tablette.</li>}
          </ol>
        ) : (
          <>
            {type === "network" && (
              <div className="space-y-2">
                <Label htmlFor="bridge">Adresse du pont LC Print</Label>
                <Input id="bridge" value={bridge} onChange={(e) => { setBridge(e.target.value); setBridgeOk(null); }} />
                {bridgeOk === false && <p className="text-xs text-muted-foreground">Installez Node.js sur l'ordinateur du restaurant, téléchargez <a className="underline" href="/lc-print-bridge.mjs" download>le pont LC Print</a> puis lancez <code>node lc-print-bridge.mjs</code>.</p>}
              </div>
            )}
            <p className="text-sm text-muted-foreground">2. Détectez l'imprimante (allumée et à proximité)</p>
            <Button onClick={detect} disabled={busy || !sup[type]}><Search /> {busy ? "Recherche…" : "Rechercher"}</Button>
            {type === "network" && (
              <div className="space-y-2">
                {found.map((f) => (
                  <button key={f.host} type="button" onClick={() => pickNetwork(f.host, f.port)} className={cn("block w-full rounded border p-2 text-left text-sm", host === f.host ? "border-primary" : "border-border")}>{f.host}:{f.port}</button>
                ))}
                <div className="flex gap-2">
                  <Input aria-label="Adresse IP" placeholder="192.168.1.50" value={host} onChange={(e) => pickNetwork(e.target.value, port)} />
                  <Input aria-label="Port" type="number" className="w-24" value={port} onChange={(e) => pickNetwork(host, Number(e.target.value))} />
                </div>
              </div>
            )}
          </>
        )}

        <p className="text-sm text-muted-foreground">{type === "rawbt" ? "Testez puis validez" : "3. Testez puis validez"}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={test} disabled={busy || (type === "network" ? !host : type === "rawbt" ? false : !draft)}>Imprimer un test</Button>
          <Button onClick={validate} disabled={!tested || !draft}>Valider l'imprimante</Button>
        </div>
        {msg && <p role={msg.ok ? "status" : "alert"} className={cn("flex gap-2 rounded p-2 text-sm", msg.ok ? "bg-primary/15" : "bg-destructive/20")}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}{msg.text}</p>}
      </DialogContent>
    </Dialog>
  );
}
