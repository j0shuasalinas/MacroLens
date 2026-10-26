# Recover a paused MacroLens deployment

Frontend: https://macrolens-joshua.netlify.app
API: https://macrolens-api-ce7g.onrender.com
Supabase project: `fiqfhrjrhwlnewcjqbkv`

A live static website does not mean its authentication, database, or AI provider is ready.

1. Open the intended MacroLens project in the Supabase dashboard. If paused, choose
   **Resume project → Resume**, then wait for **Healthy**. Do not recreate the database,
   rerun migrations, or replace keys simply because it was paused. Existing data is retained.
2. Check `GET /health`: 200 means the FastAPI process is alive, including after a Render
   free-instance cold start. This endpoint deliberately does not call Supabase or Gemini.
3. Check `GET /ready`: 200 with auth/database true means Supabase's auth service and
   a zero-row, RLS-protected database request both succeeded. A 503 means a dependency
   is unavailable. This endpoint returns no user records and calls no paid AI API.
4. Sign in and try a photo. Gemini errors are separate from a paused database. For
   provider diagnostics, see [Gemini diagnostics](GEMINI_DIAGNOSTICS.md). The diagnostic
   command uses only a public sample, not private photos. Meal save still requires review.
5. After a backend commit is pushed, manually deploy its latest commit on Render.
   Netlify automatically builds GitHub main. Verify the actual deployed commit and
   rerun readiness and the upload/review/save flow before declaring recovery complete.

Supabase documents that low-activity Free projects may pause over a seven-day period;
Pro prevents inactivity pausing. [Supabase availability documentation](https://supabase.com/docs/guides/deployment/going-into-prod#availability).
Render's free compute can also sleep while idle. No paid upgrade is required to resume
this project, and no paid upgrade was performed during this recovery. These free tiers
cannot guarantee continuous availability. Do not use artificial keep-alive requests to
hide the hosting limitation. Keep readiness checks user-initiated rather than polling
Supabase from Render's frequent liveness checks.

## Recovery verification — 2026-10-25–26

The dashboard confirmed MacroLens was paused. Resumed that exact project and waited
for Healthy; auth returned 521 during restoration, then 200. Both deployed web and API
health returned 200. A real public-food-image request to the deployed API succeeded in
7.2 seconds with four validated foods and one USDA match. Using a disposable test
account, onboarding, meal save, daily/calendar totals and weight logging passed.
That account and records were removed. No existing user records were changed.

A separate real browser scan exposed a Gemini ReadTimeout with the former 15-second
transport deadline. Increased it to 30 seconds, while retaining the 45-second overall
budget, at most three 503 attempts, no 400 retries, and separate 429 guidance.
Authentication service outages now return 503 rather than falsely expiring a valid
session. `/ready` was verified live with both checks true. Backend tests: 46 passed,
one local-Supabase-only test skipped.

After deploying backend commit `9ef12ad`, the live Chrome UI successfully selected
a public JPEG through the normal Mac file picker, normalized it, analyzed it with
Gemini and opened review with food estimates and uncertainty notes. Edited a calorie
value and saved the synthetic meal; Home and Calendar both showed the edited total
of 1307 kcal and one saved meal. Signed out, deleted only the labeled disposable
browser account, and verified its profile/goals/meals/weights were removed. Existing
accounts and meals were untouched.

Client typecheck, lint and production web export passed. The Chrome extension's
automated file-attachment permission was unavailable, so the native Mac file picker
was used successfully without changing extension permissions. Native iOS/Android
photo uploads and the user's original image were not tested.
