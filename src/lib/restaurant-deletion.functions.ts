import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exactRestaurantConfirmation } from "./restaurant-deletion";

export const deleteAgencyRestaurant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), confirmation: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || admin !== true) throw new Error("Réservé à un administrateur agence");
    const { data: restaurant, error: readError } = await context.supabase.from("restaurants").select("name").eq("id", data.id).single();
    if (readError || !restaurant) throw new Error("Restaurant introuvable");
    if (!exactRestaurantConfirmation(restaurant.name, data.confirmation)) throw new Error("Saisissez le nom exact du restaurant");
    const { data: result, error } = await context.supabase.rpc("delete_agency_restaurant", { _id: data.id, _confirmation: data.confirmation });
    if (error) throw new Error(error.message);
    return result;
  });