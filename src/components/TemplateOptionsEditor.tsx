import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { OptionGroup } from "@/lib/menu";

export function TemplateOptionsEditor({ options, onChange }: { options: OptionGroup[]; onChange: (options: OptionGroup[]) => void }) {
  const patch = (index: number, value: Partial<OptionGroup>) => onChange(options.map((g, i) => i === index ? { ...g, ...value } : g));
  return <details className="border-y border-border py-3"><summary className="cursor-pointer text-sm font-semibold">Configurer les choix de la structure · {options.length} groupe(s)</summary><div className="mt-3 space-y-4">{options.map((g, gi) => <div key={g.id} className="space-y-2 border-b border-border pb-3">
    <div className="flex gap-2"><Input aria-label="Nom du groupe de structure" value={g.label} onChange={(e) => patch(gi, { label: e.target.value })} /><Button size="icon" variant="ghost" aria-label={`Retirer ${g.label}`} onClick={() => onChange(options.filter((_, i) => i !== gi))}><Trash2 /></Button></div>
    {g.kind !== "size" && <div className="flex flex-wrap gap-3 text-xs"><label>Min<Input type="number" className="w-20" min={0} max={g.max} value={g.min} onChange={(e) => patch(gi, { min: Math.min(g.max, Math.max(0, Number(e.target.value))) })} /></label><label>Max<Input type="number" className="w-20" min={g.min} max={50} value={g.max} onChange={(e) => patch(gi, { max: Math.max(g.min, Math.min(50, Number(e.target.value))) })} /></label></div>}
    {g.choices.map((c, ci) => <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2"><Input aria-label={`Choix ${ci + 1} de ${g.label}`} value={c.label} onChange={(e) => patch(gi, { choices: g.choices.map((x, j) => j === ci ? { ...x, label: e.target.value } : x) })} /><Input aria-label={`Prix de ${c.label}`} type="number" min={0} max={1000} step="0.01" value={c.price ?? 0} onChange={(e) => patch(gi, { choices: g.choices.map((x, j) => j === ci ? { ...x, price: Math.min(1000, Math.max(0, Number(e.target.value))) } : x) })} /></div>)}
  </div>)}</div></details>;
}