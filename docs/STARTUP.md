# Startup performance

Home and the onboarding completion check use the signed-in Supabase client directly.
The Python API no longer sits on the critical path for opening an existing account.
The profile fetched for onboarding is reused on Home; meals, goals and the seven-day
summary load in parallel. The existing calendar RPC handles complete monthly totals,
including weeks that cross a month boundary.

These are read-only queries with the user's session JWT and existing RLS policies.
The user ID filter is additional scoping, not a replacement for database enforcement.
No service-role or AI credentials are included. Writes, food analysis and coaching
continue through FastAPI. Onboarding errors remain errors; failed access cannot mark
onboarding complete. Each signed-in identity gets a separate memory-only query cache;
changing identity also clears the unsaved meal draft. Authenticated data is not added
to the service worker or browser HTTP cache.

Netlify caches fingerprinted Expo assets for one year with `immutable`. A changed
bundle has a new filename; the HTML entry and service worker remain revalidated.

## Verification — 2026-10-28

- Client startup tests cover authenticated scoping, signed-out rejection, safe failures,
  month/DST boundaries and separate account caches.
- Actual cloud checks used two temporary accounts with distinct synthetic meals.
  The shared startup helpers returned the expected profile, goals, meals and weekly
  totals in 214 ms and 150 ms respectively, including the cross-user rejection check.
  These are warm network helper timings, not device startup benchmarks.
- A production web export with an intentionally unreachable FastAPI URL signed in
  and displayed the correct 321 kcal meal and 2,200 kcal goal in Chrome. This checks
  that opening Home does not depend on waking the Python service.
- Native device startup and signed native builds were not measured.

Run local checks with `npm test`, `npm run typecheck`, `npm run lint`, and the
production web build from `apps/client`. The opt-in
`node --experimental-strip-types tests/live-startup-check.mjs <fixture-path>`
requires two disposable, onboarded accounts and the synthetic records specified in
that script. Never commit fixture credentials or run it with real users' records.

## Remaining host limits

[Render's free service](https://render.com/docs/free) sleeps after 15 minutes of
inactivity. Requests that still use FastAPI, such as the first scan or save, can
therefore wait for the service to wake. Removing this host delay requires an
always-running service; no paid plan or artificial keep-alive was configured.
Supabase must also be healthy and unpaused. A network outage still produces an
error rather than exposing cached data from another account or bypassing auth.

The [Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
explains why a browser/mobile client can query these tables with a user's JWT.
