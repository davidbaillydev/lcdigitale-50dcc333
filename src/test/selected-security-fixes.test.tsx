import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { KitchenAccessGate } from "@/components/KitchenAccessGate";
import { zoneTooltip } from "@/lib/map-tooltip";

const mocks = vi.hoisted(() => ({ check: vi.fn(), query: vi.fn(), stop: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/kitchen-pin.functions", () => ({ hasKitchenPin: mocks.check }));
vi.mock("@/components/KitchenLock", () => ({ KitchenLock: ({ onUnlock }: { onUnlock: () => void }) => <button onClick={onUnlock}>Verified PIN</button> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function Orders({ lock }: { lock: () => void }) {
  useEffect(() => { mocks.query(); return mocks.stop; }, []);
  return <button onClick={lock}>Lock orders</button>;
}
function mount() {
  return render(<KitchenAccessGate restaurantId="restaurant-1" name="Test">{(lock) => <Orders lock={lock} />}</KitchenAccessGate>);
}
describe("Kitchen PIN data gate", () => {
  it("does not mount orders while checking or locked, and unmounts on relock", async () => {
    mocks.check.mockResolvedValue({ enabled: true });
    mount();
    expect(mocks.query).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByText("Verified PIN"));
    await waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("Lock orders"));
    expect(screen.queryByText("Lock orders")).toBeNull();
    expect(mocks.stop).toHaveBeenCalledTimes(1);
  });
  it("fails closed if the PIN check fails", async () => {
    mocks.check.mockRejectedValue(new Error("Offline"));
    mount();
    await screen.findByRole("alert");
    expect(mocks.query).not.toHaveBeenCalled();
    const source = readFileSync("src/lib/kitchen-pin.functions.ts", "utf8");
    expect(source).toContain('if (error) throw new Error("Impossible de vérifier l\'accès cuisine")');
  });
  it("keeps PIN-free kitchens working", async () => {
    mocks.check.mockResolvedValue({ enabled: false });
    mount();
    await screen.findByText("Lock orders");
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it("requires PIN again on a fresh mount despite browser storage", async () => {
    sessionStorage.setItem("kitchen-lock-restaurant-1", "0");
    mocks.check.mockResolvedValue({ enabled: true });
    mount();
    await screen.findByText("Verified PIN");
    expect(mocks.query).not.toHaveBeenCalled();
    sessionStorage.clear();
  });
});
describe("Delivery-zone tooltip text", () => {
  it.each(['<img src=x onerror="alert(1)">', '<svg onload="alert(1)"></svg>', 'Centre & périphérie'])("renders %s as literal text", (name) => {
    const label = zoneTooltip(name);
    expect(label.textContent).toBe(name);
    expect(label.children.length).toBe(0);
  });
  it("uses text nodes for both circle and polygon/polyline tooltips", () => {
    const source = readFileSync("src/components/ZoneMap.tsx", "utf8");
    expect(source.match(/bindTooltip\(zoneTooltip\(z.name\)\)/g)).toHaveLength(2);
    expect(source).not.toContain("bindTooltip(z.name)");
  });
});
describe("Reservation guarantee protection", () => {
  it("protects the persisted fee and saved card from browser updates", () => {
    const sql = readFileSync("supabase/migrations/20261111105842_ad847be6-772c-47ae-bdec-817de70a7e0a.sql", "utf8");
    for (const field of ["no_show_fee", "stripe_customer", "payment_method"]) expect(sql).toContain(`new.${field} is distinct from old.${field}`);
    expect(sql).toContain("auth.role()");
    expect(sql).toContain("raise exception");
    expect(sql).toContain("before update on public.reservations");
    const fn = readFileSync("src/lib/reservations.functions.ts", "utf8");
    expect(fn).toContain('if (manager !== true) throw new Error("Réservé au gérant")');
  });
});