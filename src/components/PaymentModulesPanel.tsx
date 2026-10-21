// Visibilité des modules de paiement proposés au restaurant (agence uniquement).
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { savePaymentModules } from "@/lib/restaurant-settings.functions";

export type PaymentModules = { stripe: boolean; mollie: boolean; paypal: boolean; lyra: boolean; sumup: boolean };

export const DEFAULT_PAYMENT_MODULES: PaymentModules = { stripe: true, mollie: true, paypal: true, lyra: true, sumup: true };

export function paymentModulesOf(config: unknown): PaymentModules {
  const m = (config as { paymentModules?: Partial<PaymentModules> } | null)?.paymentModules ?? {};
  return { ...DEFAULT_PAYMENT_MODULES, ...m };
}

const LABELS: [keyof PaymentModules, string, string][] = [
  ["stripe", "Stripe", "Paiement en ligne par carte, Apple Pay, Google Pay + terminal Stripe Terminal de la borne."],
  ["mollie", "Mollie", "Paiement en ligne (carte, Bancontact, iDEAL), Mollie Connect et terminal Mollie POS de la borne."],
  ["paypal", "PayPal", "Paiement en ligne avec compte PayPal ou carte via PayPal."],
  ["lyra", "Lyra / PayZen", "Paiement par carte sur la page sécurisée de la banque (PayZen, Systempay, Sogecommerce…)."],
  ["sumup", "SumUp", "Terminal SumUp Solo relié à la borne."],
];

export function PaymentModulesPanel({ restaurantId, initial, onSaved }: { restaurantId: string; initial?: unknown; onSaved?: () => void }) {
  const [modules, setModules] = useState<PaymentModules>(() => paymentModulesOf(initial));
  const [busy, setBusy] = useState(false);
  const save = useServerFn(savePaymentModules);
  const submit = async () => {
    setBusy(true);
    try { await save({ data: { restaurantId, modules } }); toast.success("Modules de paiement enregistrés"); onSaved?.(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Enregistrement impossible"); }
    finally { setBusy(false); }
  };
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-1 text-3xl">Modules de paiement proposés</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Choisissez les prestataires que ce restaurant peut connecter. Un module masqué disparaît de la section « Prestataires de paiement » ; les clés déjà enregistrées sont conservées.
      </p>
      <div className="space-y-2">
        {LABELS.map(([key, label, hint]) => (
          <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <p className="font-medium">{label}</p>
              <p className="text-sm text-muted-foreground">{hint}</p>
            </div>
            <Switch aria-label={`Afficher ${label}`} checked={modules[key]} onCheckedChange={(v) => setModules({ ...modules, [key]: v })} />
          </div>
        ))}
      </div>
      <Button className="mt-4 min-h-12" onClick={submit} disabled={busy}><Save aria-hidden="true" />{busy ? "Enregistrement…" : "Enregistrer les modules"}</Button>
    </section>
  );
}
