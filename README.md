# MacroLens

A shared Expo / React Native / TypeScript nutrition tracker for web, iOS and Android,
with a FastAPI API, Supabase authentication/database and Gemini food-photo analysis.
Premium charcoal and emerald styling, mobile bottom navigation and desktop sidebar.

Implemented: real email/password authentication, persistent sessions, protected screens,
profile/onboarding, editable goals, photo picker/camera, Gemini structured analysis,
USDA nutrition enrichment, editable meal review, manual meals, history/search/date filter,
meal edit/delete/duplicate, daily totals, weekly logging consistency, weight logging,
weekly averages, weight chart and account deletion.

## First run on your Mac

Use Node 22 LTS or a current compatible Node version, npm, and [uv](https://docs.astral.sh/uv/).
The checked-in npm and uv lockfiles capture the tested dependencies.

1. Create a Supabase project. Run `supabase/migrations/001_initial.sql` in its SQL editor.
   This creates the five tables, indexes, ownership policies and a private storage bucket.
2. Enable email/password authentication. Set the Supabase Auth Site URL to your web origin
   and allow your development/production redirect URLs. Email confirmation is supported:
   confirm the email, then return to the app and sign in. No fake user or demo session exists.
3. Copy and fill the environment examples:

```sh
cp services/api/.env.example services/api/.env
cp apps/client/.env.example apps/client/.env
```

4. Start the API in one terminal:

```sh
cd services/api
uv sync --frozen
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8010
```

5. Start the client in another terminal:

```sh
cd apps/client
npm ci
npm run web
```

Open the Expo web URL (normally `http://localhost:8081`). Register, confirm your email if enabled,
and sign in. Set your profile/goals in Settings, scan or manually enter a meal, review all foods,
and confirm Save. History, dashboard and weight tracking use saved user data.

## Configuration

| Variable | Location | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Client | Supabase project HTTPS URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Client | Publishable/anon key; safe to bundle with RLS enabled |
| `EXPO_PUBLIC_API_URL` | Client | API base URL without trailing slash; HTTPS in production |
| `SUPABASE_URL` | API | Same Supabase project |
| `SUPABASE_ANON_KEY` | API | Publishable/anon key for user-scoped REST and token verification |
| `SUPABASE_SERVICE_ROLE_KEY` | API only | Admin key for account deletion only |
| `GEMINI_API_KEY` | API only | Google AI Studio API key |
| `GEMINI_MODEL` | API | Defaults to `gemini-3.1-flash-lite` |
| `AI_PROVIDER` | API | `gemini`; unknown providers fail instead of silently falling back |
| `USDA_API_KEY` | API only | FoodData Central key; missing/failing lookups are disclosed |
| `CORS_ORIGINS` | API | Comma-separated exact approved web origins, no trailing slash |
| `ENVIRONMENT` | API | `development` or `production`; production origins must use HTTPS |
| `PORT` | Host | Production HTTP listen port, normally supplied by hosting service |

Never put Gemini, USDA or service-role keys in `EXPO_PUBLIC_*`. Public client variables
are compiled into builds; changing them requires a new export/build. Keep `.env` files out
of Git and use hosting secret stores. The root `.env.example` mirrors backend variables;
the backend reads `.env` relative to its working directory (`services/api`).

## iPhone, Android and production deployment

See [Deployment and device guide](docs/DEPLOYMENT.md) for exact APK commands,
Xcode installation, Apple signing, Expo Go, TestFlight, static web hosting and backend setup.
See [Architecture and endpoints](docs/ARCHITECTURE.md) for the analysis pipeline and API.
See [Verification record](docs/VERIFICATION.md) for results and remaining external checks.

## Checks

```sh
cd services/api
uv run pytest -q
```

```sh
cd apps/client
npm run typecheck
npm run lint
EXPO_PUBLIC_API_URL=https://YOUR_API_HOST npm run build:web
npx expo export --platform ios --platform android --output-dir /tmp/macrolens-native-export
```

Photo estimates are inherently uncertain. Every analysis is reviewed before saving.
USDA candidates are approximate matches with the matched description and FDC identifier visible.
Images are transiently processed and sent to Google; the MVP does not retain meal photos.
Your supplied starting targets are 2,900 kcal, 160 g protein, 385 g carbs, 80 g fat,
165 lb current weight and 175 lb goal weight; all can be changed before saving.

## Local Supabase alternative (no cloud project needed)

The checked-in config uses ports 55421–55429 to avoid other Supabase projects.
Docker and Supabase CLI are required. From the repository root:

```sh
supabase start
supabase status -o json > /tmp/macrolens-local-status.json
python3 scripts/configure-local.py /tmp/macrolens-local-status.json
```

The helper creates ignored local env files only when absent; it preserves existing configuration.
Local email confirmation is disabled by the Supabase development defaults. Start the API on
8010 and client as above; if 8081 is occupied use `npm run web -- --port 8082`.
The current workspace has already been configured against this local stack. It still needs
`GEMINI_API_KEY` (and optionally `USDA_API_KEY`) added to `services/api/.env`, then an API restart,
to analyze real photos. Replace all local URLs/keys with your own project values before deployment.

Run the opt-in integration test (creates and cleans up synthetic local users only):

```sh
MACROLENS_LOCAL_STATUS=/tmp/macrolens-local-status.json services/api/.venv/bin/python -m pytest services/api/tests/test_local_supabase.py -q
```

To stop the local stack, use `supabase stop` from this repository. Do not use `--no-backup`
unless intentionally discarding your local data.
