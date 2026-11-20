import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public et idempotent : n'agit que sur une commande dont le délai de 5 minutes est réellement dépassé. */
export const checkOrderDeadline = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), access: z.string().max(1000).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { requireCustomerAccess } = await import("./customer-access.server");
    requireCustomerAccess("order", data.orderId, data.access);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { expireMissedOrders } = await import("./order-deadline.server");
    return { expired: (await expireMissedOrders(supabaseAdmin, data.orderId)) > 0 };
  });

/** Staff must be able to read the selected order through restaurant-scoped access. */
export const checkStaffOrderDeadline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase.from("orders").select("id").eq("id", data.orderId).maybeSingle();
    if (error || !order) throw new Error("Accès à cette commande refusé.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { expireMissedOrders } = await import("./order-deadline.server");
    return { expired: (await expireMissedOrders(supabaseAdmin, data.orderId)) > 0 };
  });
