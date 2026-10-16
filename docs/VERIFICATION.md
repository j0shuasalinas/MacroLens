# Verification record — October 15, 2026

Final backend run: **17 passed**, including the opt-in real Supabase test.

## Verified locally

- Python API tests cover authentication rejection, invalid token verification, owner-scoped
  CRUD requests, Pydantic output/input validation, finite/nonnegative nutrition values,
  nutrition sums, weight validation, weekly averages/trends, upload bytes/type limits,
  analysis throttling, invalid AI responses, mocked Gemini workflow, mocked USDA scaling,
  and sanitized upstream errors.
- A real local Supabase stack applied `001_initial.sql` successfully. Integration tests
  created two synthetic users and verified meal CRUD, daily totals, weight/profile/goal
  persistence, direct REST RLS enforcement, normalized-item isolation/synchronization,
  cross-user write rejection, private bucket metadata, account deletion and database cascades.
  Synthetic test users were removed. This does not verify a remote Supabase project.
- TypeScript and ESLint checks passed.
- Expo production web export passed with explicitly supplied placeholder HTTPS service URLs.
  The exported artifact is a build check, not a configured production release.
- iOS and Android JavaScript/Hermes exports passed. This is not native compilation.
- Expo native prebuild generated both platform projects; iOS camera/photo permission text,
  Android application identifier and placeholder branding configuration were inspected.
- Chrome rendered the app. With a disposable local Supabase account, browser login, manual
  meal editing, saving, dashboard totals (130 kcal, 3 g protein, 28 g carbs, 1 g fat), session
  persistence after reload, and sign-out were exercised. The account and records were removed.
- Desktop and 390×844 browser layouts were inspected; mobile navigation fits in one row.

## Still requires external verification

- Real Gemini image analysis and USDA queries require your provider API keys. Their SDK/HTTP
  integrations and error paths exist; automated AI/USDA tests use controlled responses.
- Cloud Supabase setup, email delivery/confirmation, deployed CORS, HTTPS and static-host rewrites.
- Xcode/CocoaPods native compilation, Apple signing, actual iPhone camera and library behavior,
  development-build installation, EAS APK compilation and Android installation.
- PWA install prompts and service-worker behavior on deployed HTTPS origins.
- TestFlight or any public deployment. None was performed.

## Known limitations

- `npm audit` reported 26 transitive affected packages (8 moderate / 18 high), propagated from
  advisories in braces, node-forge and uuid. The available Expo dependency tree still includes
  these; do not treat this as a clean security audit. No forced SDK downgrade or unverified
  major override was applied. Review upstream patches before wider production distribution.
- Expo's current packages report an optional worklets peer-version warning. Prebuild and JS
  exports pass; signed native compilation remains necessary to establish device compatibility.
- Tests emit dependency deprecation warnings from Starlette TestClient and Google SDK typing.
- Analysis rate limiting is process-local, so shared throttling is required before scaling out.
- USDA matching uses conservative token overlap, not a verified food identity. Preparation,
  portions and hidden ingredients must be reviewed by the user.
- Photos are not retained; private storage is reserved for future retention with cleanup policies.
- History is capped at 500 meals; weight reads at 1,000 entries. Add pagination for longer histories.
- PWA is network-only, with no offline data store or queued writes.
- Settings saves profile and goals as separate requests; a partial failure is reported and can
  be retried. Meal and normalized-item updates are transactional in PostgreSQL.

## Running workspace

Ignored `.env` files currently point to the isolated local Supabase stack on port 55421.
The development browser app uses port 8082 and API port 8010 because other local services
occupied the default ports. Provider keys are now configured only in the ignored backend env; no cloud Supabase credentials were supplied. Use README commands
with those ports to restart. Keep Gemini/USDA keys only in the API env file.

For repeatable commands and setup, see [README](../README.md) and [deployment guide](DEPLOYMENT.md).

## Follow-up: interface and provider connectivity

The interface was refreshed with light cards, calorie progress ring, colored macro cards,
photo-first navigation, clearer meal review, and simpler profile choices. TypeScript, lint
and the production web export passed. Desktop and 390×844 layouts, login and profile/goal
saving were checked against local Supabase.

User-supplied Gemini and USDA keys were moved from the tracked example into the ignored
backend environment file; example placeholders were restored. Live Gemini connectivity
(the configured model answering a short text prompt) and USDA food search both succeeded.
A real food-photo analysis still needs verification. The backend runs on loopback port 8010.

## Guided onboarding and coach verification

- Applied migration 002 to local Supabase without resetting existing data.
- Added tests for the deterministic calorie/macro calculator, adult/input validation,
  completion status, atomic save, rollback, forged-owner resistance, coach opt-in privacy,
  bounded history/roles, sanitized coach failures, and single-query weekly summaries.
- Real local integration tests verified atomic onboarding and user isolation; synthetic
  signup browser test completed all four steps, overrode calories, saved, reached Home,
  and remained completed after reload.
- A real Gemini coach request from the browser returned a meal suggestion with log sharing off.
  No existing user's nutrition data was used for this test.
- Desktop and 390×844 layouts were inspected. The test account is removed afterward.
- No native device installation or latency benchmark was performed. Provider/network latency
  varies; client sends are bounded, explicit, and have loading/error states rather than simulated speed.

## Calendar verification

Migration 003 applied successfully to local Supabase without resetting data. All 17 backend
tests passed, including month totals, leap-year February, meal date/macro edits, deletion,
meal counts (not food-item counts), unauthorized access and separation between users.
Browser verification used a disposable account with four synthetic meals: month navigation,
800 kcal from two meals on one date, another day's 650 kcal meal, monthly counts/average,
phone-sized rendering, selecting dates, and pre-filling the chosen day in the meal editor.
No real user records were modified. The synthetic account is removed after verification.
