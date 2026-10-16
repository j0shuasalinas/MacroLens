# Connect photo scanning

For your current Mac setup, Supabase is already running locally. You only need a Gemini key
to try a real photo. A USDA key adds nutrition database matches and is recommended.
You do not need an OpenAI key or a Cal AI subscription.

## 1. Get a Gemini key

Open [Google AI Studio API keys](https://aistudio.google.com/apikey), sign in, and create a key
for a project. If prompted, create or select the project. Check that project's available model
quota and billing in AI Studio; don't assume a consumer Gemini subscription includes API usage.
The backend currently defaults to `gemini-3.1-flash-lite`, configurable with `GEMINI_MODEL`.

Official instructions: [Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key)
and [API billing](https://ai.google.dev/gemini-api/docs/billing).

## 2. Get a USDA key

Request a key at [FoodData Central API key signup](https://fdc.nal.usda.gov/api-key-signup/).
Use the key supplied by the signup process. Without it, photo scanning still works through
Gemini, and the app explicitly labels nutrition values as AI estimates.

## 3. Put both keys in the backend

Open `services/api/.env`. Preserve its existing Supabase values and add or update:

```dotenv
GEMINI_API_KEY=your_gemini_key_here
USDA_API_KEY=your_usda_key_here
```

Do not put these keys in `apps/client/.env`, commit them, or paste them into chat.
The backend `.env` is already ignored by Git. Keep one entry per variable.

## 4. Restart the backend

Stop the existing MacroLens API terminal with Control-C, then start it again:

```sh
cd services/api
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

A `.env` change alone may not trigger Uvicorn reload. Restart explicitly. If port 8010 is
already in use, stop the existing MacroLens API first rather than starting a second copy.

Start the browser app if needed, in another terminal:

```sh
cd apps/client
npm run web -- --port 8082
```

Open http://localhost:8082, sign in, tap **Scan**, choose a clear photo, tap **Get nutrition
estimate**, review the foods and macros, and save. Confirm the totals appear on Home.

## If something goes wrong

| Message / symptom | What to check |
| --- | --- |
| Photo scanning isn't set up yet | Set `GEMINI_API_KEY` in the API env, then restart the API |
| Provider busy / rate limit | Check AI Studio quota and billing; wait before retrying |
| Can't reach server | API is running on 8010, client API URL is `http://localhost:8010` |
| USDA unavailable | Check `USDA_API_KEY`; Gemini-only estimates remain usable |
| Invalid or expired session | Sign out and sign in again; make sure local Supabase is running |
| Image not supported | Use JPEG, PNG or WebP, under 8 MB and 25 megapixels |

Live provider success is not verified until real keys are supplied and an actual photo succeeds.

## Supabase later, when you're ready for phone/cloud use

Create a Supabase project and apply `supabase/migrations/001_initial.sql` then `002_onboarding.sql`. Use its URL and
publishable/anon key in the client; set the same values on the backend. The backend additionally
needs the server-only service role key for account deletion. Never copy the service role key
into the client. Replace all local values together to avoid mixing projects.

A physical iPhone needs an API URL reachable from the phone, ideally a deployed HTTPS API.
See [Deployment](DEPLOYMENT.md) for cloud Supabase, CORS, Xcode and EAS instructions.
