import { createFileRoute } from "@tanstack/react-router";

// Retour Mollie Connect : le state signé (HMAC, 15 min) porte le restaurant et l'utilisateur agence.
export const Route = createFileRoute("/api/public/mollie-oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const { verifyMollieState, exchangeMollieCode, saveMollieOauth, mollieRedirectUri } = await import("@/lib/payments.functions");
        const st = await verifyMollieState(url.searchParams.get("state") ?? "");
        if (!st) return new Response("Lien de connexion Mollie invalide ou expiré.", { status: 400 });
        const back = async (q: string) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin.from("restaurants").select("slug").eq("id", st.r).maybeSingle();
          return Response.redirect(`${st.o}/admin/${data?.slug ?? ""}?mollie=${q}`, 302);
        };
        const code = url.searchParams.get("code");
        if (!code) return back("refuse");
        try {
          const t = await exchangeMollieCode(code, mollieRedirectUri(st.o));
          await saveMollieOauth(st.r, t);
          return back("connecte");
        } catch (e) {
          console.error("mollie-oauth-callback", e);
          return back("erreur");
        }
      },
    },
  },
});
