// Imprimante directe (ESC/POS) mémorisée par appareil : Bluetooth, USB/série, ou réseau Wi-Fi/Ethernet via le pont LC Print.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type PrinterType = "bluetooth" | "usb" | "network";
export type PrinterConfig = { type: PrinterType; name: string; host?: string; port?: number; bridgeUrl?: string; baud?: number };

const KEY = "lc-direct-printer";
const BT_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", "e7810a71-73ae-499d-8c15-faa9aef0c3f2", "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ff00-0000-1000-8000-00805f9b34fb", "0000ffe0-0000-1000-8000-00805f9b34fb", "0000fee7-0000-1000-8000-00805f9b34fb",
];
export const DEFAULT_BRIDGE = "http://localhost:9180";

export function getPrinter(): PrinterConfig | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; }
}
export function savePrinter(p: PrinterConfig | null) {
  if (p) localStorage.setItem(KEY, JSON.stringify(p)); else localStorage.removeItem(KEY);
}

export const support = () => ({
  bluetooth: typeof navigator !== "undefined" && "bluetooth" in navigator,
  usb: typeof navigator !== "undefined" && "serial" in navigator,
  network: true,
});

// ---- Bluetooth (BLE) ----
let btDevice: any = null;
let btChar: any = null;
export async function detectBluetooth(): Promise<string> {
  const bt = (navigator as any).bluetooth;
  btDevice = await bt.requestDevice({ acceptAllDevices: true, optionalServices: BT_SERVICES });
  btChar = null;
  await btCharacteristic();
  return btDevice.name || "Imprimante Bluetooth";
}
async function btCharacteristic() {
  if (btChar && btDevice?.gatt?.connected) return btChar;
  if (!btDevice) {
    const devs: any[] = (await (navigator as any).bluetooth?.getDevices?.()) ?? [];
    const name = getPrinter()?.name;
    btDevice = devs.find((d) => d.name === name) ?? null;
    if (!btDevice) throw new Error("Imprimante Bluetooth à reconnecter (bouton « Imprimante »).");
  }
  const server = await btDevice.gatt.connect();
  for (const s of await server.getPrimaryServices()) {
    for (const c of await s.getCharacteristics()) {
      if (c.properties.write || c.properties.writeWithoutResponse) { btChar = c; return c; }
    }
  }
  throw new Error("Cette imprimante Bluetooth n'accepte pas l'impression directe.");
}
async function sendBluetooth(data: Uint8Array) {
  const c = await btCharacteristic();
  for (let i = 0; i < data.length; i += 180) {
    const chunk = data.slice(i, i + 180);
    if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(chunk); else await c.writeValue(chunk);
    await new Promise((r) => setTimeout(r, 20));
  }
}

// ---- USB / série ----
let port: any = null;
export async function detectUsb(): Promise<string> {
  port = await (navigator as any).serial.requestPort();
  const i = port.getInfo?.() ?? {};
  return i.usbVendorId ? `Imprimante USB ${i.usbVendorId.toString(16)}:${(i.usbProductId ?? 0).toString(16)}` : "Imprimante USB";
}
async function sendUsb(data: Uint8Array, baud = 9600) {
  if (!port) { const ports = await (navigator as any).serial.getPorts(); port = ports[0]; }
  if (!port) throw new Error("Imprimante USB non autorisée sur cet appareil.");
  if (!port.writable) await port.open({ baudRate: baud });
  const w = port.writable.getWriter();
  try { await w.write(data); } finally { w.releaseLock(); }
}

// ---- Réseau via pont ----
const b64 = (d: Uint8Array) => { let s = ""; d.forEach((x) => (s += String.fromCharCode(x))); return btoa(s); };
export async function bridgeHealth(url: string) {
  const r = await fetch(`${url.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(3000) });
  if (!r.ok) throw new Error("Pont injoignable");
  return true;
}
export async function discoverNetwork(url: string): Promise<{ host: string; port: number }[]> {
  const r = await fetch(`${url.replace(/\/$/, "")}/discover`, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error("Recherche impossible");
  return (await r.json()).printers ?? [];
}
async function sendNetwork(p: PrinterConfig, data: Uint8Array) {
  const r = await fetch(`${(p.bridgeUrl || DEFAULT_BRIDGE).replace(/\/$/, "")}/print`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host: p.host, port: p.port ?? 9100, data: b64(data) }), signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error((await r.text()) || "Échec d'impression réseau");
}

export async function sendToPrinter(p: PrinterConfig, data: Uint8Array) {
  if (p.type === "bluetooth") return sendBluetooth(data);
  if (p.type === "usb") return sendUsb(data, p.baud);
  return sendNetwork(p, data);
}
