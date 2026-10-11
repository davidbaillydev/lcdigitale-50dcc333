import type { Restaurant } from "@/lib/shop";

const DAY = ["0", "1", "2", "3", "4", "5", "6"];
const hhmm = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;

export function todayHours(r: Pick<Restaurant, "opening" | "config">) {
  if (r.config.hoursLabel) return r.config.hoursLabel;
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short" }).format(new Date());
  const idx = DAY[["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd)];
  const ranges = r.opening[idx ?? "0"] ?? [];
  return ranges.length ? ranges.map(([a, b]) => `${hhmm(a)}–${hhmm(b)}`).join(" · ") : "fermé aujourd'hui";
}

/** Bandeaux de fermeture : suspension manuelle, horaires, modes désactivés. */
export function OrderingBanners({ state, kiosk = false }: { state: { restaurant: Restaurant; paused: boolean; onlineOff: boolean; showClosed: boolean }; kiosk?: boolean }) {
  if (state.paused) return <p role="alert" className="bg-destructive px-4 py-3 text-center font-semibold text-destructive-foreground">🔴 Commandes momentanément indisponibles · Le menu reste consultable</p>;
  if (kiosk) return null;
  if (state.onlineOff) return <p role="alert" className="bg-destructive px-4 py-3 text-center font-semibold text-destructive-foreground">Commandes en ligne désactivées pour le moment</p>;
  if (state.showClosed) return <p role="status" className="bg-secondary px-4 py-3 text-center font-semibold text-secondary-foreground">Actuellement fermé · Horaires : {todayHours(state.restaurant)}</p>;
  return null;
}
