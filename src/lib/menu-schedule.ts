import { z } from "zod";

const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Heure attendue : HH:MM");
export const itemScheduleSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1, "Choisissez au moins un jour").max(7).optional(),
  start: time.optional(),
  end: time.optional(),
}).refine((s) => !s.start || !s.end || s.start !== s.end, "Les heures de début et de fin doivent être différentes");