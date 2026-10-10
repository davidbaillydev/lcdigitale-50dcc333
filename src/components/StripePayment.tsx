import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";

const cache: Record<string, ReturnType<typeof loadStripe>> = {};

/** Formulaire sécurisé Stripe (carte, Apple Pay, Google Pay). */
export function StripePayment({ publishableKey, clientSecret, returnUrl, label, onCancel, setup = false }: { publishableKey: string; clientSecret: string; returnUrl: string; label: string; onCancel: () => void; setup?: boolean }) {
  const stripe = useMemo(() => (cache[publishableKey] ??= loadStripe(publishableKey)), [publishableKey]);
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return (
    <Elements stripe={stripe} options={{ clientSecret, locale: "fr", appearance: { theme: dark ? "night" : "stripe" } }}>
      <Form returnUrl={returnUrl} label={label} onCancel={onCancel} setup={setup} />
    </Elements>
  );
}

function Form({ returnUrl, label, onCancel, setup }: { returnUrl: string; label: string; onCancel: () => void; setup: boolean }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true); setErr("");
    const { error } = setup
      ? await stripe.confirmSetup({ elements, confirmParams: { return_url: returnUrl }, redirect: "if_required" })
      : await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl }, redirect: "if_required" });
    // Carte : 3DS dans la modale Stripe, sans quitter la page ; succès → page de suivi
    if (!error) { window.location.assign(returnUrl); return; }
    setErr(error?.message ?? "Le paiement n'a pas abouti.");
    setBusy(false);
  };
  return (
    <div className="space-y-4">
      <PaymentElement options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }} />
      {err && <p role="alert" className="rounded bg-destructive/20 p-2 text-sm">{err}</p>}
      <Button size="lg" className="w-full font-semibold" disabled={!stripe || busy} onClick={pay}>{busy ? "Paiement…" : label}</Button>
      <Button variant="ghost" className="w-full" disabled={busy} onClick={onCancel}>Modifier ma commande</Button>
      <p className="text-center text-xs text-muted-foreground">Paiement sécurisé par Stripe. Vos données bancaires ne transitent pas par le restaurant.</p>
    </div>
  );
}
