import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Recipient and current manager access are both enforced by the database. */
export const consumeAvailabilityNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("consume_availability_notifications");
    if (error) throw new Error("Notifications de reprise indisponibles");
    return data ?? [];
  });