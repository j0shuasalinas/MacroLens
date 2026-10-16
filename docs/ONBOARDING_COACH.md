# Onboarding and nutrition coach

## Onboarding

Sign-up creates a real Supabase account. With email confirmation enabled, users confirm and
sign in before onboarding begins. A route guard checks `/onboarding` and sends incomplete
users to the wizard, including after reload or direct links. Failed checks show Retry / Sign out.

Four steps collect name, adult age, equation sex, height, current/goal weight, activity,
objective and preferred pace, then show editable targets. Height supports cm/inches; weight
supports lb/kg, converted to cm/lb before validation. Calculations run only on explicit request,
not on each keystroke, and require no AI request. Profile uses the same backend calculator.

`POST /onboarding/suggest` uses Mifflin–St Jeor × activity and 500 daily kcal per requested
lb/week, capped at +/-500 daily kcal. Protein: 2 g/kg; fat: 25% of calories; remainder: carbs.
Generated targets outside 1,200–6,000 kcal prompt measurement review. This is a product safeguard,
not a clinical assessment. Users can override all suggested numbers before saving.

`POST /onboarding/complete` validates both payloads, then invokes a PostgreSQL transaction under
the verified user's token. It saves profile/goals and `profiles.onboarded_at` atomically.
If goals fail, profile changes roll back. Owner comes from `auth.uid()`, never JSON; RLS applies.
Migration `002_onboarding.sql` is required. Existing users with both profile and goals are marked
complete. Wizard drafts are in screen memory; reloading before final confirmation starts again.

## Coach

`POST /coach` requires authentication and the existing server-only Gemini key. Input limits:
question 1,500 characters; ten history messages of 2,000 characters each; local date; and
`include_context` (default false). System roles are rejected. The coach gives general adult
nutrition/habit guidance, avoids extreme restriction and medical diagnosis, and has no write tools.

With context enabled, two concurrent queries read only the authenticated user's goals and up to
200 meals across seven days. Only objective/targets and daily nutrition totals go to Gemini;
name, age, sex, body weight, photos and raw meals are omitted. Logs are described as incomplete
estimates: zero logged is not zero eaten. Sharing off means no context database queries.
Turning it off later doesn't erase previously sent context; New chat starts fresh.

All chat messages go to Google and remain subject to Google's data policies. MacroLens stores
no chat transcript in its database. The UI keeps thirty messages in app memory and sends only
the last ten, clearing on New chat/sign-out/reload. Navigation can retain the current conversation.
It displays immediate pending feedback and supports explicit retries without duplicated bubbles
or automatic paid-request retries. Users can draft while waiting; only one send runs at a time.
Responses arrive whole, not as token streams.

## Responsiveness and limits

- Existing Flash-Lite model, 700 output-token cap, async SDK and 25-second provider timeout.
- Five coach requests/minute/user; separate from the image-analysis throttle.
- Bounded conversation and optional aggregated context; concurrent context reads.
- Dashboard weekly summary now uses one range query instead of seven sequential reads.
- Data queries cache for 30 seconds; onboarding status for five minutes. Writes invalidate
  affected data and sign-out clears cache/navigation state per user.
- No new dependencies, artificial typing delays, per-keystroke network calls or background polling.

The limiter is process-local: use shared throttling before scaling to multiple workers.
Model/network latency varies; no hard latency promise. Browser checks don't prove device performance.

Official SDK references: [text generation](https://ai.google.dev/gemini-api/docs/text-generation)
and [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output).
