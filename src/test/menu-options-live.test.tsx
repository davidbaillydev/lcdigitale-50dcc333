import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn(), remove: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { channel: () => { const ch = { on: () => ch, subscribe: vi.fn() }; return ch; }, removeChannel: mocks.remove } }));
vi.mock("@/lib/menu-options", () => ({ EMPTY_OPTIONS: { variants: [], groups: [], items: [], links: [] }, loadOptionData: mocks.load }));
import { useOptionData } from "@/lib/menu-options-live";

describe("Public options refresh without unrestricted Realtime reads", () => {
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
  it("refreshes every 15 seconds and on focus without a Realtime event", async () => {
    vi.useFakeTimers();
    mocks.load.mockResolvedValue({ variants: [], groups: [], items: [], links: [] });
    const { unmount } = renderHook(() => useOptionData("restaurant"));
    await act(async () => {});
    expect(mocks.load).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(15000); });
    expect(mocks.load).toHaveBeenCalledTimes(2);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(mocks.load).toHaveBeenCalledTimes(3);
    unmount();
    vi.advanceTimersByTime(15000);
    expect(mocks.load).toHaveBeenCalledTimes(3);
  });
});