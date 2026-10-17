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