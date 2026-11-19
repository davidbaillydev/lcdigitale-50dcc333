import type { TicketOrder, TicketShop, KioskTicketContext } from "./ticket";
import { printKioskReceipt } from "./kiosk-print";

export type PrintState = "waiting" | "printing" | "printed" | "failed";
export type KioskPrintJob = { key: string; orderId: string; kiosk: KioskTicketContext; order: TicketOrder; shop: TicketShop; paid: boolean; state: PrintState; error?: string | undefined; createdAt: number };
type Store = Pick<Storage, "getItem" | "setItem">;
type Sender = (job: KioskPrintJob) => Promise<boolean>;
export const kioskQueueKey = (restaurant: string) => `lc-kiosk-print-queue:${restaurant}`;

/** One browser-local worker per restaurant; no server, payment or kitchen calls. */
export class KioskPrintQueue {
  private jobs: KioskPrintJob[] = [];
  private listeners = new Set<() => void>();
  private running = false;
  constructor(private restaurant: string, private storage: Store, private send: Sender = (j) => printKioskReceipt(j.order, j.shop, j.paid, j.kiosk)) {
    const raw = storage.getItem(kioskQueueKey(restaurant));
    if (raw) {
      const jobs = JSON.parse(raw) as KioskPrintJob[];
      if (!Array.isArray(jobs) || jobs.some((j) => !j.key || !j.order || !j.shop || !j.kiosk || !["waiting", "printing", "printed", "failed"].includes(j.state))) throw new Error("File locale illisible : contactez le personnel.");
      this.jobs = jobs.map((j) => j.state === "printing" ? { ...j, state: "failed", error: "Envoi interrompu : vérifiez si le ticket est sorti avant de réessayer." } : j);
      this.persist(this.jobs);
    }
  }
  getSnapshot = () => this.jobs;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private persist(jobs: KioskPrintJob[]) { this.storage.setItem(kioskQueueKey(this.restaurant), JSON.stringify(jobs)); }
  private change(key: string, state: PrintState, error?: string) {
    const next = this.jobs.map((j) => j.key === key ? { ...j, state, error } : j);
    this.persist(next); this.jobs = next; this.listeners.forEach((fn) => fn());
  }
  enqueue(input: Omit<KioskPrintJob, "key" | "state" | "createdAt">): string {
    const key = JSON.stringify([input.orderId, input.kiosk.id]);
    if (this.jobs.some((j) => j.key === key)) return key;
    // No tokens, customer session, catalog or printer credentials in the queue.
    const { catalog: _catalog, optionData: _options, ...shop } = input.shop;
    // Explicit printable fields only: createKioskOrder also returns access capabilities.
    const o = input.order;
    const order: TicketOrder = { order_number: o.order_number, currency: o.currency ?? "EUR", mode: o.mode, slot: o.slot, created_at: o.created_at ?? new Date().toISOString(), asap: o.asap ?? false, items: o.items, notes: o.notes ?? null, total: o.total, subtotal: o.subtotal ?? null, service_fee: o.service_fee ?? null, delivery_fee: o.delivery_fee ?? null, discount: o.discount ?? null, promo_code: o.promo_code ?? null, payment_method: o.payment_method, payment_status: o.payment_status ?? null, source: "kiosk", is_test: o.is_test ?? false };
    const next = [...this.jobs, { ...input, order, shop, key, state: "waiting" as const, createdAt: Date.now() }];
    this.persist(next); this.jobs = next; this.listeners.forEach((fn) => fn());
    return key;
  }
  async retry(key: string): Promise<boolean> {
    const job = this.jobs.find((j) => j.key === key);
    if (!job || job.state === "printing") return false;
    if (job.state === "printed") return true;
    if (job.state === "failed") this.change(key, "waiting");
    const finished = new Promise<void>((resolve) => {
      const stop = this.subscribe(() => {
        const state = this.jobs.find((j) => j.key === key)?.state;
        if (state === "printed" || state === "failed") { stop(); resolve(); }
      });
    });
    await this.drain();
    await finished;
    return this.jobs.find((j) => j.key === key)?.state === "printed";
  }
  async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (let job = this.jobs.find((j) => j.state === "waiting"); job; job = this.jobs.find((j) => j.state === "waiting")) {
        const key = job.key;
        this.change(key, "printing");
        let ok = false;
        try { ok = await this.send(job); } catch { /* explicit failed state */ }
        try { this.change(key, ok ? "printed" : "failed", ok ? undefined : "Imprimante indisponible ou envoi non confirmé. Vérifiez le papier avant de réessayer."); }
        catch {
          // Never announce success or automatically repeat a possibly delivered job.
          this.jobs = this.jobs.map((j) => j.key === key ? { ...j, state: "failed", error: "État non enregistré : vérifiez le ticket avant de réessayer." } : j);
          this.listeners.forEach((fn) => fn()); break;
        }
      }
    } finally { this.running = false; }
  }
}
const queues = new Map<string, KioskPrintQueue>();
export function deviceKioskQueue(restaurant: string): KioskPrintQueue {
  const existing = queues.get(restaurant);
  if (existing) return existing;
  const queue = new KioskPrintQueue(restaurant, window.localStorage);
  queues.set(restaurant, queue); return queue;
}