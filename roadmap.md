- [x] Add secure per-restaurant banner upload and removal in restaurant settings.
- [x] Show the banner on the customer site and kiosk, with brand/logo fallback.
- [x] Verify upload, persistence, removal, fallback and current app errors.
- [x] Apply the selected editorial direction to the directory; verify themes, imagery and navigation.
- [x] Extend the selected editorial LC Digitale direction to all authenticated administration screens and dialogs; preserve permissions and verify light/dark views.
- [x] Adapt agency/manager cards, customer tables and sales summaries to small screens; verify authenticated layouts and unchanged actions.
- [x] Enlarge mobile console controls; verify authenticated touch targets, dialogs and layouts.

Verified on a temporary restaurant, now deactivated: upload and reload persistence, customer site and kiosk rendering, removal, mobile fallback without horizontal overflow, and no browser errors. Three banner component tests pass; automatic build passes. Storage is private and direct anon/authenticated access is denied. Five database advisor findings predate this change and remain outside its scope.