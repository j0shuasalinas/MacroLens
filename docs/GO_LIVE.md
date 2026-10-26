# Deploy MacroLens from GitHub

Repository: https://github.com/j0shuasalinas/MacroLens

Deployment targets: Netlify (web), Render (FastAPI), and hosted Supabase (database + auth).
Web and API are deployed, and hosted Supabase is configured and integration-tested.

- Web: https://macrolens-joshua.netlify.app
- API: https://macrolens-api-ce7g.onrender.com
- API health: https://macrolens-api-ce7g.onrender.com/health
Never use a localhost API URL in a production web build.

## 1. Hosted Supabase

Create a dedicated MacroLens project or select an existing intended project. Keep your
current local data intact; cloud migration here means schema setup, not uploading local meals.
Apply these migrations to that project's SQL editor in order:

1. `supabase/migrations/001_initial.sql`
2. `supabase/migrations/002_onboarding.sql`
3. `supabase/migrations/003_nutrition_calendar.sql`

Copy the project's HTTPS URL, publishable/anon key, and server-only service role key into
hosting environment settings as described below. Do not paste secrets into GitHub files.
Enable email/password authentication; if confirmation is enabled, test delivery and the
confirmation-return flow. Supabase Auth email settings may need your SMTP service for
reliable delivery beyond a small test. Use the final web origin in Auth URL Configuration.

## 2. Render API

Create a Blueprint from this repository, branch `main`, blueprint path `render.yaml`.
The API uses its Dockerfile, Python 3.12, `/health` liveness check, and the host's `$PORT`.
Supply backend variables:

- `SUPABASE_URL`: hosted project HTTPS URL
- `SUPABASE_ANON_KEY`: its publishable/anon key
- `SUPABASE_SERVICE_ROLE_KEY`: its private admin key (account deletion)
- `GEMINI_API_KEY` and `USDA_API_KEY`: the keys already configured locally, entered into Render's secret settings
- `CORS_ORIGINS`: final exact HTTPS web origin; enter it before the initial API deploy (omitting it uses a localhost default, which production rejects)

`ENVIRONMENT=production` is declared in the blueprint. The blueprint explicitly uses the
free compute plan for an initial personal preview, avoiding Render's paid default. Review
Render account usage/billing settings before creating resources. Free API instances sleep
when idle and may take about a minute to wake, so this plan is unsuitable for consistently
fast use. A paid always-on instance is a separate decision; no upgrade is performed here.
See [Render free-service limits](https://render.com/docs/free).

Once deployed, record the actual API HTTPS URL from Render and check `/health`.
This only proves process liveness; authentication and providers require separate checks.

## 3. Netlify frontend

Import `j0shuasalinas/MacroLens` from GitHub, branch `main`. Root `netlify.toml` sets
base directory `apps/client`, build command `npm run build:web`, publish directory
`dist`, and Node 26.10.0. Netlify installs dependencies from the npm lockfile.
Expo copies `public/_redirects` (SPA fallback) and `public/_headers` into `dist`.
Use Netlify's assigned HTTPS URL initially; a custom domain is optional.

Supply only these public client variables:

- `EXPO_PUBLIC_API_URL`: actual API HTTPS URL from step 2 (no trailing slash)
- `EXPO_PUBLIC_SUPABASE_URL`: hosted project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: publishable/anon key

Do not supply Gemini, USDA or service role keys to the frontend. The production build rejects
missing/non-HTTPS service URLs. Actual static files must be served before SPA fallback.

## 4. Connect the deployed services

After the frontend URL is assigned:

1. Set the API's `CORS_ORIGINS` to that exact HTTPS web origin and redeploy the API.
2. Set Supabase Auth Site URL and allowed redirect URLs to the frontend origin and expected auth paths.
3. Open the frontend in a fresh browser session, register/confirm email, complete onboarding,
   log a meal, view the calendar, ask Coach, and test sign-out/session persistence.
4. Check real food-photo analysis separately. Inspect only sanitized logs if a request fails.
5. Check direct-route refresh at `/calendar`, manifest/icons/service worker, and phone browser layout.

Web and API both need verified HTTPS. No deployment is considered successful until the
actual URLs and these checks work. Native clients can then use the same API HTTPS URL.

## Initial deployment status (2026-10-16)

Hosted Supabase project `fiqfhrjrhwlnewcjqbkv` has all three migrations applied
through SQL Editor. Cloud checks passed for authentication, onboarding, meals,
daily/calendar totals, weight logs, and isolation between two temporary users.
The test users and their records were removed. Email confirmation remains enabled;
email delivery has not been tested.

Ignored local environment files use the cloud project. Supabase Auth Site URL is
`https://macrolens-joshua.netlify.app`, with that site's redirect paths allowed alongside
local development URLs. Render CORS allows only this exact production web origin.

Render service `srv-db8ro47avr4c73c40mag` runs on the free plan, from public GitHub
source. This public-repository connection does not provide automatic code deploys;
manually deploy the latest commit in Render after backend changes. Netlify is connected
to GitHub `main` with automatic publishing. Server credentials are in Render's environment;
Netlify contains only the three public client values.

Verified deployed health, authentication enforcement, CORS allow/deny, onboarding,
meal save/edit, daily/calendar totals, weights, and two-user isolation. Disposable test
accounts and records were removed. Web HTTPS, direct-route refresh, manifest/icons,
service-worker cache headers and initial bundles were checked. The public login page renders.
Google returned temporary high-demand errors during the initial Gemini check. Real food-photo
analysis, email delivery/confirmation, and native-device builds/installations remain unverified.
`render-web.yaml` remains an optional alternative; the deployed web app uses `netlify.toml`.

## Recovery (2026-10-25)

Resumed the paused Supabase project and verified a real deployed photo-analysis request,
USDA enrichment, meal saving, daily/calendar totals and weight logging. See
[Recovery instructions and verification](RECOVERY.md) for dependency readiness checks,
the inference-timeout correction, and the limits of free hosting.
