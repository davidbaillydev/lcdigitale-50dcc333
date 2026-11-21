import { kioskReadersOf } from "./kiosk-readers";

export const KIOSK_DEVICE_KEY = "lc-borne:device";
export type KioskDevice = { slug: string; kioskId: string };
type DeviceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Device identity only; never store PINs, access tokens, orders or printer settings here. */
export function parseKioskDevice(value: unknown): KioskDevice | null {
  if (!value || typeof value !== "object") return null;
  const { slug, kioskId } = value as Partial<KioskDevice>;
  if (typeof slug !== "string" || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(slug)) return null;
  if (typeof kioskId !== "string" || !/^[a-z0-9-]{1,20}$/.test(kioskId)) return null;
  return { slug, kioskId };
}

export function readKioskDevice(storage: DeviceStorage): KioskDevice | null {
  try { return parseKioskDevice(JSON.parse(storage.getItem(KIOSK_DEVICE_KEY) ?? "null")); }
  catch { return null; }
}

export function saveKioskDevice(storage: DeviceStorage, device: KioskDevice): void {
  const valid = parseKioskDevice(device);
  if (!valid) throw new Error("Configuration de borne invalide.");
  storage.setItem(KIOSK_DEVICE_KEY, JSON.stringify(valid));
  storage.setItem(`kiosk-id:${valid.slug}`, valid.kioskId);
}

export function clearKioskDevice(storage: DeviceStorage, slug?: string): void {
  const saved = readKioskDevice(storage);
  storage.removeItem(KIOSK_DEVICE_KEY);
  if (saved) storage.removeItem(`kiosk-id:${saved.slug}`);
  if (slug) storage.removeItem(`kiosk-id:${slug}`);
}

/** Setup selects registered, active kiosks only; never invents unlicensed numbers. */
export function setupKioskChoices(config: unknown) {
  const seen = new Set<string>();
  return kioskReadersOf(config).filter((k) => {
    if (!k.active || seen.has(k.id)) return false;
    seen.add(k.id); return true;
  }).map(({ id, label }) => ({ id, label }));
}

export function kioskDevicePath(device: KioskDevice): string {
  return `/${device.slug}/borne?borne=${encodeURIComponent(device.kioskId)}`;
}