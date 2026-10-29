import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { savePlatformFeeChannels } from "@/lib/agency.functions";
import { PLATFORM_FEE_CHANNELS, platformFeeDefaults, type PlatformFeeChannel, type PlatformFeeConfig } from "@/lib/platform-fee";
import { Switch } from "@/components/ui/switch";

/** Canaux soumis à la commission Mollie de 7 % (agence uniquement). Enregistrement immédiat. */
export function PlatformFeePanel({ restaurantId, initial, onSaved }: { restaurantId: string; initial: unknown; onSaved?: () => void }) {
  const save = useServerFn(savePlatformFeeChannels);
  const [cfg, setCfg] = useState<PlatformFeeConfig>(() => platformFeeDefaults(initial));
  const [busy, setBusy] = useState(false);
  const toggle = async (k: PlatformFeeChannel, v: boolean) => {
    const prev = cfg; const next = { modes: { ...cfg.modes, [k]: v } };
    setCfg(next); setBusy(true);
    try {
      await save({ data: { id: restaurantId, modes: next.modes } });
      toast.success(`Commission 7 % ${v ? "appliquée" : "retirée"} : ${PLATFORM_FEE_CHANNELS.find(([c]) => c === k)?.[1]}`);
      onSaved?.();
    } catch (e) { setCfg(prev); toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-3xl">Commission Mollie 7 %</h2>
      <p className="mb-4 text-sm text-muted-foreground">Choisissez les canaux sur lesquels la commission plateforme est prélevée lors d'un paiement Mollie (comptes reliés via Mollie Connect). Les paiements déjà effectués ne changent pas.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {PLATFORM_FEE_CHANNELS.map(([k, label]) => (
          <label key={k} className="flex min-h-16 items-center justify-between gap-4 rounded-lg border border-border p-3">
            <span className="font-medium">{label}</span>
            <Switch checked={cfg.modes[k]} disabled={busy} onCheckedChange={(v) => void toggle(k, v)} aria-label={`Commission 7 % — ${label}`} />
          </label>
        ))}
      </div>
    </section>
  );
}
