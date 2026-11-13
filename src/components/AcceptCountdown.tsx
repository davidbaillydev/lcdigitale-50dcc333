import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

export function remainingMs(deadline: string, now = Date.now()) { return Math.max(0, new Date(deadline).getTime() - now); }
export function formatCountdown(ms: number) { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }

/** Compte à rebours d'acceptation (4 min) ; appelle onExpire une seule fois à zéro. */
export function AcceptCountdown({ deadline, onExpire, label, className }: { deadline: string; onExpire?: () => void; label: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = remainingMs(deadline, now);
  useEffect(() => { if (ms === 0 && !fired.current) { fired.current = true; onExpire?.(); } }, [ms, onExpire]);
  const urgent = ms < 60_000;
  return (
    <div role="timer" aria-live="off" className={cn("flex items-center gap-2 rounded-md border px-3 py-2 font-semibold", urgent ? "border-destructive bg-destructive/15 text-destructive" : "border-primary bg-primary/10 text-foreground", className)}>
      <Timer aria-hidden="true" className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1 text-sm">{label}</span>
      <span className="text-xl tabular-nums">{formatCountdown(ms)}</span>
    </div>
  );
}
