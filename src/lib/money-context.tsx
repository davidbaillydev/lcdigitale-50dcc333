import { createContext, useContext, type ReactNode } from "react";
import { formatMoney, type Currency } from "./money";

const MoneyContext = createContext<Currency>("EUR");
export function MoneyProvider({ currency, children }: { currency: Currency; children: ReactNode }) {
  return <MoneyContext.Provider value={currency}>{children}</MoneyContext.Provider>;
}
export function useMoney() {
  const currency = useContext(MoneyContext);
  return (amount: number) => formatMoney(amount, currency);
}