import { annualEnd } from "./kiosk-licenses";
import { kioskReadersOf } from "./kiosk-readers";

export type KioskDashboardData = {
  restaurants: { id: string; name: string; city: string | null; active: boolean; logo_url: string | null; config: unknown }[];
  licenses: { id: string; restaurant_id: string; kiosk_id: string; label: string; starts_on: string; ends_on: string; status: string }[];
  billing: { license_id: string; starts_on: string; ends_on: string; status: string; due_on: string | null }[];
};
export function kioskPayment(data: KioskDashboardData, license: KioskDashboardData["licenses"][number] | undefined) {
  if (!license) return { status: "missing", label: "Sans licence", due: null };
  const bill = data.billing.find((b) => b.license_id === license.id && b.starts_on === license.starts_on && b.ends_on === license.ends_on && b.status !== "cancelled");
  return { status: bill?.status ?? "to_invoice", label: bill?.status === "paid" ? "Payée" : bill?.status === "invoiced" ? "Impayée" : "À facturer", due: bill?.due_on ?? license.ends_on };
}
export function kioskRestaurantRows(data: KioskDashboardData) {
  return data.restaurants.map((restaurant) => {
    const declared = kioskReadersOf(restaurant.config);
    const licenses = data.licenses.filter((l) => l.restaurant_id === restaurant.id);
    const all = [...declared, ...licenses.filter((l) => !declared.some((k) => k.id === l.kiosk_id)).map((l) => ({ id: l.kiosk_id, label: l.label || `Borne ${l.kiosk_id}`, active: false, reader: "" }))];
    const kiosks = all.map((k) => {
      const license = licenses.find((l) => l.kiosk_id === k.id);
      return { ...k, label: license?.label || k.label, declared: declared.some((d) => d.id === k.id), license, payment: kioskPayment(data, license) };
    });
    return { restaurant, kiosks, unpaid: kiosks.filter((k) => k.payment.status === "invoiced").length };
  });
}
/** Demo records never enter live restaurants, billing, or kiosk configuration. */
export function kioskDemoData(today: string): KioskDashboardData {
  const names = [["Le Comptoir Toulousain", "Toulouse", 3], ["Maison du Poulet", "Blagnac", 2], ["Bistro des Halles", "Colomiers", 4]] as const;
  const restaurants = names.map(([name, city, count], i) => ({ id: `demo-${i}`, name, city, active: true, logo_url: null, config: { kioskReaders: Array.from({ length: count }, (_, j) => ({ id: String(j + 1), label: `Borne ${j + 1} · ${["Entrée", "Comptoir", "Terrasse", "Étage"][j]}`, reader: "", active: true })) } }));
  const licenses = restaurants.flatMap((r) => kioskReadersOf(r.config).map((k) => ({ id: `DEMO-${r.id.slice(-1)}-${k.id}`, restaurant_id: r.id, kiosk_id: k.id, label: k.label, status: "active", starts_on: today, ends_on: annualEnd(today) })));
  const billing = licenses.map((l, i) => ({ license_id: l.id, starts_on: l.starts_on, ends_on: l.ends_on, status: i === 1 || i === 5 ? "invoiced" : "paid", due_on: i === 1 || i === 5 ? today : l.ends_on }));
  return { restaurants, licenses, billing };
}
export function demoKioskActive(data: KioskDashboardData, restaurantId: string, kioskId: string, active: boolean): KioskDashboardData {
  return { ...data, restaurants: data.restaurants.map((r) => r.id === restaurantId ? { ...r, config: { kioskReaders: kioskReadersOf(r.config).map((k) => k.id === kioskId ? { ...k, active } : k) } } : r) };
}