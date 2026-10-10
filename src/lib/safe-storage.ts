// Accès localStorage/sessionStorage tolérant : stockage bloqué (navigation privée,
// cookies tiers bloqués dans une iframe) → repli en mémoire pour la durée de la page.
type Kind = "local" | "session";
const mem: Record<Kind, Map<string, string>> = { local: new Map(), session: new Map() };

function store(kind: Kind): Storage | null {
  try { return kind === "local" ? window.localStorage : window.sessionStorage; } catch { return null; }
}
function make(kind: Kind) {
  return {
    get(k: string): string | null {
      try { const s = store(kind); if (s) return s.getItem(k); } catch { /* bloqué */ }
      return mem[kind].get(k) ?? null;
    },
    set(k: string, v: string): void {
      mem[kind].set(k, v);
      try { store(kind)?.setItem(k, v); } catch { /* bloqué ou plein */ }
    },
    remove(k: string): void {
      mem[kind].delete(k);
      try { store(kind)?.removeItem(k); } catch { /* bloqué */ }
    },
  };
}
export const safeLocal = make("local");
export const safeSession = make("session");
