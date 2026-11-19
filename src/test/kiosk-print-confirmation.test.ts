import { afterEach, describe, expect, it, vi } from "vitest";
import { sendToPrinter } from "@/lib/printer";

afterEach(() => vi.unstubAllGlobals());
describe("transport borne confirmé", () => {
  it("RawBT sans réponse refuse la tâche sans ouvrir une application ou un dialogue", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    await expect(sendToPrinter({ type: "rawbt", name: "Borne" }, new Uint8Array([10]), true)).rejects.toThrow("envoi non confirmé");
    expect(click).not.toHaveBeenCalled(); click.mockRestore();
  });
  it("RawBT confirme seulement une réponse réussie du serveur local", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));
    await expect(sendToPrinter({ type: "rawbt", name: "Borne" }, new Uint8Array([10]), true)).resolves.toBeUndefined();
  });
});