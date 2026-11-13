import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { orderTrackingInterval } from "@/lib/kitchen-status";

afterEach(() => vi.useRealTimers());

describe("Customer order tracking polling", () => {
  it.each(["done", "cancelled"])("disables the timer for %s orders", (status) => {
    expect(orderTrackingInterval(status)).toBe(false);
  });

  it("keeps payment checks every 3 seconds", () => {
    expect(orderTrackingInterval("awaiting_payment")).toBe(3_000);
  });

  it.each([undefined, "pending_approval", "accepted", "preparing", "ready", "delivering"])(
    "keeps active tracking every 15 seconds for %s", (status) => {
      expect(orderTrackingInterval(status)).toBe(15_000);
    },
  );

  it.each(["done", "cancelled"])("stops requests after an active order becomes %s", async (finalStatus) => {
    vi.useFakeTimers();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const fetchOrder = vi.fn().mockResolvedValueOnce({ status: "ready" }).mockResolvedValue({ status: finalStatus });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { unmount } = renderHook(() => useQuery({
      queryKey: ["order", "tracking-test"],
      queryFn: fetchOrder,
      refetchInterval: (query) => orderTrackingInterval(query.state.data?.status),
    }), { wrapper });

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetchOrder).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(fetchOrder).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(["order", "tracking-test"])).toEqual({ status: finalStatus });
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(fetchOrder).toHaveBeenCalledTimes(2);
    unmount();
    client.clear();
  });
});