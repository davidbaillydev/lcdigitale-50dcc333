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
- Site/kiosk/courier use BrandTheme; authenticated screens/dialogs use editorial tokens with restaurant logos. Agency writes require has_role. Why: recognizable restaurants, consistent administration.
- Authenticated menu imports stay staged in the editor until manager review/save; uploads are not persisted. Why: uncertain AI extraction must never silently replace live prices or another restaurant's menu.
- Private screens live under `src/routes/_authenticated/`: `/admin/*` (agency only, has_role gate in admin.tsx beforeLoad) and `/espace/*` (restaurateurs: per-restaurant pages check membership); every server function re-checks the role. Why: UI gates are UX, server checks are the boundary.
- Restaurateur accounts are invite-only (public signup disabled; inviteMember adds restaurant_members, invite lands on /reset-password). Team lists expose only that restaurant's members. Why: no cross-restaurant email exposure or self-signup.
- Ordering rules (enabled modes, accepted payments, autoAccept, lead times, delivery zones/fees) live in restaurants.config/delivery, edited by RestaurantSettingsForm and enforced server-side in createOrder/createKioskOrder. Why: one source of truth for site, kiosk and kitchen.
- Banners: private Storage path in restaurants.brand, served by an active-only endpoint; brand edits preserve the path. Why: no accidental removal.
- Promotions (codes promo, offer first order, announcement) are stored server-side: codes in `restaurant_promo_codes` (service-role only), offer/banner in restaurants.config.marketing; discounts are recomputed in createOrder/createKioskOrder via promo.server.ts. Why: the browser preview is never trusted for the final total.
- Sales/customers read via browser RLS, exports built client-side; customers dedupe on normalized email/phone with dated consent. Why: RGPD traceability.
- Marketing campaigns are sent server-side through the Brevo connector (agency sender, restaurant name + reply-to), only to consenting customers re-filtered on the server; unsubscribe links are HMAC-signed (CAMPAIGN_UNSUB_SECRET) and handled on /desabonnement. Why: consent is enforced at send time, not trusted from the browser.
- Agency-only actions (payment keys, banner, print settings, campaigns, team invites/roles, kitchen PIN) check has_role admin on the server; managers keep orders, menu, hours/delivery, reports, clients, promos. Why: owners delegate, costly or sensitive settings stay with the agency.
- Phone orders (Vapi voice assistant) arrive via /api/public/vapi/$restaurantId, authenticated by a per-restaurant x-vapi-secret stored in `restaurant_voice_channels` (service-role only, agency-managed); orders use source 'phone' and server-recomputed prices. Why: public webhook must never trust caller or prices.
- Web voice (Vapi SDK): public key + assistant id on restaurants, SDK imported client-side only. Why: no SSR import, no secret leak.
- Legal pages come from src/lib/legal.ts templates + restaurants.legal (agency writes); orders store CGV acceptance server-side. Why: compliant by default, traceable.
- Web Push: payload-less VAPID pushes (no encryption lib); public/push-sw.js fetches the last message from /api/public/push/message; push_subscriptions is service-role only. Why: free, Worker-compatible, no third-party push service.
- Reservations: public fns insert via admin + Stripe SetupIntent (restaurant keys, no charge); staff use RLS + Realtime; no-show is an off-session PaymentIntent. Why: guarantee without fees.
- Public restaurant data: TanStack Query cache 15 min; live data uses Realtime. Why: fewer reads, fresh service data.
- Kitchen and courier PINs: hashed in service-role-only tables (`restaurant_kitchen_pins`, `restaurant_courier_pins`) with attempt lockout; courier sessions are HMAC tokens keyed on the PIN hash. Why: no extra accounts, PIN change revokes sessions.
- Delivery geo zones (circle/polygon) live in restaurants.delivery.geoZones; createOrder recomputes eligibility/fees via src/lib/geo.ts. Why: browser prices never trusted.
- E2E in e2e/ gates writes/staff via E2E_ALLOW_WRITES/E2E_STAFF_STATE; skip disabled modes. Store sessions only outside the repo. Why: no production writes or credential leaks by default.
- invoice-platform defines B2B readiness/contracts; transmission stays disabled pending provider, buyer identity and normative validation. Why: PDFs are not fiscal network compliance.
