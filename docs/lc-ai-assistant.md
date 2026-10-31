# LC AI — assistant restaurateur (MVP)

## Placement
The first interface is mounted in the authenticated restaurant menu workspace (`/espace/$slug/carte`). It is not mounted in the customer ordering journey or the kitchen KDS screen.

## Current behavior
- A floating assistant opens a responsive side panel.
- It offers guided first-line help for printer, kitchen order visibility, menu editing and reservations.
- Suggested questions and a short conversation are held in component memory only.
- No message is sent to an AI provider or persisted remotely.
- No order, payment, menu, reservation, stock, printer or restaurant setting is changed by the assistant.

## Planned server-side architecture
1. Authenticated TanStack Start server function with Zod-validated bounded input.
2. Resolve the active restaurant from its slug and confirm membership via existing `can_access_restaurant` / `is_restaurant_manager` rules. Never trust a client-supplied restaurant id as authorization.
3. Persist conversations and messages in restaurant-scoped tables with RLS and server-side role checks.
4. A skill registry routes read-only intents first: support FAQ, order lookup, printer/KDS diagnostics. Each skill has a schema, explicit authorization level, and audit trail.
5. The model must not run arbitrary SQL or choose privileged tools. Server code exposes a fixed allowlist of typed functions.
6. Mutations require a separate action proposal, a human confirmation and a second server-side permission check. Payments/refunds and fiscal operations stay outside the initial scope.
7. Human support tickets should be recorded in a first-party table before considering external Notion/GitHub integrations.

## Before enabling a live LLM
- Choose the provider and configure its API key as a server-only secret.
- Add rate limiting, request size limits, timeout handling and safe error messages.
- Define retention, deletion, RGPD notice and whether prompts may contain customer personal data.
- Add server integration tests proving cross-restaurant access is denied and unauthenticated calls are rejected.
- Run lint, unit tests, build and browser tests; inspect generated SQL and RLS in a staging project before applying migrations.

## Explicit next steps
- Implement database schema + RLS for conversations, messages and support tickets.
- Add server-only support and read-only order skills.
- Connect a chosen LLM provider via an environment secret.
- Add a staff ticket inbox in the agency console.
