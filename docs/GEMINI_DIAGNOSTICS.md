# Gemini food scanning: diagnosis and operation

## Observed on 2026-10-16

Before editing, inspected `app/ai.py`, `app/main.py`, the scan screen, API wrapper,
and Render application logs. The reported exact phrase “AI provider is busy, trying
again” is not in this checkout. The matching backend message was “AI provider busy.
Please retry shortly.” `/analyze` converted **all** Gemini API errors except 429
into HTTP 502 with that text and a fixed 30-second retry header. The scan screen
made one POST per tap, with `busy` cleared in `finally`; no automatic frontend
scan retry loop was present. Existing Render logs show POST /analyze → 502 but
did not retain the upstream exception, so historical 400/503 causes cannot be
recovered from those access logs alone.

A fresh request with the configured `gemini-3.1-flash-lite`, a normalized JPEG of
Google's public scones sample, JSON output, and the original full Pydantic schema
reproduced `google.genai.errors.ClientError`, HTTP 400, safe provider message
“Request contains an invalid argument.” A simplified schema instead reached
`ServerError` 503 with the provider's high-demand message (a schema-free probe
also received 504). This isolates a request/schema compatibility problem in the
original configuration, alongside provider availability failures. Google did not
identify a particular schema keyword, so the precise rejected keyword is unconfirmed.

The wire schema now uses a conservative subset, inlines `$ref`/`$defs`, and omits
validation-only constraints/default metadata. Full Pydantic `Analysis` validation
still applies after generation, including positive portions, bounds, finite numbers,
and no extra fields. Invalid output is rejected rather than fabricated. Images
are decoded, oriented, resized to 1600 px, stripped of metadata and sent as JPEG
bytes with `image/jpeg` in an explicit user content part. The SDK handles base64;
no data-URL prefix is passed as image bytes. The model's output is capped at 4096 tokens.

## Retry and error contract

- SDK retries are explicitly disabled (`attempts=1`) so they cannot multiply the
  application budget. Only upstream 503 retries: at most **three total attempts**,
  with 1–2s then 2–3s exponential delays plus jitter and a 45-second overall budget.
  Individual transport requests allow up to 30 seconds for image inference, capped
  by that overall budget. The earlier 15-second transport timeout was too short
  for some real browser scans.
- 503 Retry-After is a minimum delay. If it exceeds the remaining budget, return
  the failure immediately with guidance instead of waiting indefinitely.
- 429 is returned immediately, without automatic retry. Respect the larger of
  Retry-After (seconds or HTTP-date) and Google's RetryInfo, rounded up; use 60s
  if neither is supplied. The client disables re-analysis until that delay expires.
  A daily quota may still require waiting for reset/checking AI Studio.
- 400 never retries or falls back. The API returns 502 with an explicit rejected
  configuration message, rather than falsely saying Google is busy.
- Exhausted 503 returns 503 and the number of attempts. Timeouts return 504 and
  stop. No automatic client scan retries occur. Users can retry manually later.
- Logs record exception class, HTTP status, sanitized model, attempt count and a
  curated reason. They never log raw exceptions, prompts, image bytes, provider
  response bodies, credentials, or nutrition output.

## Models and project access

`GEMINI_MODEL` defaults to `gemini-3.1-flash-lite`. Optional
`GEMINI_FALLBACK_MODEL` is empty by default. If explicitly set to a supported
vision/JSON model, the third attempt uses it after two primary-model 503s; it
shares the same total budget. No fallback occurs for 400/429. Set these variables
on Render's backend environment and redeploy; do not put provider keys on Netlify.

Google documents image input and structured output for both
[3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite)
and [3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite).
Both advertise free-tier input/output in the [pricing table](https://ai.google.dev/gemini-api/docs/pricing).
The current table lists 3.1 below 3.5 in paid token prices, so 3.5 is an optional
availability alternative, not a cheaper replacement. Model metadata calls with
the configured key succeeded for both. That proves model discovery, not remaining
quota or billing tier. Check actual limits in the project's AI Studio usage page.

## Reproduce safely

From `services/api`, with the ignored `.env` configured:

```sh
.venv/bin/python scripts/check_gemini.py
.venv/bin/python scripts/check_gemini.py --model gemini-3.5-flash-lite
.venv/bin/python -m pytest -q
```

The diagnostic uploads only Google's public sample image, validates the response,
prints a sanitized status/count, saves no meals, and exits nonzero on failure.
The initial corrected primary-model run exhausted three 503s in 11.2 seconds.
The alternative returned 503 followed by a transport timeout; neither run
successfully analyzed food. A final run of the committed diagnostic pipeline also
stopped after three 503s in 8.5 seconds. No fabricated estimates were substituted.

Validation: 38 backend tests passed; one local-Supabase-only test was skipped.
Client typecheck, lint, and production web export passed.

Tests cover success, request shape/MIME/schema, local validation, non-retryable
400, separate 429 guidance, 503 recovery and exhaustion, jitter, HTTP-date guidance,
over-budget waits, optional fallback sharing the budget, timeout termination,
safe logs, and user-facing API error mapping.
