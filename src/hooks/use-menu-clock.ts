import { useEffect, useState } from "react";

/** Stable SSR fallback, refreshed at minute boundaries while the menu stays open. */
export function useMenuClock() {
  const [now, setNow] = useState<Date | undefined>();
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}