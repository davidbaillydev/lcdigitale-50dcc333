import { describe, expect, it } from "vitest";
import { isNewOrderAlert } from "@/lib/order-alert";
describe("platform order alerts", () => {
  it("signals a new customer order", () => expect(isNewOrderAlert("INSERT", { id: "1", status: "new" })).toBe(true));
  it("signals a paid release from awaiting payment", () => expect(isNewOrderAlert("UPDATE", { id: "1", status: "accepted", payment_status: "paid" }, "awaiting_payment")).toBe(true));
  it("does not signal unpaid orders", () => expect(isNewOrderAlert("INSERT", { id: "1", status: "awaiting_payment" })).toBe(false));
  it("does not signal counter sales", () => expect(isNewOrderAlert("INSERT", { id: "1", status: "new", source: "pos" })).toBe(false));
  it("does not notify externally for test orders", () => expect(isNewOrderAlert("INSERT", { id: "1", status: "new", is_test: true })).toBe(false));
  it("does not repeat on normal acceptance", () => expect(isNewOrderAlert("UPDATE", { id: "1", status: "accepted" }, "new")).toBe(false));
});