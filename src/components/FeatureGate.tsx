import { Lock } from "lucide-react";
import { useStaff } from "@/hooks/use-staff";
import { useRestaurantFeatures } from "@/hooks/use-restaurant-features";
import { FEATURE_OFF_MESSAGE, FEATURES, type FeatureKey } from "@/lib/features";

export function FeatureOff({ feature, public: pub }: { feature: FeatureKey; public?: boolean }) {
  const label = FEATURES.find(([k]) => k === feature)?.[1] ?? feature;
  return (
    <div className="mx-auto max-w-md p-10 text-center">
      <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
      <h1 className="mt-3 text-3xl">{pub ? "Service indisponible" : FEATURE_OFF_MESSAGE}</h1>
      <p className="mt-2 text-muted-foreground">{pub ? `« ${label} » n'est pas proposé par cet établissement.` : `Le module « ${label} » n'est pas activé pour ce restaurant. Contactez votre agence LC Digitale pour l'ajouter.`}</p>
    </div>
  );
}

/** Bloque une page privée de /espace/$slug si le module est désactivé. */
export function FeatureGate({ slug, feature, children }: { slug: string; feature: FeatureKey; children: React.ReactNode }) {
  const { restaurants, loading } = useStaff();
  const rid = restaurants.find((r) => r.slug === slug)?.id;
  const f = useRestaurantFeatures(rid);
  if (loading || (rid && f.loading)) return <p className="p-10 text-center text-muted-foreground">Chargement…</p>;
  if (rid && !f.features[feature]) return <FeatureOff feature={feature} />;
  return <>{children}</>;
}
