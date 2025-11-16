## Change Summary

* Use Blink SDK with custom headless auth (no hosted redirects).

* Keep existing app auth UX fully custom; wire Blink to accept our JWTs.

* Implement DB/AI/Data/Storage/Notifications/Realtime/Analytics with robust error handling.

## Auth Strategy (Custom Headless)

* Configure client: `auth: { mode: 'headless' }` (no redirects).

* Do NOT use Blink’s hosted pages; keep our UI.

* Server routes read `Authorization: Bearer <jwt>` (from our auth) and call `blink.auth.setToken(jwt)` per request.

* Optional: set `NEXT_PUBLIC_BLINK_AUTH_URL` and `NEXT_PUBLIC_BLINK_CORE_URL` if using custom Blink domains.

## Setup

1. Dependency

* Add `@blinkdotnew/sdk@^0.18.0`.

1. Env

* Required: `NEXT_PUBLIC_BLINK_PROJECT_ID=yetr-content-creation-models-obbf3aln`.

* Auth mode: `NEXT_PUBLIC_BLINK_AUTH_MODE=headless`.

* Optional: `NEXT_PUBLIC_BLINK_AUTH_URL`, `NEXT_PUBLIC_BLINK_CORE_URL`.

* Recommended: `NEXT_PUBLIC_BLINK_ENABLE_ANALYTICS=true`, `BLINK_NOTIFICATIONS_FROM=welcome@yourdomain.com`.

1. Client initialization

* `frontend/src/lib/blink/client.ts`: `createClient({ projectId: process.env.NEXT_PUBLIC_BLINK_PROJECT_ID!, authRequired: false, auth: { mode: 'headless' } })`.

* Initialize analytics once on mount.

1. Provider integration

* `BlinkProvider` exposes client via context and enables analytics.

* Insert into `frontend/src/app/providers.tsx` around children (`frontend/src/app/providers.tsx:43`).

## Error Handling

* `frontend/src/lib/blink/errors.ts` normalizes SDK error classes (Auth/AI/Storage/Data/Realtime/Notifications) to `{ type, code, message }`.

* All modules and routes use this helper.

## Feature Modules (Client-Side)

1. Database (`frontend/src/lib/blink/db.ts`)

* `listTodos`, `createTodo`, `updateTodo`, `deleteTodo` via `blink.db.todos.*` (camelCase in code).

1. AI (`frontend/src/lib/blink/ai.ts`)

* `generateText`, `modifyImage`, `generateSpeech`.

1. Data (`frontend/src/lib/blink/data.ts`)

* `search`, `scrape`, `screenshot`, `extractFromUrl`, `secureFetch` with secret substitution.

1. Storage (`frontend/src/lib/blink/storage.ts`)

* `upload(file, path)`: extracts extension safely; returns `{ publicUrl }`.

1. Notifications (`frontend/src/lib/blink/notifications.ts`)

* `email({ to, from, subject, html, text })`; default `from` from env.

1. Realtime (`frontend/src/lib/blink/realtime.ts`)

* Channel helpers: subscribe/publish/unsubscribe, presence and message handlers.

1. Analytics (`frontend/src/lib/blink/analytics.ts`)

* `log`, `enable`, `disable`, `isEnabled`, `clearAttribution`.

## API Routes (Server-Side)

* All routes require `Authorization: Bearer <jwt>`; handlers call `blink.auth.setToken(jwt)`.

1. `api/blink/db/todos/route.ts`: GET/POST/PATCH/DELETE.
2. `api/blink/ai/text/route.ts`: POST `generateText` (supports `search`, `maxTokens`).
3. `api/blink/ai/image/route.ts`: POST `modifyImage` with multiple reference images.
4. `api/blink/data/search|scrape|screenshot|extract/route.ts` mapping to SDK.
5. `api/blink/storage/upload/route.ts`: POST multipart upload, returns `publicUrl`.
6. `api/blink/notifications/email/route.ts`: POST send email; server-side only.
7. Optional: `api/blink/realtime/*` if server-brokered messages are needed; otherwise client uses SDK directly.

* Errors pass through `handleBlinkError` and return consistent JSON.

## Client Hooks & UI Wiring

* Hooks under `frontend/src/hooks/blink/` using TanStack Query:

1. `useBlinkTodos()` – CRUD via API routes.
2. `useBlinkAI()` – `useGenerateText`, `useModifyImage`, `useGenerateSpeech`.
3. `useBlinkData()` – `useSearch`, `useScrape`, `useScreenshot`, `useExtractFromUrl`.
4. `useBlinkUpload()` – upload with progress.
5. `useBlinkEmail()` – send email and status.
6. `useBlinkRealtimeChannel(channelId)` – subscribe/publish/unsubscribe.
7. `useBlinkAnalytics()` – log CTA clicks.

* Minimal demo route: `src/app/(dashboard)/blink-demo/page.tsx` showcasing each feature with our custom UI.

## Insertion Points (Existing Files)

* Providers: `frontend/src/app/providers.tsx:43` – add `BlinkProvider`.

* Navbar/Footer analytics: `frontend/src/components/home/sections/navbar.tsx` and `frontend/src/components/home/sections/footer-section.tsx` – log `button_clicked` events.

* Server security: all new `api/blink/*` routes validate our auth and pass JWT to Blink.

## Env Variables & Details

* Required:

  * `NEXT_PUBLIC_BLINK_PROJECT_ID=yetr-content-creation-models-obbf3aln`.

  * `NEXT_PUBLIC_BLINK_AUTH_MODE=headless` (explicitly choose custom UI).

* Recommended:

  * `NEXT_PUBLIC_BLINK_ENABLE_ANALYTICS=true`.

  * `BLINK_NOTIFICATIONS_FROM=welcome@yourdomain.com`.

* Optional (only for custom Blink domains):

  * `NEXT_PUBLIC_BLINK_AUTH_URL=https://your-auth-service.com`.

  * `NEXT_PUBLIC_BLINK_CORE_URL=https://custom-core.example.com`.

* JWT handling:

  * Clients call our API with `Authorization: Bearer <jwt>` (from our custom auth).

  * Handlers set `blink.auth.setToken(jwt)` per docs (`pages/api` example applies to App Router too).

## Verification

* Add demo page and run through all operations.

* Ensure analytics auto-tracks pageviews and custom events.

* Validate errors using SDK classes and normalized responses.

* Confirm zero leakage of secrets; server-only secret substitution.

## Notes

* We preserve our custom auth UX and do not use Blink’s hosted pages.

* Blink acts as a capability layer; auth is enforced by our API routes and JWT forwarding.

