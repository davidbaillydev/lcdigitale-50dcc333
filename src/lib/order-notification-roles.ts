import { z } from "zod";

export const notificationRoleSchema = z.enum(["responsable", "livreur", "caissier"]);
export type NotificationRole = z.infer<typeof notificationRoleSchema>;
export const notificationRoleLabels: Record<NotificationRole, string> = {
  responsable: "Responsable", livreur: "Livreur", caissier: "Caissier",
};
export const notificationRolesSchema = z.array(notificationRoleSchema).max(3);
export const orderModeSchema = z.enum(["delivery", "pickup", "dine_in"]);
export type OrderMode = z.infer<typeof orderModeSchema>;
export const orderModeLabels: Record<OrderMode, string> = { delivery: "Livraison", pickup: "À emporter", dine_in: "Sur place" };
/** Modes par défaut selon les fonctions (livreur = livraison seule). */
export function defaultModes(roles: readonly string[]): OrderMode[] {
  if (roles.includes("responsable") || roles.includes("caissier")) return ["delivery", "pickup", "dine_in"];
  return roles.includes("livreur") ? ["delivery"] : [];
}
export const notificationSettingsSchema = z.object({
  received: z.boolean(), confirmed: z.boolean(), restaurant: z.boolean(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  team: z.boolean().default(true), agency: z.boolean().default(true),
});
export type OrderNotificationSettings = z.infer<typeof notificationSettingsSchema>;
export function roleReceivesOrder(roles: readonly string[], mode: string, modes?: readonly string[] | null): boolean {
  if (!roles.length) return false;
  return (modes ?? defaultModes(roles)).includes(mode);
}
export function notificationRecipients(input: {
  enabled: boolean; mode: string; fallback?: string | null; team: boolean; agency: boolean;
  members: { email?: string | null; roles: readonly string[]; modes?: readonly string[] | null }[]; agencyEmails: (string | null | undefined)[];
}): string[] {
  if (!input.enabled) return [];
  const emails = [input.fallback,
    ...(input.team ? input.members.filter((m) => roleReceivesOrder(m.roles, input.mode, m.modes)).map((m) => m.email) : []),
    ...(input.agency ? input.agencyEmails : []),
  ];
  return [...new Set(emails.map((email) => email?.trim().toLowerCase()).filter((email): email is string => !!email && z.string().email().safeParse(email).success))];
}