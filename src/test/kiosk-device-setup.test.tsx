import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const server = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/kitchen-pin.functions", () => ({ verifyKioskSwitchPin: server.verify }));
vi.mock("@/components/PrinterSetup", () => ({ PrinterSetup: () => null }));
import { KioskDeviceSetup } from "@/components/KioskDeviceSetup";
import { KioskSwitchDialog } from "@/components/KioskSwitchDialog";

const restaurants = [{ id: "restaurant-1", slug: "istanbul", name: "Istanbul", city: "L’Isle-Jourdain", logo: null, kiosks: [{ id: "2", label: "Entrée" }] }];
beforeEach(() => { server.verify.mockReset(); server.verify.mockResolvedValue({ ok: false, reason: "wrong" }); });
afterEach(cleanup);
async function selectDevice() {
  fireEvent.click(screen.getByRole("button", { name: /Istanbul/ }));
  fireEvent.click(screen.getByRole("button", { name: /Entrée/ }));
  fireEvent.click(screen.getByRole("button", { name: /Valider et démarrer/ }));
  fireEvent.change(screen.getByLabelText("Code PIN"), { target: { value: "1234" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Valider" })); });
}
describe("activation locale protégée par PIN", () => {
  it("ne lance pas la borne avant sélection et PIN accepté", async () => {
    const launch = vi.fn().mockResolvedValue(undefined);
    render(<KioskDeviceSetup restaurants={restaurants} onLaunch={launch} />);
    expect(screen.getByRole("button", { name: /Valider et démarrer/ })).toBeDisabled();
    await selectDevice();
    await waitFor(() => expect(server.verify).toHaveBeenCalledWith({ data: { restaurantId: "restaurant-1", pin: "1234" } }));
    expect(launch).not.toHaveBeenCalled();
  });
  it("lance exactement la borne sélectionnée après validation serveur", async () => {
    server.verify.mockResolvedValue({ ok: true });
    const launch = vi.fn().mockResolvedValue(undefined);
    render(<KioskDeviceSetup restaurants={restaurants} onLaunch={launch} />);
    await selectDevice();
    await waitFor(() => expect(launch).toHaveBeenCalledExactlyOnceWith({ slug: "istanbul", kioskId: "2" }));
  });
  it("ne lance rien si la vérification serveur échoue", async () => {
    server.verify.mockRejectedValue(new Error("offline"));
    const launch = vi.fn();
    render(<KioskDeviceSetup restaurants={restaurants} onLaunch={launch} />);
    await selectDevice();
    await waitFor(() => expect(server.verify).toHaveBeenCalledOnce());
    expect(launch).not.toHaveBeenCalled();
  });
  it("refuse le lancement quand aucun PIN n’est configuré", async () => {
    server.verify.mockResolvedValue({ ok: false, reason: "no_pin" });
    const launch = vi.fn();
    render(<KioskDeviceSetup restaurants={restaurants} onLaunch={launch} />);
    await selectDevice();
    expect(server.verify).toHaveBeenCalledOnce();
    expect(launch).not.toHaveBeenCalled();
  });
  it("exige le PIN et une confirmation avant de réinitialiser", async () => {
    const reset = vi.fn();
    server.verify.mockResolvedValue({ ok: true });
    render(<KioskSwitchDialog restaurantId="restaurant-1" config={{}} current="2" shop={{ name: "Istanbul" }} onPick={vi.fn()} onClose={vi.fn()} onReset={reset} />);
    expect(screen.queryByRole("button", { name: /Changer de restaurant/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Code PIN"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    fireEvent.click(await screen.findByRole("button", { name: /Changer de restaurant/ }));
    expect(reset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser" }));
    expect(reset).toHaveBeenCalledOnce();
  });
  it("bloque la réinitialisation pendant un paiement", async () => {
    server.verify.mockResolvedValue({ ok: true });
    const reset = vi.fn();
    render(<KioskSwitchDialog restaurantId="restaurant-1" config={{}} current="2" shop={{ name: "Istanbul" }} onPick={vi.fn()} onClose={vi.fn()} onReset={reset} resetDisabled />);
    fireEvent.change(screen.getByLabelText("Code PIN"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(await screen.findByRole("button", { name: /Changer de restaurant/ })).toBeDisabled();
    expect(reset).not.toHaveBeenCalled();
  });
});