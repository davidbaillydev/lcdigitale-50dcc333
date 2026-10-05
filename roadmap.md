- [x] Add secure per-restaurant banner upload and removal in restaurant settings.
- [x] Show the banner on the customer site and kiosk, with brand/logo fallback.
- [x] Verify upload, persistence, removal, fallback and current app errors.
- [x] Apply the selected editorial direction to the directory; verify themes, imagery and navigation.
- [x] Extend the selected editorial LC Digitale direction to all authenticated administration screens and dialogs; preserve permissions and verify light/dark views.
- [x] Adapt agency/manager cards, customer tables and sales summaries to small screens; verify authenticated layouts and unchanged actions.
- [x] Enlarge mobile console controls; verify authenticated touch targets, dialogs and layouts.
- [x] Adapt mobile console dialogs/menus with accessible sticky close, bounded scrolling and touch navigation; verify actual flows.
- [x] Apply the bold poster composition to the partner directory and kitchen KDS, preserving existing actions and permissions.
- [x] Verify both screens in light/dark at 320/390/1024/1280px: no overflow/runtime errors; ordering links, sound and menu navigation pass. Populated tickets and status actions checked with browser-only fixtures, without modifying real orders.
- [x] Reinforce LC Digitale Élite branding in the restaurant workspace; preserve rights and verify connected navigation in light/dark. Connected agency session: restaurant picker, kitchen, menu, settings and sales inspected; no overflow or runtime errors, automatic build OK. No permissions or order data changed.

Verified on a temporary restaurant, now deactivated: upload and reload persistence, customer site and kiosk rendering, removal, mobile fallback without horizontal overflow, and no browser errors. Three banner component tests pass; automatic build passes. Storage is private and direct anon/authenticated access is denied. Five database advisor findings predate this change and remain outside its scope.
- [x] Dish photos (import + AI), table QR codes, Google review invite

## 7 modules avancés (plan approuvé 2026-10-05)
- [x] Étape 1 : ruptures temps réel depuis la Cuisine + QR room service / libre-service / consultation
- [ ] Étape 2 : zones de livraison (CP/rayon), livreurs, statuts de livraison
- [ ] Étape 3 : menu FR/EN/ES/DE + réservations avec acompte Stripe
- [ ] Étape 4 : SMS/WhatsApp (attend compte Twilio) + application installable
