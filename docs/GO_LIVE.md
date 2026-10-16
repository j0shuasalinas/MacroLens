# Deploy MacroLens from GitHub

Repository: https://github.com/j0shuasalinas/MacroLens

The code is prepared for Render (API + static frontend) and hosted Supabase (database + auth).
It has not been deployed. A working public release needs all three; the local Supabase URLs
and keys are development-only and cannot serve a deployed app.

If using this chat to deploy, install/connect Render and Supabase so their actual projects
and services can be selected. No hosting credentials were found in this workspace.

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
- `CORS_ORIGINS`: final exact web origin (can initially be empty until the frontend URL is assigned)

`ENVIRONMENT=production` is declared in the blueprint. The blueprint explicitly uses the
free compute plan for an initial personal preview, avoiding Render's paid default. Review
Render account usage/billing settings before creating resources. Free API instances sleep
when idle and may take about a minute to wake, so this plan is unsuitable for consistently
fast use. A paid always-on instance is a separate decision; no upgrade is performed here.
See [Render free-service limits](https://render.com/docs/free).

Once deployed, record the actual API HTTPS URL from Render and check `/health`.
This only proves process liveness; authentication and providers require separate checks.

## 3. Render frontend

Create a second Blueprint from the same repo/branch using `render-web.yaml`.
The repo-root build command enters `apps/client`, installs from the npm lockfile, and exports
its web build. Publish directory: `apps/client/dist`. It pins Node 26.10.0, the locally tested
version supported by this Expo SDK. The blueprint includes SPA fallback and static headers.

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

## Current handoff

GitHub contains the implementation, migration and deployment files. Local configuration
remains local. To continue deployment in chat, install/connect Render and Supabase, then
select the intended projects. No cloud resources, data transfer, paid plan or public URL
were created during this preparation.
