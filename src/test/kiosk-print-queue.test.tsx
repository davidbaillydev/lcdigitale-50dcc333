import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KioskPrintQueue, kioskQueueKey } from "@/lib/kiosk-print-queue";
import { KioskPrintQueuePanel } from "@/components/KioskPrintQueuePanel";
import { sampleOrder, kioskTicketLines, ticketHtml } from "@/lib/ticket";
import { ticketEscpos } from "@/lib/escpos";
import { printKioskReceipt } from "@/lib/kiosk-print";
import { getPrinter, sendToPrinter } from "@/lib/printer";

vi.mock("@/lib/printer", () => ({ getPrinter: vi.fn(), sendToPrinter: vi.fn() }));
const input = (orderId = "order-1", id = "1") => ({ orderId, kiosk: { id, label: "Entrée" }, order: { ...sampleOrder(), source: "kiosk" }, shop: { name: "Restaurant" }, paid: false });
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(cleanup);

describe("file locale borne", () => {
  it("persiste avant envoi, reste en impression jusqu’à confirmation et déduplique", async () => {
    let finish: (v: boolean) => void = () => {};
    const send = vi.fn(() => new Promise<boolean>((r) => { finish = r; }));
    const q = new KioskPrintQueue("r", localStorage, send);
    const key = q.enqueue(input());
    expect(q.enqueue(input())).toBe(key);
    expect(send).not.toHaveBeenCalled();
    expect(q.getSnapshot()).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(kioskQueueKey("r")) ?? "[]")[0].state).toBe("waiting");
    const result = q.retry(key);
    expect(q.getSnapshot()[0]?.state).toBe("printing");
    await q.retry(key); expect(send).toHaveBeenCalledOnce();
    finish(true); expect(await result).toBe(true);
    expect(q.getSnapshot()[0]?.state).toBe("printed");
    await q.retry(key); expect(send).toHaveBeenCalledOnce();
  });
  it("échec conservé après rechargement, relance manuelle une seule fois", async () => {
    const q = new KioskPrintQueue("r", localStorage, vi.fn().mockResolvedValue(false));
    const key = q.enqueue(input()); expect(await q.retry(key)).toBe(false);
    const send = vi.fn().mockResolvedValue(true);
    const reload = new KioskPrintQueue("r", localStorage, send);
    await reload.drain(); expect(send).not.toHaveBeenCalled();
    await Promise.all([reload.retry(key), reload.retry(key)]);
    expect(send).toHaveBeenCalledOnce(); expect(reload.getSnapshot()[0]?.state).toBe("printed");
  });
  it("reprend les tâches en attente mais jamais un envoi interrompu automatiquement", async () => {
    const q = new KioskPrintQueue("r", localStorage, () => new Promise(() => {}));
    q.enqueue(input()); void q.drain();
    const send = vi.fn().mockResolvedValue(true);
    const reload = new KioskPrintQueue("r", localStorage, send);
    expect(reload.getSnapshot()[0]?.state).toBe("failed");
    await reload.drain(); expect(send).not.toHaveBeenCalled();
    reload.enqueue(input("order-2")); await reload.drain();
    expect(send).toHaveBeenCalledOnce();
  });
  it("sérialise les tickets locaux et distingue borne et restaurant", async () => {
    let active = 0, max = 0;
    const send = vi.fn(async () => { active++; max = Math.max(max, active); await Promise.resolve(); active--; return true; });
    const q = new KioskPrintQueue("r", localStorage, send);
    const a = q.enqueue(input()), b = q.enqueue(input("order-1", "2"));
    await Promise.all([q.retry(a), q.retry(b)]);
    expect(send).toHaveBeenCalledTimes(2); expect(max).toBe(1);
    expect(new KioskPrintQueue("other", localStorage, send).getSnapshot()).toHaveLength(0);
  });
  it("refuse l’envoi si la tâche ne peut pas être conservée et ne stocke pas de jeton", () => {
    const send = vi.fn();
    const q = new KioskPrintQueue("r", { getItem: () => null, setItem: () => { throw new Error("quota"); } }, send);
    expect(() => q.enqueue(input())).toThrow("quota"); expect(send).not.toHaveBeenCalled();
    const safe = new KioskPrintQueue("safe", localStorage, send);
    safe.enqueue({ ...input(), order: { ...input().order, access: "secret-capability" } as ReturnType<typeof input>["order"] });
    expect(localStorage.getItem(kioskQueueKey("safe"))).not.toContain("secret-capability");
  });
  it("affiche les états, le compteur et relance uniquement les tâches disponibles", () => {
    const q = new KioskPrintQueue("r", localStorage);
    q.enqueue(input()); const job = q.getSnapshot()[0]; if (!job) throw new Error("missing job");
    const jobs = [job, { ...job, key: "2", state: "printing" as const }, { ...job, key: "3", state: "printed" as const }, { ...job, key: "4", state: "failed" as const }];
    const retry = vi.fn(); render(<KioskPrintQueuePanel jobs={jobs} onRetry={retry} />);
    expect(screen.getByText("3 en attente")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Tickets/ })).toBeNull();
    expect(screen.getAllByRole("status").map((n) => n.textContent)).toEqual(["Échec", "Imprimé", "Impression…", "En attente"]);
    expect(screen.getAllByRole("button", { name: "Réessayer" })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Réessayer" })[0] as HTMLElement);
    expect(retry).toHaveBeenCalledWith("4");
  });
});
describe("identité ticket et confirmation directe", () => {
  it("contexte réservé au ticket client kiosque, autres tickets inchangés", () => {
    const o = input().order, context = input().kiosk;
    expect(kioskTicketLines(o, "receipt", context)).toEqual(["BORNE 1", "Entrée"]);
    expect(kioskTicketLines(o, "kitchen", context)).toEqual([]);
    expect(kioskTicketLines(sampleOrder(), "receipt", context)).toEqual([]);
    expect(ticketEscpos(o, "kitchen", 58, input().shop, undefined, context)).toEqual(ticketEscpos(o, "kitchen", 58, input().shop));
  });
  it.each([58, 80] as const)("identité lisible sur %i mm, retours à la ligne et HTML échappé", (width) => {
    const context = { id: "123", label: "ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ" };
    const bytes = ticketEscpos(input().order, "receipt", width, input().shop, undefined, context);
    const text = String.fromCharCode(...bytes);
    expect(text).toContain("BORNE 123");
    const label = text.slice(text.indexOf("BORNE 123") + 10).split("\x1d!")[0] ?? "";
    expect(label.split("\n").every((l) => l.length <= (width === 58 ? 32 : 48))).toBe(true);
    expect(ticketHtml(input().order, "receipt", width, input().shop, undefined, { id: "1", label: "<Entrée>" })).toContain("&lt;Entrée&gt;");
  });
  it("sans imprimante pas de fenêtre navigateur, sans confirmation pas de succès", async () => {
    vi.mocked(getPrinter).mockReturnValue(null);
    expect(await printKioskReceipt(input().order, input().shop, false, input().kiosk)).toBe(false);
    expect(sendToPrinter).not.toHaveBeenCalled();
    vi.mocked(getPrinter).mockReturnValue({ type: "network", name: "Borne", width: 58 });
    vi.mocked(sendToPrinter).mockRejectedValue(new Error("offline"));
    expect(await printKioskReceipt(input().order, input().shop, false, input().kiosk)).toBe(false);
    vi.mocked(sendToPrinter).mockResolvedValue(undefined);
    expect(await printKioskReceipt(input().order, input().shop, true, input().kiosk)).toBe(true);
    expect(sendToPrinter).toHaveBeenLastCalledWith(expect.anything(), expect.any(Uint8Array), true);
  });
});