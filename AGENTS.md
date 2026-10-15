# MacroLens

Shared Expo client: apps/client. FastAPI: services/api. Supabase migrations: supabase/migrations.
Keep AI and service role credentials exclusively on the backend. All application database calls
use the verified user's token so RLS remains effective. Never introduce demo auth in production.
Use the FoodProvider interface when adding providers. Persist meals only after user confirmation.

Checks:
- `cd apps/client && npm run typecheck && npm run lint`
- `cd apps/client && EXPO_PUBLIC_API_URL=https://api.example.com EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=build-check npm run build:web`
- `cd services/api && uv run pytest -q`

Never claim deployment, external integrations, SQL policies, native compilation, or device
installation are verified unless they actually ran. Do not publish without user confirmation.
