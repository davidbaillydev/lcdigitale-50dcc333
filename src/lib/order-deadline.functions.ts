import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public et idempotent : n'agit que sur une commande dont le délai de 4 minutes est réellement dépassé. */
export const checkOrderDeadline = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { expireMissedOrders } = await import("./order-deadline.server");
    return { expired: (await expireMissedOrders(supabaseAdmin, data.orderId)) > 0 };
  });
