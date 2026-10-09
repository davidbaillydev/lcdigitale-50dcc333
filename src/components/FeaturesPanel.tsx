import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { saveRestaurantFeatures } from "@/lib/agency.functions";
import { FEATURES, featuresOf, type FeatureKey, type Features } from "@/lib/features";
import { Switch } from "@/components/ui/switch";

/** Matrice des modules activés (agence uniquement). Chaque bascule est enregistrée immédiatement. */
export function FeaturesPanel({ restaurantId, initial, onSaved }: { restaurantId: string; initial: unknown; onSaved?: () => void }) {
  const save = useServerFn(saveRestaurantFeatures);
  const [f, setF] = useState<Features>(() => featuresOf(initial));
  const [busy, setBusy] = useState<FeatureKey | null>(null);
  const toggle = async (k: FeatureKey, v: boolean) => {
    const prev = f; const next = { ...f, [k]: v };
    setF(next); setBusy(k);
    try {
      await save({ data: { id: restaurantId, features: next } });
      toast.success(`${FEATURES.find(([x]) => x === k)?.[1]} ${v ? "activé" : "désactivé"}`);
      onSaved?.();
    } catch (e) { setF(prev); toast.error((e as Error).message); } finally { setBusy(null); }
  };
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-3xl">Modules de l'abonnement</h2>
      <p className="mb-4 text-sm text-muted-foreground">Les modules désactivés disparaissent de l'espace du restaurant et sont bloqués par le serveur.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {FEATURES.map(([k, label, hint]) => (
          <label key={k} className="flex min-h-16 items-center justify-between gap-4 rounded-lg border border-border p-3">
            <span><span className="font-medium">{label}</span><span className="block text-sm text-muted-foreground">{hint}</span></span>
            <Switch checked={f[k]} disabled={busy !== null} onCheckedChange={(v) => void toggle(k, v)} aria-label={label} />
          </label>
        ))}
      </div>
    </section>
  );
}
