import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KitchenHistory } from "@/components/KitchenHistory";

const mocks = vi.hoisted(() => ({ query: vi.fn(), refund: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/kitchen-history", () => ({ queryKitchenHistory: mocks.query }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/refunds.functions", () => ({ refundOrder: mocks.refund, listCreditNotes: mocks.list, REFUND_REASONS: { out_of_stock: "Rupture de stock" } }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/components/TicketPreviewDialog", () => ({ TicketPreviewDialog: () => null }));
vi.mock("@/lib/invoice", () => ({ downloadInvoice: vi.fn() }));

const order = { id: "order-1", status: "done", created_at: "2026-10-29T12:00:00Z", order_number: 123, customer_name: "Test", mode: "pickup", slot: "2026-10-29T12:00:00Z", total: 20, payment_method: "online", payment_status: "paid", payment_ref: "pi_test", refund_status: "none", refunded_amount: 0, items: [{ name: "Plat", qty: 1, total: 20 }] };
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><KitchenHistory restaurantId="restaurant-test" open onClose={vi.fn()} shop={{ name: "Restaurant test" }} width={80} fields={{}} onPrint={vi.fn()} /></QueryClientProvider>);
  return client;
}

describe("Historical refunds", () => {
  it("refreshes the historical amount and status after a successful online refund", async () => {
    mocks.query.mockResolvedValueOnce({ data: [order], count: 1 }).mockResolvedValue({ data: [{ ...order, payment_status: "partially_refunded", refund_status: "partial", refunded_amount: 5 }], count: 1 });
    mocks.refund.mockResolvedValue({ amount: 5, creditNote: "AV-2026-00001" });
    const client = mount();
    fireEvent.click(await screen.findByRole("button", { name: /^Rembourser$/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Montant libre" }));
    fireEvent.change(screen.getByLabelText("Montant (€)"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Rembourser 5/ }));
    await waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Remboursé partiel/)).toHaveTextContent("5,00");
    expect(mocks.refund).toHaveBeenCalledWith({ data: expect.objectContaining({ orderId: "order-1", amount: 5 }) });
    expect(client.getQueryData(["kitchen-history", "restaurant-test", { search: "", date: "" }, 0])).toEqual(expect.objectContaining({ orders: [expect.objectContaining({ refunded_amount: 5, payment_status: "partially_refunded" })] }));
  });

  it("does not offer refunds for unpaid historical orders", async () => {
    mocks.query.mockResolvedValue({ data: [{ ...order, payment_status: "unpaid" }], count: 1 });
    mount();
    await screen.findByText("N° 123 · Test");
    expect(screen.queryByRole("button", { name: /^Rembourser$/ })).toBeNull();
    expect(mocks.refund).not.toHaveBeenCalled();
  });
});