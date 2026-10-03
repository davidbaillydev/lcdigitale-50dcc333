import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Delete, Lock } from "lucide-react";
import { verifyKitchenPin } from "@/lib/kitchen-pin.functions";
import { Button } from "@/components/ui/button";

/** Écran de verrouillage plein écran déverrouillable par code PIN cuisine. */
export function KitchenLock({ restaurantId, name, onUnlock }: { restaurantId: string; name: string; onUnlock: () => void }) {
  const verify = useServerFn(verifyKitchenPin);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (p: string) => {
    setBusy(true); setErr("");
    try {
      const r = await verify({ data: { restaurantId, pin: p } });
      if (r.ok) onUnlock(); else { setErr("Code incorrect"); setPin(""); }
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); setPin(""); }
    finally { setBusy(false); }
  };
  const press = (d: string) => { if (busy || pin.length >= 6) return; setPin(pin + d); setErr(""); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Enter" && pin.length >= 4) void submit(pin);
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background p-6" role="dialog" aria-label="Tablette verrouillée">
      <Lock className="h-10 w-10 text-primary" />
      <div className="text-center"><h1 className="text-5xl">{name}</h1><p className="text-muted-foreground">Entrez le code PIN cuisine</p></div>
      <div className="flex h-6 gap-3" aria-live="polite">{Array.from({ length: Math.max(4, pin.length) }).map((_, i) => <span key={i} className={`h-4 w-4 rounded-full border-2 border-primary ${i < pin.length ? "bg-primary" : ""}`} />)}</div>
      <p className="h-5 text-sm text-destructive">{err}</p>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <Button key={d} variant="secondary" className="h-20 w-20 text-3xl" onClick={() => press(d)}>{d}</Button>)}
        <Button variant="ghost" className="h-20 w-20" onClick={() => setPin(pin.slice(0, -1))} aria-label="Effacer"><Delete /></Button>
        <Button variant="secondary" className="h-20 w-20 text-3xl" onClick={() => press("0")}>0</Button>
        <Button className="h-20 w-20 text-xl" disabled={busy || pin.length < 4} onClick={() => submit(pin)}>OK</Button>
      </div>
    </div>
  );
}
