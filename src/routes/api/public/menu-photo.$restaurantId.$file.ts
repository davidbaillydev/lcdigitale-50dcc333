import { createFileRoute } from "@tanstack/react-router";

const ID = /^[0-9a-f-]{36}$/;
const FILE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** Photos des plats : lecture publique (elles figurent sur la carte), stockage privé. */
export const Route = createFileRoute("/api/public/menu-photo/$restaurantId/$file")({
  server: { handlers: { GET: async ({ params }) => {
    if (!ID.test(params.restaurantId) || !FILE.test(params.file)) return new Response("Not found", { status: 404 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.storage.from("menu-photos").download(`${params.restaurantId}/${params.file}`);
    if (!data) return new Response("Not found", { status: 404 });
    const ext = params.file.split(".").pop();
    return new Response(data, { headers: {
      "Content-Type": ext === "jpg" ? "image/jpeg" : `image/${ext}`,
      "Cache-Control": "public, max-age=31536000, immutable",
    } });
  } } },
});
