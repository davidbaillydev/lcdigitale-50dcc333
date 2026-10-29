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
- Menu simulation uses the manager-guarded editor draft, a shared pure item configurator and memory-only order snapshots; never mount the live cart provider or call order/payment/analytics services there. Why: tests must not affect customer carts, kitchen or sales.
- Admin card tests use a separate authenticated agency-only endpoint sharing createOrder calculations, immutable orders.is_test audit and simulated paid state; retain kitchen/courier/tickets but exclude revenue, invoices, refunds, promo usage, emails and POS. Why: operational testing cannot impersonate a bank settlement or alter commercial records.

- HTML and ESC/POS tickets share ticket.ts presentation helpers; optional catalog/group context restores missing option labels by stable IDs only, with snapshot-name fallback. Preserve kitchen visibility, prices and non-fiscal warnings. Why: previews and physical tickets must agree without changing orders/payments.

- Hours/delivery/config use jsonb; public pages use `/$slug`. `getCatalog(restaurant)` resolves restaurants.menu over catalogs.ts/menu_key. Servers recompute totals, never trusting client prices.
- Item schedules use shared Paris-time checks: now for immediate orders, validated slots for planned orders; end is exclusive, overnight belongs to its start day. Why: all channels agree.
- Customer orders are inserted by a public server function with the admin client; staff read/update orders via RLS (`can_access_restaurant`) and Realtime filtered by restaurant_id.
- Agency admins use user_roles and agency-verified invitations only; restaurant roles use restaurant_members. Why: no public privilege grants.
- Site/kiosk/courier use BrandTheme; authenticated screens/dialogs use editorial tokens with restaurant logos. Why: recognizable restaurants, consistent administration.
- Menu imports stay staged until saved; a pure draft merge preserves existing records, deduplicates exact names and allocates collision-checked IDs. Google keys stay private; Lovable fallback only for invalid key, quota or outage, never refusals; warning saved. Why: protect menus, keys and AI use.
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
- Kitchen: column scrolling, collapsible nav, safe-area insets; touch dialogs separate fixed header/search/footer from scrolling content. Why: retain access to closing and navigation during service.
- Kitchen secondary controls and role-filtered section links live in the settings dialog; history uses restaurant-scoped browser RLS, bounded pagination, shared tickets and existing manager-checked refund controls, invalidating restaurant history after refund success. Why: keep service uncluttered without widening payment permissions or showing stale refunds.
- Settings share themed navigation with mounted hidden sections and scoped save actions. Why: changing themes retains drafts without implying a global save.
- Read subdirectory AGENTS.md before edits; they contain scoped rules.
- Agency WhatsApp onboarding shares a presentation-only dialog and pure URL/message helpers; load config and delivery, display saved base/zone tariffs separately from the live edited-text preview, use the agency-configurable public origin (agency_settings.public_domain, admin-only, default https://restaurant.lcdigitale.fr via normalizePublicOrigin) and ephemeral edits, never send or persist automatically. Why: both agency views agree without altering pricing or exposing PINs, and links survive a domain change.
- Menu structure templates are agency-published detached snapshots; managers map imported items explicitly, inline size/extra groups remain draft-only until saveMenu. Why: reuse formats across restaurants without live links, source assets or unintended option-table writes.
- The public directory reuses existing restaurant data and professional entry routes; presentation/search stay client-side and never infer opening status from an active listing. Why: redesigns must not invent availability or change access permissions.
- Restaurant modules live in restaurants.enabled_features (missing key = enabled), agency-written, re-checked by server functions. Why: subscription gating must not rely on hidden UI.
- Kiosk "Voie B" (config.kiosk.cardOnly, agency-only): server accepts only card_terminal with a configured terminal, inserts awaiting_payment and releases to kitchen/POS only after provider-confirmed payment; unpaid orders are cancelled. Why: BOI-TVA-DECLA-30-10-30 §37 ex.4 exemption requires no cash recorded.
- Kiosk QR payment (config.payments.qr, opt-in per restaurant): order stored as payment_method online + awaiting_payment, Mollie preferred else Stripe Checkout; kitchen release only via provider-verified markPaid. Why: no unpaid QR order reaches the kitchen.
- Address autocomplete uses the free official BAN API (api-adresse.data.gouv.fr), debounced client-side with pure helpers in address-autocomplete.ts; selection fills fields and validates the delivery zone immediately. Why: official French addresses at zero cost, no key, no server proxy.
- Kitchen offline mode: pure helpers in src/lib/kitchen-offline.ts (day snapshot + last-status-per-order outbox in localStorage, flushed on online/Realtime resubscribe; server-rejected changes dropped, network failures retried). Why: kitchen screen never empties during outages and status changes are not lost.
