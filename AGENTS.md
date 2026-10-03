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
- Restaurant branding (logo_url data-URL + brand jsonb colors) is applied via BrandTheme CSS-var overrides on site, kiosk and kitchen; agency console writes restaurants through has_role-checked server functions. Why: one theme system, no per-restaurant CSS.
- Light/dark theme toggle (src/lib/theme.tsx, localStorage "theme", .dark class on <html>): light tokens in :root, dark tokens in .dark in src/styles.css; toggle shown in SiteHeader, kiosk and kitchen headers. Why: users choose per device; brand colors still override via BrandTheme.
- Menu imports are analyzed in an authenticated server function and staged only in the editor until a manager reviews and saves them; uploaded files are not persisted. Why: uncertain AI extraction must never silently replace a restaurant's live prices or another restaurant's menu.
- Private screens live under `src/routes/_authenticated/`: `/admin/*` (agency only, has_role gate in admin.tsx beforeLoad) and `/espace/*` (restaurateurs: per-restaurant pages check membership); every server function re-checks the role. Old /agence and /cuisine/* redirect. Why: UI gates are UX, server checks are the boundary.
- Restaurateur accounts are invite-only (public signup disabled; inviteMember adds restaurant_members, invite lands on /reset-password). Team lists expose only that restaurant's members. Why: no cross-restaurant email exposure or self-signup.
- Ordering rules (enabled modes, accepted payments, autoAccept, lead times, delivery zones/fees) live in restaurants.config/delivery, edited by RestaurantSettingsForm and enforced server-side in createOrder/createKioskOrder. Why: one source of truth for site, kiosk and kitchen.

- New restaurants default to the blank menu_key `vierge` (no base catalog) so the menu is built via AI import or by hand; templates remain selectable.
- Kitchen PIN lock: hashed PIN in `restaurant_kitchen_pins` (service-role only, no RLS policies), set by managers and verified by server functions with attempt lockout. Why: quick tablet unlock without exposing the hash to clients.
- Restaurant banners use private Storage with a path in restaurants.brand; manager-checked uploads and an active-restaurant-only image endpoint serve the site and kiosk, with a shared brand/logo fallback. Agency brand edits preserve the banner path to avoid accidental removal.
- Payment providers are configured per restaurant in `restaurant_payment_providers` (service-role only, no RLS policies); keys are written by manager-checked server functions and only returned masked. Kiosk card payments go through the restaurant's SumUp reader via public server functions keyed by the unguessable order id. Why: per-restaurant merchant accounts without exposing secrets to browsers.
