// Pont vers l'application Android « LC Cuisine » (Capacitor). Sans application native, tout renvoie null/false
// et le site garde son fonctionnement navigateur. Le proxy officiel couvre Capacitor 7 ; l'objet injecté reste un repli.
import { Capacitor, registerPlugin } from "@capacitor/core";

type LcKitchen = {
  keepAwake(o: { on: boolean }): Promise<void>;
  setFullscreen(o: { on: boolean }): Promise<void>;
  lockTask(o: { on: boolean }): Promise<void>;
  ring(): Promise<{ alarmVolume: number }>;
  print(o: { host: string; port: number; data: string }): Promise<void>;
  discover(o: { subnet: string }): Promise<{ printers: string[] }>;
};
type CapWindow = { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { LcKitchen?: LcKitchen } } };
const lcKitchenPlugin = registerPlugin<LcKitchen>("LcKitchen");

export function nativeKitchen(): LcKitchen | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as CapWindow).Capacitor;
  if (!Capacitor.isNativePlatform() && !cap?.isNativePlatform?.()) return null;
  return cap?.Plugins?.LcKitchen ?? lcKitchenPlugin;
}
export const isNativeKitchen = () => nativeKitchen() !== null;

/** Préfixe /24 valide d'un réseau local (ex. « 192.168.1 »), sinon null. */
export function localSubnet(host: string): string | null {
  const m = /^(10|172\.(1[6-9]|2\d|3[01])|192\.168)\.(\d{1,3})(\.\d{1,3})?/.exec(host.trim());
  if (!m) return null;
  const parts = host.trim().split(".").slice(0, 3);
  return parts.length === 3 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255) ? parts.join(".") : null;
}
