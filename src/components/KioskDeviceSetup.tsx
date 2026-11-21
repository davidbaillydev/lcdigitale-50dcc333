import { useState } from "react";
import { ArrowRight, Check, LockKeyhole, MapPin, Monitor, Search, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KioskPinGate } from "@/components/KioskSwitchDialog";
import { cn } from "@/lib/utils";
import type { KioskDevice } from "@/lib/kiosk-device";

export type SetupRestaurant = { id: string; slug: string; name: string; city: string | null; logo: string | null; kiosks: { id: string; label: string }[] };

export function KioskDeviceSetup({ restaurants, onLaunch }: { restaurants: SetupRestaurant[]; onLaunch: (device: KioskDevice) => Promise<void> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [kioskId, setKioskId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restaurant = restaurants.find((r) => r.id === selected);
  const filtered = restaurants.filter((r) => `${r.name} ${r.city ?? ""}`.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")));
  const launch = async () => {
    if (!restaurant || !kioskId || !restaurant.kiosks.some((k) => k.id === kioskId)) return;
    try { await onLaunch({ slug: restaurant.slug, kioskId }); }
    catch (e) { setPinOpen(false); setError(e instanceof Error ? e.message : "Impossible de démarrer la borne."); }
  };
  return <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-6 sm:px-8 short:gap-4 short:py-4">
    <div><h1 className="text-3xl font-semibold sm:text-4xl">Configurer cette borne</h1></div>
    <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] short:gap-4">
      <section className="flex min-h-0 flex-col">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="flex items-center gap-3 text-xl font-semibold"><span className="grid size-8 place-items-center rounded-full bg-primary text-base text-primary-foreground">1</span>Restaurant</h2><span className="text-sm text-muted-foreground">{restaurants.length} établissements</span></div>
        <label className="relative mb-4 block"><Search className="pointer-events-none absolute left-4 top-4 size-5 text-muted-foreground" /><Input aria-label="Rechercher un restaurant" placeholder="Nom du restaurant ou ville" value={search} onChange={(e) => setSearch(e.target.value)} className="h-14 pl-12 text-base" /></label>
        <div className="grid max-h-[40dvh] content-start gap-3 overflow-y-auto pb-2 sm:grid-cols-2 lg:max-h-none lg:grid-cols-1 xl:grid-cols-2">
          {filtered.map((r) => <Button key={r.id} variant="outline" aria-pressed={selected === r.id} onClick={() => { setSelected(r.id); setKioskId(null); setError(null); }} className={cn("h-auto min-h-24 w-full justify-start gap-4 whitespace-normal rounded-lg p-4 text-left", selected === r.id && "border-primary bg-primary/10 ring-1 ring-primary")}>
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md bg-secondary">{r.logo ? <img src={r.logo} alt="" className="size-full object-contain p-1" /> : <Store className="size-7 text-primary" />}</span>
            <span className="min-w-0 flex-1"><span className="block break-words text-lg font-semibold">{r.name}</span>{r.city && <span className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3" />{r.city}</span>}</span>
            {selected === r.id && <Check className="size-5 shrink-0 text-primary" />}
          </Button>)}
          {!filtered.length && <p className="py-8 text-muted-foreground">Aucun restaurant trouvé.</p>}
        </div>
      </section>
      <section className="flex min-h-0 flex-col border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <h2 className="mb-4 flex items-center gap-3 text-xl font-semibold"><span className="grid size-8 place-items-center rounded-full bg-primary text-base text-primary-foreground">2</span>Borne</h2>
        {restaurant ? <><p className="mb-4 break-words text-lg font-semibold">{restaurant.name}</p><div className="grid content-start gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-1">
          {restaurant.kiosks.map((k) => <Button key={k.id} variant="outline" aria-pressed={kioskId === k.id} onClick={() => { setKioskId(k.id); setError(null); }} className={cn("h-auto min-h-16 justify-start whitespace-normal rounded-lg px-4 py-3 text-left", kioskId === k.id && "border-primary bg-primary/10 ring-1 ring-primary")}><Monitor className="size-5 shrink-0 text-primary" /><span className="min-w-0 flex-1 break-words"><span className="block text-base font-semibold">{k.label}</span><span className="text-sm text-muted-foreground">Identifiant : {k.id}</span></span>{kioskId === k.id && <Check className="size-4 text-primary" />}</Button>)}
          {!restaurant.kiosks.length && <p className="text-muted-foreground">Aucune borne active déclarée. Contactez l’agence pour ajouter ou réactiver une borne.</p>}
        </div></> : <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center text-muted-foreground"><Monitor className="size-10" /><p>Sélectionnez un restaurant.</p></div>}
      </section>
    </div>
    <footer className="flex shrink-0 flex-col justify-between gap-4 border-t border-border pt-5 sm:flex-row sm:items-center">
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="size-4 shrink-0" />Code PIN du restaurant requis</p>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <Button disabled={!restaurant || !kioskId} onClick={() => setPinOpen(true)} className="h-14 whitespace-normal px-7 text-lg">Valider et démarrer<ArrowRight className="size-5" /></Button>
    </footer>
    {pinOpen && restaurant && <KioskPinGate key={restaurant.id} restaurantId={restaurant.id} onOk={launch} onClose={() => setPinOpen(false)} />}
  </div>;
}