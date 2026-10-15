# Architecture

Expo Router screens share React Native UI across web/iOS/Android. TanStack Query fetches
and invalidates saved records, Zustand holds the editable unsaved meal draft, and Supabase
Auth persists sessions through AsyncStorage. Authenticated data is cleared from query cache
and the draft on sign-out. The backend authorizes every data route with Supabase `/auth/v1/user`
and forwards the verified bearer token to Supabase REST, preserving RLS.

## Analysis pipeline

1. Authenticated client uploads multipart `image` to `/analyze`.
2. Backend limits requests, checks bytes/decoded format/dimensions, resizes and strips metadata.
3. `FoodProvider` interface selects `AI_PROVIDER`; `GeminiProvider` uses official `google-genai`.
4. Gemini receives image bytes and a JSON schema derived from Pydantic `Analysis`.
5. Returned JSON is independently parsed and validated. Invalid outputs become actionable errors.
6. USDA searches Foundation/SR Legacy records. A candidate needs meaningful name-token overlap
   and all four nutrient values; its per-100g values are scaled to estimated grams.
7. Candidate description, FDC id, source, confidence and portion/ingredient uncertainty are shown.
   Unmatched foods retain labeled AI estimates. Match preparation/identity still needs user review.
8. User can change name, grams, macros, uncertainty, meal title/category/date, and add/remove foods.
   No database write occurs until the user confirms Save.

Add OpenAI later by implementing the asynchronous `FoodProvider.analyze(bytes,mime)` contract,
returning `Analysis`, and registering it in `PROVIDERS`. USDA enrichment, validation and meal
persistence remain independent. There is no OpenAI implementation or hidden fallback today.

Photos are not stored. A private `meal-photos` bucket reserves future photo retention, with no
client upload policy. Account deletion cascades database records. If retention is implemented,
add ownership policies and storage object cleanup before enabling uploads.

## Endpoints

`GET /health` is public. All remaining routes require `Authorization: Bearer <Supabase access token>`.
Full request/response schemas are generated at `/docs` and `/openapi.json`.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | /analyze | Multipart image → editable foods and warnings; no persistence |
| GET | /meals?day=YYYY-MM-DD | Own meals; latest 500, optionally one date |
| POST | /meals | Create validated meal and transactionally normalized items |
| PUT | /meals/{uuid} | Replace meal fields/items; owner-scoped, 404 when absent |
| DELETE | /meals/{uuid} | Delete own meal and cascade items |
| GET | /summary?day=YYYY-MM-DD | Sum stored items for that calendar date |
| GET | /summary/weekly?day=YYYY-MM-DD | Seven daily summaries ending on date |
| GET, PUT | /profile | Read/upsert own onboarding profile |
| GET, PUT | /goals | Read/upsert own targets; editable defaults before first save |
| GET, POST | /weights | Chronological own entries; upsert user/date in pounds |
| GET | /progress | Weekly averages, observed rate after 14 days, conservative guidance |
| DELETE | /account | Delete authenticated auth user via server-only admin key; cascade records |

Meal days are explicit local calendar dates, not UTC timestamp truncations. The database stores
both this date and an audit timestamp. Nutrition totals use all food items; macro and calorie
goals are independent. Portion edits scale current macros; direct food/macro edits change the
source to User edited. Weekly consistency means days with a saved nonzero-calorie meal, not a
claim that a full diet was logged. History and weight queries have documented MVP caps; add
pagination before users exceed 500 meals / 1,000 weight logs.

Profile suggestions use Mifflin–St Jeor (weight in kg, height cm, age years, equation sex), an
activity multiplier, and 500 daily kcal per requested lb/week change. All inputs and calculated
targets remain editable, and no targets change automatically based on weight fluctuations.
