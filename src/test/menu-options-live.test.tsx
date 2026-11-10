import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  remove: vi.fn(),
  realtime: [] as Array<() => void>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: () => {
      const ch = {
        on: (_event: string, _params: unknown, cb: () => void) => {
          mocks.realtime.push(cb);
          return ch;
        },
        subscribe: vi.fn(),
      };
      return ch;
    },
    removeChannel: mocks.remove,
  },
}));
vi.mock("@/lib/menu-options", () => ({
  EMPTY_OPTIONS: { variants: [], groups: [], items: [], links: [] },
  loadOptionData: mocks.load,
}));

import { useOptionData } from "@/lib/menu-options-live";

const EMPTY = { variants: [], groups: [], items: [], links: [] };

describe("Public options refresh without unrestricted Realtime reads", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.realtime.length = 0;
  });

  it("does not poll on a timer any more", async () => {
    vi.useFakeTimers();
    mocks.load.mockResolvedValue(EMPTY);
    const { unmount } = renderHook(() => useOptionData("restaurant"));
    await act(async () => {});
    expect(mocks.load).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    expect(mocks.load).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("refreshes on focus and on network back online", async () => {
    vi.useFakeTimers();
    mocks.load.mockResolvedValue(EMPTY);
    const { unmount } = renderHook(() => useOptionData("restaurant"));
    await act(async () => {});
    expect(mocks.load).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(mocks.load).toHaveBeenCalledTimes(2);

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(mocks.load).toHaveBeenCalledTimes(3);
    unmount();
  });

  it("refreshes on Realtime changes for the four option tables", async () => {
    vi.useFakeTimers();
    mocks.load.mockResolvedValue(EMPTY);
    const { unmount } = renderHook(() => useOptionData("restaurant"));
    await act(async () => {});
    expect(mocks.realtime).toHaveLength(4);

    await act(async () => {
      mocks.realtime[0]();
    });
    expect(mocks.load).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("stops refreshing once unmounted", async () => {
    vi.useFakeTimers();
    mocks.load.mockResolvedValue(EMPTY);
    const { unmount } = renderHook(() => useOptionData("restaurant"));
    await act(async () => {});
    unmount();

    await act(async () => {
      vi.advanceTimersByTime(120_000);
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
    });
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });
});
