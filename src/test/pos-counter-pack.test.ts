import { describe, it, expect, vi, beforeEach } from "vitest";
import { CASH_QUICK_AMOUNTS, changeDue, zReport, posClosuresCsv } from "@/lib/pos-register";
import { receiptOpensDrawer, printPosReceipt, posReportLines } from "@/lib/pos-print";
import { cashDrawerPulse } from "@/lib/escpos";
import { sampleOrder } from "@/lib/ticket";
import { getPrinter, sendToPrinter } from "@/lib/printer";

vi.mock("@/lib/printer", () => ({ getPrinter: vi.fn(), sendToPrinter: vi.fn() }));
const order = () => ({ ...sampleOrder(), source: "pos", payment_status: "paid", pos_receipt_number: 42, pos_tender: { method: "cash" as const, given: 50, change: 12.5 } });
const report = () => zReport([{ total: 12.5, status: "accepted", pos_tender: { method: "cash", given: 20, change: 7.5 } }, { total: 20, status: "ready", pos_tender: { method: "card" } }, { total: 8, status: "done", pos_tender: { method: "meal_voucher" } }], 50, 60);

describe("pack caisse", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(getPrinter).mockReturnValue({ type: "network", name: "Test", width: 80 }); vi.mocked(sendToPrinter).mockResolvedValue(undefined); });
  it("propose les quatre touches 5, 10, 20 et 50 euros", () => expect(CASH_QUICK_AMOUNTS).toEqual([5, 10, 20, 50]));
  it("compte juste ne rend pas de monnaie", () => expect(changeDue(12.5, 12.5)).toBe(0));
  it("calcule immédiatement 7,50 euros à rendre sur 20", () => expect(changeDue(12.5, 20)).toBe(7.5));
  it("n'ouvre le tiroir que pour des espèces encaissées", () => {
    expect(receiptOpensDrawer(order(), false)).toBe(true);
    expect(receiptOpensDrawer({ ...order(), payment_status: "awaiting_payment" }, false)).toBe(false);
    expect(receiptOpensDrawer({ ...order(), pos_tender: { method: "card" } }, false)).toBe(false);
  });
  it("la réimpression ne rouvre jamais le tiroir", () => expect(receiptOpensDrawer(order(), true)).toBe(false));
  it("envoie le ticket validé puis l'impulsion ESC/POS", async () => {
    expect(await printPosReceipt(order(), { name: "Test" })).toBe(true);
    const bytes = vi.mocked(sendToPrinter).mock.calls[0]?.[1];
    expect(Array.from(bytes?.slice(-5) ?? [])).toEqual(Array.from(cashDrawerPulse()));
  });
  it("réimprime le même numéro sans impulsion", async () => {
    await printPosReceipt(order(), { name: "Test" }, true);
    const bytes = vi.mocked(sendToPrinter).mock.calls[0]?.[1];
    expect(Array.from(bytes?.slice(-5) ?? [])).not.toEqual(Array.from(cashDrawerPulse()));
  });
  it("un échec d'impression est signalé sans réencaissement", async () => {
    vi.mocked(sendToPrinter).mockRejectedValue(new Error("offline"));
    expect(await printPosReceipt(order(), { name: "Test" })).toBe(false);
    expect(sendToPrinter).toHaveBeenCalledTimes(1);
  });
  it("le X ne compte aucune clôture ni écart définitif", () => {
    const r = zReport([{ total: 12.5, status: "accepted", pos_tender: { method: "cash" } }], 50, null);
    expect(r.expectedCash).toBe(62.5); expect(r.countedCash).toBeNull(); expect(r.cashDifference).toBeNull();
    expect(posReportLines({ name: "Test" }, { kind: "X", openedAt: "2026-11-07T06:00:00Z", at: "2026-11-07T07:00:00Z", report: r })).toContain("Caisse toujours ouverte");
  });
  it("ventile le Z et calcule l'écart espèces, sans utiliser le montant remis", () => {
    const r = report(); expect(r.total).toBe(40.5); expect(r.byMethod.cash.amount).toBe(12.5); expect(r.byMethod.card.amount).toBe(20); expect(r.byMethod.meal_voucher.amount).toBe(8); expect(r.expectedCash).toBe(62.5); expect(r.cashDifference).toBe(-2.5);
  });
  it("exporte toutes les clôtures et leur écart", () => {
    const csv = posClosuresCsv([1, 2].map((n) => ({ z_number: n, opened_at: "2026-11-07T06:00:00Z", closed_at: "2026-11-07T08:00:00Z", z_report: report() })));
    expect(csv.split("\r\n")).toHaveLength(3); expect(csv).toContain('"-2,50"'); expect(csv).toContain('"40,50"');
  });
});