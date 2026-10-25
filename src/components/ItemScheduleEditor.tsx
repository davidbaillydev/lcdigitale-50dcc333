import { Clock } from "lucide-react";
import type { MenuItem } from "@/lib/menu";
import { itemScheduleLabel } from "@/lib/shop";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export function ItemScheduleEditor({ schedule, onChange }: { schedule: MenuItem["schedule"]; onChange: (s: MenuItem["schedule"]) => void }) {
  const all = [1, 2, 3, 4, 5, 6, 0];
  return <fieldset className="space-y-3 border-t border-border pt-3">
    <legend className="text-sm font-semibold">Disponibilité horaire / créneau</legend>
    <label className="flex items-center justify-between gap-3 text-sm">Limiter les jours ou horaires<Switch checked={!!schedule} onCheckedChange={(on) => onChange(on ? { days: all } : undefined)} /></label>
    {schedule && <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...schedule, days: all })}>Tous les jours</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange({ days: [1, 2, 3, 4, 5], start: "11:30", end: "14:00" })}>Lun–Ven (midi)</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...schedule, days: [6, 0] })}>Week-end</Button>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Jours de disponibilité">
        {all.map((day) => { const selected = (schedule.days ?? all).includes(day); return <Button key={day} size="sm" type="button" variant={selected ? "default" : "outline"} aria-pressed={selected} onClick={() => onChange({ ...schedule, days: selected ? (schedule.days ?? all).filter((d) => d !== day) : [...(schedule.days ?? all), day] })}>{["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][day]}</Button>; })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-sm">Début<Input type="time" aria-label="Heure de début du plat" value={schedule.start ?? ""} onChange={(e) => onChange({ ...schedule, start: e.target.value || undefined })} /></label>
        <label className="space-y-1 text-sm">Fin<Input type="time" aria-label="Heure de fin du plat" value={schedule.end ?? ""} onChange={(e) => onChange({ ...schedule, end: e.target.value || undefined })} /></label>
      </div>
      <p className="flex items-center gap-2 text-xs font-semibold text-primary"><Clock className="h-4 w-4 shrink-0" />{itemScheduleLabel(schedule)} · Paris</p>
      {schedule.days?.length === 0 && <p role="alert" className="text-sm text-destructive">Choisissez au moins un jour avant d’enregistrer.</p>}
      {schedule.start && schedule.start === schedule.end && <p role="alert" className="text-sm text-destructive">Choisissez des heures différentes.</p>}
    </>}
  </fieldset>;
}