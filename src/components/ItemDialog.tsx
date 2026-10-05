import { useEffect, useState } from "react";
import { Minus, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { euro, groupCost, unitPrice, validateSelections, type MenuItem, type OptionGroup, type Selections } from "@/lib/menu";
import { useCart } from "@/lib/cart";
import { itemImage } from "@/lib/menu-images";
import { AllergenInfo } from "@/components/Allergens";

export function ItemDialog({ item, onClose }: { item: MenuItem | null; onClose: () => void }) {
  const { add, catalog } = useCart();
  const [sel, setSel] = useState<Selections>({});
  const [qty, setQty] = useState(1);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setSel({});
    setQty(1);
    setStep(0);
  }, [item?.id]);

  if (!item) return null;
  const groups = item.options ?? [];
  const stepped = !!item.builder;
  const visible = stepped ? groups.slice(step, step + 1) : groups;
  const price = unitPrice(item, sel);
  const image = itemImage(item, catalog.categories);

  const toggle = (g: OptionGroup, id: string) => {
    setSel((prev) => {
      const cur = prev[g.id] ?? [];
      if (g.max === 1) return { ...prev, [g.id]: [id] };
      if (cur.includes(id)) return { ...prev, [g.id]: cur.filter((x) => x !== id) };
      if (cur.length >= g.max) return prev;
      return { ...prev, [g.id]: [...cur, id] };
    });
  };

  const stepOk = (g: OptionGroup) => (sel[g.id] ?? []).length >= g.min;
  const isLast = !stepped || step === groups.length - 1;

  const submit = () => {
    const err = validateSelections(item, sel);
    if (err) {
      toast.error(err);
      return;
    }
    add(item.id, sel, qty);
    toast.success(`${item.name} ajouté au panier`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">{item.name}</DialogTitle>
          {item.desc && <DialogDescription>{item.desc}</DialogDescription>}
          <div className="pt-2"><AllergenInfo ids={item.allergens} /></div>
        </DialogHeader>
        {image && <div><img src={image.src} alt={image.real ? item.name : `Illustration pour ${item.name}`} loading="lazy" width={1024} height={768} className="h-36 w-full rounded-md object-cover sm:h-48" />{!image.real && <p className="mt-1 text-right text-xs text-muted-foreground">Photo d’illustration</p>}</div>}

        {stepped && (
          <div className="flex gap-1">
            {groups.map((g, i) => (
              <div key={g.id} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
            ))}
          </div>
        )}

        {visible.map((g) => {
          const picked = sel[g.id] ?? [];
          const extra = groupCost(g, picked);
          return (
            <div key={g.id} className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-xl">{g.label}</h3>
                <span className="text-xs text-muted-foreground">
                  {g.min === g.max ? `${g.min} choix` : `${g.min ? `min ${g.min} · ` : ""}max ${g.max}`}
                  {g.included !== undefined && g.extraPrice ? ` · ${g.included} compris, +${euro(g.extraPrice)} le supplément` : ""}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {g.choices.map((c) => {
                  const on = picked.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(g, c.id)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                        on ? "border-primary bg-primary/15" : "border-border hover:border-primary/50",
                      )}
                    >
                      <span className="min-w-0">
                        {c.label}
                        {c.price ? <span className="block text-xs text-primary">+{euro(c.price)}</span> : null}
                      </span>
                      {on && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
              {extra > 0 && <p className="text-xs text-primary">Suppléments : +{euro(extra)}</p>}
            </div>
          );
        })}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="secondary" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Moins"><Minus /></Button>
            <span className="w-6 text-center font-semibold">{qty}</span>
            <Button size="icon" variant="secondary" onClick={() => setQty(qty + 1)} aria-label="Plus"><Plus /></Button>
          </div>
          <div className="flex gap-2">
            {stepped && step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Retour</Button>}
            {isLast ? (
              <Button onClick={submit} className="font-semibold">Ajouter · {euro(price * qty)}</Button>
            ) : (
              <Button disabled={!groups[step] || !stepOk(groups[step]!)} onClick={() => setStep(step + 1)}>Suivant · {euro(price)}</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
