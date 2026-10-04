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
- Restaurant branding (logo_url data-URL + brand jsonb colors) is applied via BrandTheme CSS-var overrides on site, kiosk and kitchen; agency console writes restaurants through has_role-checked server functions. Why: one theme system, no per-restaurant CSS.
- Menu imports are analyzed in an authenticated server function and staged only in the editor until a manager reviews and saves them; uploaded files are not persisted. Why: uncertain AI extraction must never silently replace a restaurant's live prices or another restaurant's menu.
- Private screens live under `src/routes/_authenticated/`: `/admin/*` (agency only, has_role gate in admin.tsx beforeLoad) and `/espace/*` (restaurateurs: per-restaurant pages check membership); every server function re-checks the role. Old /agence and /cuisine/* redirect. Why: UI gates are UX, server checks are the boundary.
- Restaurateur accounts are invite-only (public signup disabled; inviteMember adds restaurant_members, invite lands on /reset-password). Team lists expose only that restaurant's members. Why: no cross-restaurant email exposure or self-signup.
- Ordering rules (enabled modes, accepted payments, autoAccept, lead times, delivery zones/fees) live in restaurants.config/delivery, edited by RestaurantSettingsForm and enforced server-side in createOrder/createKioskOrder. Why: one source of truth for site, kiosk and kitchen.
- New restaurants default to the blank menu_key `vierge` (no base catalog) so the menu is built via AI import or by hand; templates remain selectable.
- Kitchen PIN lock: hashed PIN in `restaurant_kitchen_pins` (service-role only, no RLS policies), set by managers and verified by server functions with attempt lockout. Why: quick tablet unlock without exposing the hash to clients.
- Restaurant banners use private Storage with a path in restaurants.brand; manager-checked uploads and an active-restaurant-only image endpoint serve the site and kiosk, with a shared brand/logo fallback. Agency brand edits preserve the banner path to avoid accidental removal.
- Promotions (codes promo, offer first order, announcement) are stored server-side: codes in `restaurant_promo_codes` (service-role only), offer/banner in restaurants.config.marketing; discounts are recomputed in createOrder/createKioskOrder via promo.server.ts. Why: the browser preview is never trusted for the final total.
- Sales dashboard and customer file read through RLS with the browser client (orders via can_access_restaurant, restaurant_customers via is_restaurant_manager); exports (CSV/xlsx/jsPDF) are generated in the browser. Customers are deduplicated per restaurant on normalized email/phone (partial unique indexes), and marketing consent is stored with date + source. Why: no extra server surface, RGPD traceability.
- Marketing campaigns are sent server-side through the Brevo connector (agency sender, restaurant name + reply-to), only to consenting customers re-filtered on the server; unsubscribe links are HMAC-signed (CAMPAIGN_UNSUB_SECRET) and handled on /desabonnement. Why: consent is enforced at send time, not trusted from the browser.
- Agency-only actions (payment keys, banner, print settings, campaigns, team invites/roles, kitchen PIN) check has_role admin on the server; managers keep orders, menu, hours/delivery, reports, clients, promos. Why: owners delegate, costly or sensitive settings stay with the agency.
- Phone orders (Vapi voice assistant) arrive via /api/public/vapi/$restaurantId, authenticated by a per-restaurant x-vapi-secret stored in `restaurant_voice_channels` (service-role only, agency-managed); orders use source 'phone' and server-recomputed prices. Why: public webhook must never trust caller or prices.
