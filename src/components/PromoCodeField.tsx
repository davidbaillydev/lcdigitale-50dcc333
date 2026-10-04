import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Tag, X } from "lucide-react";
import { checkDiscount } from "@/lib/marketing.functions";
import { normalizeCode } from "@/lib/promo";
import { cn } from "@/lib/utils";

export type AppliedDiscount = { discount: number; code: string | null; label: string };

/** Saisie du code promo + détection automatique de l'offre de premier achat (aperçu, recalculé à la commande). */
export function PromoCodeField({ slug, subtotal, channel, email, phone, onChange, large }: {
  slug: string; subtotal: number; channel: "web" | "kiosk"; email?: string; phone?: string;
  onChange: (d: AppliedDiscount | null, code: string | undefined) => void; large?: boolean;
}) {
  const check = useServerFn(checkDiscount);
  const [input, setInput] = useState("");
  const [code, setCode] = useState<string | undefined>();
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<AppliedDiscount | null>(null);

  useEffect(() => {
    if (!subtotal) { setRes(null); onChange(null, undefined); return; }
    const t = setTimeout(() => {
      check({ data: { slug, subtotal, channel, code, email: email || undefined, phone: phone || undefined } })
        .then((r) => {
          if (r.error) { setErr(r.error); setCode(undefined); return; }
          const d = r.discount > 0 ? r : null;
          setRes(d); onChange(d, d && code ? code : undefined);
        }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [slug, subtotal, channel, code, email, phone, check]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = () => { const c = normalizeCode(input); setErr(null); if (c) setCode(c); };
  const remove = () => { setCode(undefined); setInput(""); setErr(null); };

  return (
    <div className="space-y-2">
      {code ? (
        <div className={cn("flex items-center justify-between rounded-lg border border-primary bg-primary/10 px-3", large ? "py-4 text-2xl" : "py-2 text-sm")}>
          <span className="flex items-center gap-2 font-semibold"><Tag className={large ? "h-7 w-7" : "h-4 w-4"} /> {code}</span>
          <button onClick={remove} aria-label="Retirer le code" className="text-muted-foreground"><X className={large ? "h-8 w-8" : "h-4 w-4"} /></button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input value={input} maxLength={30} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && apply()}
            placeholder="Code promo" aria-label="Code promo"
            className={cn("min-w-0 flex-1 rounded-md border border-input bg-background px-3 uppercase", large ? "h-16 text-2xl" : "h-9 text-sm")} />
          <button onClick={apply} disabled={!input.trim()} className={cn("rounded-md bg-secondary font-semibold text-secondary-foreground disabled:opacity-50", large ? "px-8 text-2xl" : "px-4 text-sm")}>Appliquer</button>
        </div>
      )}
      {err && <p className={cn("text-destructive", large ? "text-xl" : "text-xs")}>{err}</p>}
      {res && !code && <p className={cn("text-primary", large ? "text-xl" : "text-xs")}>{res.label} appliquée automatiquement</p>}
    </div>
  );
}
