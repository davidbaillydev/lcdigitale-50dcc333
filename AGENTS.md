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

- Hours/delivery/config use jsonb; public pages use `/$slug`. `getCatalog(restaurant)` resolves restaurants.menu over catalogs.ts/menu_key. Servers recompute totals, never trusting client prices.
- Customer orders are inserted by a public server function with the admin client; staff read/update orders via RLS (`can_access_restaurant`) and Realtime filtered by restaurant_id.
- Agency admins use user_roles and agency-verified invitations only; restaurant roles use restaurant_members. Why: no public privilege grants.
- Site/kiosk/courier use BrandTheme; authenticated screens/dialogs use editorial tokens with restaurant logos. Why: recognizable restaurants, consistent administration.
- Menu imports stay staged; uploads are not persisted. Agency-only Gemini key in a service-role-only singleton, presence returned only; use Gemini if set, else existing Lovable AI, no failure fallback. Why: protect keys and live menus.
- Private screens live under `src/routes/_authenticated/`: `/admin/*` (agency only, has_role gate in admin.tsx beforeLoad) and `/espace/*` (restaurateurs: per-restaurant pages check membership); every server function re-checks the role. Why: UI gates are UX, server checks are the boundary.
- Restaurateur accounts are invite-only (public signup disabled; inviteMember adds restaurant_members, invite lands on /reset-password). Team lists expose only that restaurant's members. Why: no cross-restaurant email exposure or self-signup.
- Ordering rules (enabled modes, accepted payments, autoAccept, lead times, delivery zones/fees) live in restaurants.config/delivery, edited by RestaurantSettingsForm and enforced server-side in createOrder/createKioskOrder. Why: one source of truth for site, kiosk and kitchen.
- Promotions (codes promo, offer first order, announcement) are stored server-side: codes in `restaurant_promo_codes` (service-role only), offer/banner in restaurants.config.marketing; discounts are recomputed in createOrder/createKioskOrder via promo.server.ts. Why: the browser preview is never trusted for the final total.
- Sales/customers read via browser RLS, exports built client-side; customers dedupe on normalized email/phone with dated consent. Why: RGPD traceability.
- Marketing campaigns are sent server-side through the Brevo connector (agency sender, restaurant name + reply-to), only to consenting customers re-filtered on the server; unsubscribe links are HMAC-signed (CAMPAIGN_UNSUB_SECRET) and handled on /desabonnement. Why: consent is enforced at send time, not trusted from the browser.
- Agency-only actions (payment keys, banner — private Storage path in brand, preserved on edits —, print settings, campaigns, team invites/roles, kitchen PIN) check has_role admin on the server; managers keep orders, menu, hours/delivery, reports, clients, promos. Why: owners delegate, costly or sensitive settings stay with the agency.
- Phone orders (Vapi voice assistant) arrive via /api/public/vapi/$restaurantId, authenticated by a per-restaurant x-vapi-secret stored in `restaurant_voice_channels` (service-role only, agency-managed); source 'phone', server prices; web voice SDK (public key + assistant id) is client-only. Why: never trust callers, no SSR import.
- Legal pages come from src/lib/legal.ts templates + restaurants.legal (agency writes); orders store CGV acceptance server-side. Why: compliant by default, traceable.
- Reservations: public fns insert via admin + Stripe SetupIntent (restaurant keys, no charge); staff use RLS + Realtime; no-show is an off-session PaymentIntent. Why: guarantee without fees.
- Public restaurant data: Query cache 15 min, Realtime for live data. Why: fewer reads, fresh data.
- Kitchen and courier PINs: hashed in service-role-only tables (`restaurant_kitchen_pins`, `restaurant_courier_pins`) with attempt lockout; courier sessions are HMAC tokens keyed on the PIN hash. Why: no extra accounts, PIN change revokes sessions.
- Invoice transmission stays disabled pending provider and compliance validation; PDFs alone are not fiscal compliance.
- Kitchen: column scrolling, collapsible nav, fullscreen dialogs, safe-area insets.
- Settings share themed navigation with mounted hidden sections and scoped save actions. Why: changing themes retains drafts without implying a global save.
- Read subdirectory AGENTS.md before edits; they contain scoped rules.
- Restaurant modules live in restaurants.enabled_features (missing key = enabled), agency-written, re-checked by server functions. Why: subscription gating must not rely on hidden UI.
- Kiosk "Voie B" (config.kiosk.cardOnly, agency-only): server accepts only card_terminal with a configured terminal, inserts awaiting_payment and releases to kitchen/POS only after provider-confirmed payment; unpaid orders are cancelled. Why: BOI-TVA-DECLA-30-10-30 §37 ex.4 exemption requires no cash recorded.
- Kiosk QR payment (config.payments.qr, opt-in per restaurant): order stored as payment_method online + awaiting_payment, Mollie preferred else Stripe Checkout; kitchen release only via provider-verified markPaid. Why: no unpaid QR order reaches the kitchen.
