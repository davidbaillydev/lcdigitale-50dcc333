import { useEffect, useState } from "react";
import { Bluetooth, CheckCircle2, Printer, Search, Usb, Wifi, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { sampleOrder, type TicketShop, type TicketWidth } from "@/lib/ticket";
import { ticketEscpos } from "@/lib/escpos";
import {
  bridgeHealth, DEFAULT_BRIDGE, detectBluetooth, detectUsb, discoverNetwork, getPrinter, savePrinter, sendToPrinter, support,
  type PrinterConfig, type PrinterType,
} from "@/lib/printer";

const TYPES: { t: PrinterType; label: string; hint: string; icon: typeof Wifi }[] = [
  { t: "bluetooth", label: "Bluetooth", hint: "Imprimante sans fil appairée à la tablette (Chrome Android / ordinateur).", icon: Bluetooth },
  { t: "network", label: "Wi-Fi / réseau", hint: "Imprimante branchée sur la box ou en Wi-Fi, via le pont LC Print.", icon: Wifi },
  { t: "usb", label: "USB", hint: "Imprimante reliée par câble à l'ordinateur (Chrome / Edge).", icon: Usb },
];

/** Ajout, détection, test et validation de l'imprimante de cet appareil. */
export function PrinterSetup({ shop, width, compact }: { shop: TicketShop; width: TicketWidth; compact?: boolean }) {
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
  const sup = support();

  useEffect(() => { setCurrent(getPrinter()); }, [open]);
  const reset = (t: PrinterType) => { setType(t); setDraft(null); setMsg(null); setTested(false); setFound([]); };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ ok: false, text: (e as Error).message || "Opération annulée" }); } finally { setBusy(false); }
  };
  const detect = () => run(async () => {
    if (type === "bluetooth") { const name = await detectBluetooth(); setDraft({ type, name }); setMsg({ ok: true, text: `${name} détectée et connectée.` }); }
    else if (type === "usb") { const name = await detectUsb(); setDraft({ type, name, baud: 9600 }); setMsg({ ok: true, text: `${name} autorisée.` }); }
    else {
      await bridgeHealth(bridge).catch(() => { setBridgeOk(false); throw new Error("Pont LC Print introuvable sur cet ordinateur. Lancez-le puis réessayez."); });
      setBridgeOk(true);
      const list = await discoverNetwork(bridge); setFound(list);
      setMsg(list.length ? { ok: true, text: `${list.length} imprimante(s) trouvée(s) sur le réseau.` } : { ok: false, text: "Aucune imprimante trouvée. Saisissez son adresse IP (imprimée sur sa page de test)." });
    }
  });
  const pickNetwork = (h: string, p: number) => { setHost(h); setPort(p); setDraft({ type: "network", name: `Imprimante ${h}`, host: h, port: p, bridgeUrl: bridge }); setTested(false); };
  const test = () => run(async () => {
    const d = type === "network" ? { type, name: `Imprimante ${host}`, host, port, bridgeUrl: bridge } as PrinterConfig : draft;
    if (!d) throw new Error("Détectez d'abord l'imprimante.");
    if (d.type === "network" && !/^[\w.-]+$/.test(host)) throw new Error("Adresse IP invalide.");
    setDraft(d);
    await sendToPrinter(d, ticketEscpos(sampleOrder(), "kitchen", width, shop));
    setTested(true); setMsg({ ok: true, text: "Ticket de test envoyé. S'il est bien sorti, validez l'imprimante." });
  });
  const validate = () => { if (!draft) return; savePrinter(draft); setCurrent(draft); setMsg({ ok: true, text: "Imprimante enregistrée sur cet appareil. Les tickets partiront directement, sans fenêtre d'impression." }); };
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
        <p className="text-sm text-muted-foreground">1. Choisissez le type de connexion</p>
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map(({ t, label, icon: Icon }) => (
            <button key={t} type="button" disabled={!sup[t]} onClick={() => reset(t)}
              className={cn("flex flex-col items-center gap-1 rounded-lg border p-3 text-sm disabled:opacity-40", type === t ? "border-primary bg-primary/10" : "border-border")}>
              <Icon className="h-5 w-5" />{label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{TYPES.find((x) => x.t === type)?.hint}{!sup[type] && " Non pris en charge par ce navigateur."}</p>

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

        <p className="text-sm text-muted-foreground">3. Testez puis validez</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={test} disabled={busy || (type !== "network" ? !draft : !host)}>Imprimer un test</Button>
          <Button onClick={validate} disabled={!tested || !draft}>Valider l'imprimante</Button>
        </div>
        {msg && <p role={msg.ok ? "status" : "alert"} className={cn("flex gap-2 rounded p-2 text-sm", msg.ok ? "bg-primary/15" : "bg-destructive/20")}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}{msg.text}</p>}
      </DialogContent>
    </Dialog>
  );
}
