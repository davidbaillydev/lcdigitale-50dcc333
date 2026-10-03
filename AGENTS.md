<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Restaurants live in the `restaurants` table (hours, delivery, config as jsonb); public pages are scoped under `/$slug`. Menus stay in code, registered per `menu_key` in `src/lib/catalogs.ts`, shared by client and server; the server recomputes every order total, never trusting client prices.
- Customer orders are inserted by a public server function with the admin client; staff read/update orders via RLS (`can_access_restaurant`) and Realtime filtered by restaurant_id.
- Agency (global) role is `admin` in user_roles (first account via trigger); per-restaurant access (manager/kitchen) lives in `restaurant_members`.
