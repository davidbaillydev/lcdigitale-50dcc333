import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAgency(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("Réservé aux administrateurs de l'agence");
}

export const listAgencyAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAgency(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("user_roles").select("user_id, created_at").eq("role", "admin").order("created_at");
    if (error) throw new Error("Impossible de charger les administrateurs");
    return Promise.all((data ?? []).map(async (row) => {
      const { data: account, error: accountError } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
      if (accountError || !account.user) throw new Error("Impossible de charger un compte administrateur");
      return { id: row.user_id, email: account.user.email ?? "", createdAt: row.created_at, activated: Boolean(account.user.last_sign_in_at), isSelf: row.user_id === context.userId };
    }));
  });

export const inviteAgencyAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ email: z.string().trim().toLowerCase().email().max(255) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAgency(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let userId: string | undefined;
    // Existing accounts are resolved before inviting; an invitation error never grants access.
    for (let page = 1; ; page += 1) {
      const { data: accounts, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw new Error("Impossible de vérifier le compte");
      userId = accounts.users.find((user) => user.email?.toLowerCase() === data.email)?.id;
      if (userId || accounts.users.length < 100) break;
    }
    let invited = false;
    if (!userId) {
      const { data: account, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo: "https://restaurant.lcdigitale.fr/reset-password" });
      if (error || !account.user) throw new Error("Invitation non envoyée. Réessayez dans quelques instants.");
      userId = account.user.id;
      invited = true;
    }
    const { data: existing, error: readError } = await supabaseAdmin.from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (readError) throw new Error("Impossible de vérifier les droits du compte");
    if (existing) return { invited: false, alreadyAdmin: true };
    const { error } = await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (error) throw new Error("Accès administrateur non ajouté. Réessayez avec la même adresse email.");
    return { invited, alreadyAdmin: false };
  });
/** Accès limités : comptes rattachés seulement à certains restaurants, avec un rôle (gérant ou cuisine). */
export const listLimitedAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAgency(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: rs }, { data: ms, error }] = await Promise.all([
      supabaseAdmin.from("restaurants").select("id, name").order("sort_order").order("name"),
      supabaseAdmin.from("restaurant_members").select("user_id, restaurant_id, role"),
    ]);
    if (error) throw new Error("Impossible de charger les accès");
    const ids = [...new Set((ms ?? []).map((m) => m.user_id))];
    const users = await Promise.all(ids.map((id) => supabaseAdmin.auth.admin.getUserById(id).then((r) => r.data.user)));
    return {
      restaurants: rs ?? [],
      accounts: ids.map((id, i) => ({ id, email: users[i]?.email ?? "", access: (ms ?? []).filter((m) => m.user_id === id).map((m) => ({ restaurantId: m.restaurant_id, role: m.role as "manager" | "kitchen" })) })),
    };
  });

export const grantLimitedAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    email: z.string().trim().toLowerCase().email().max(255),
    restaurantIds: z.array(z.string().uuid()).min(1).max(200),
    role: z.enum(["manager", "kitchen"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAgency(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let userId: string | undefined;
    for (let page = 1; ; page += 1) {
      const { data: accounts, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw new Error("Impossible de vérifier le compte");
      userId = accounts.users.find((u) => u.email?.toLowerCase() === data.email)?.id;
      if (userId || accounts.users.length < 100) break;
    }
    let invited = false;
    if (!userId) {
      const { data: account, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo: "https://restaurant.lcdigitale.fr/reset-password" });
      if (error || !account.user) throw new Error("Invitation non envoyée. Réessayez dans quelques instants.");
      userId = account.user.id; invited = true;
    }
    const rows = data.restaurantIds.map((restaurant_id) => ({ restaurant_id, user_id: userId!, role: data.role }));
    const { error } = await supabaseAdmin.from("restaurant_members").upsert(rows, { onConflict: "restaurant_id,user_id,role", ignoreDuplicates: true });
    if (error) throw new Error("Accès non ajouté");
    return { invited };
  });

export const revokeLimitedAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid(), restaurantId: z.string().uuid(), role: z.enum(["manager", "kitchen"]) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAgency(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("restaurant_members").delete().eq("user_id", data.userId).eq("restaurant_id", data.restaurantId).eq("role", data.role);
    if (error) throw new Error("Retrait impossible");
    return { ok: true };
  });
