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

- Restaurants store hours, delivery and config as jsonb; public pages use `/$slug`. Base menus live in `src/lib/catalogs.ts` by `menu_key`; `restaurants.menu` (same Category shape) overrides them through shared getCatalog(restaurant). Servers recompute every order total, never trusting client prices.
- Customer orders are inserted by a public server function with the admin client; staff read/update orders via RLS (`can_access_restaurant`) and Realtime filtered by restaurant_id.
- Agency (global) role is `admin` in user_roles (first account via trigger); per-restaurant access (manager/kitchen) lives in `restaurant_members`.
- Public site/kiosk use BrandTheme; all authenticated screens and portaled dialogs use scoped editorial administration tokens, with restaurant logos/swatches/previews only. Agency writes require has_role. Why: consistent admin identity, independent public branding.
- Authenticated menu imports stay staged in the editor until manager review/save; uploads are not persisted. Why: uncertain AI extraction must never silently replace live prices or another restaurant's menu.
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
- Web voice ordering (Vapi Web SDK) uses per-restaurant public key + assistant id stored on restaurants (publicly readable, never the private key); the SDK is dynamically imported client-side only. Why: avoid SSR import of browser-only code and secret leakage.
- Imprimante directe ESC/POS par appareil (Bluetooth BLE, USB, réseau via pont LC Print) : `src/lib/printer.ts` + `escpos.ts`; repli navigateur si aucune configurée. Why: le navigateur ne peut pas ouvrir de socket réseau.
- Directory tokens are scoped; entries stay database-driven. Why: preserve partner branding.
- Customer tables stack labelled records on mobile; card controls use constrained grids. Why: keep data/actions without page overflow.
