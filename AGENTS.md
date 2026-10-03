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

- Restaurants live in the `restaurants` table (hours, delivery, config as jsonb); public pages are scoped under `/$slug`. Base menus stay in code per `menu_key` in `src/lib/catalogs.ts`; a restaurant's own edited menu lives in `restaurants.menu` (jsonb, same Category shape) and overrides the base via getCatalog(restaurant), shared by client and server; the server recomputes every order total, never trusting client prices.
- Customer orders are inserted by a public server function with the admin client; staff read/update orders via RLS (`can_access_restaurant`) and Realtime filtered by restaurant_id.
- Agency (global) role is `admin` in user_roles (first account via trigger); per-restaurant access (manager/kitchen) lives in `restaurant_members`.
- Food photography is mapped by menu category in a presentation-only module, so shared menu/order pricing data stays image-free and visuals are clearly illustrative.
- Restaurant branding (logo_url data-URL + brand jsonb colors) is applied via BrandTheme CSS-var overrides on site, kiosk and kitchen; agency console /agence writes restaurants through has_role-checked server functions. Why: one theme system, no per-restaurant CSS.
- Light/dark theme toggle (src/lib/theme.tsx, localStorage "theme", .dark class on <html>): light tokens in :root, dark tokens in .dark in src/styles.css; toggle shown in SiteHeader, kiosk and kitchen headers. Why: users choose per device; brand colors still override via BrandTheme.
