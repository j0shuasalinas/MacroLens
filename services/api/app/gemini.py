"""Bounded Gemini calls and diagnostics that never log provider bodies or inputs."""
import asyncio
import math
import random
import re
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import logging
import httpx
from google.genai.errors import APIError

logger = logging.getLogger('macrolens.gemini')
MAX_ATTEMPTS = 3
REQUEST_BUDGET = 45.0


class GeminiFailure(Exception):
    def __init__(self, status: int, attempts: int, model: str, retry_after: int | None = None):
        self.status, self.attempts, self.model = status, attempts, model
        self.retry_after = retry_after
        super().__init__(f'Gemini HTTP {status} after {attempts} attempt(s)')

    @property
    def public_message(self):
        if self.status == 400:
            return 'Gemini rejected the image-analysis request (400). It was not retried. Please report this configuration error or enter the meal manually.'
        if self.status == 429:
            return f'Gemini rate limit or quota reached (429). Try again in {self.retry_after or 60} seconds. If it persists, check the project quota in Google AI Studio.'
        if self.status == 503:
            return f'Gemini is temporarily unavailable (503). Stopped after {self.attempts} attempt(s). Try again later or enter the meal manually.'
        if self.status == 504:
            return 'Food analysis timed out. Retrying has stopped. Try again later or enter the meal manually.'
        if self.status in (401, 403):
            return 'Gemini access is not configured correctly. Please check the backend API key and project permissions.'
        if self.status == 404:
            return 'The configured Gemini model is unavailable. Please check GEMINI_MODEL on the backend.'
        return f'Gemini could not complete food analysis ({self.status}). Please try later or enter the meal manually.'


def retry_guidance(exc: APIError) -> int | None:
    """Read Retry-After (seconds/date) and Google's RetryInfo without logging either."""
    delays = []
    response = getattr(exc, 'response', None)
    value = response.headers.get('Retry-After') if response is not None else None
    if value:
        try:
            delays.append(float(value))
        except ValueError:
            try:
                delays.append((parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds())
            except (ValueError, TypeError, OverflowError):
                pass
    body = getattr(exc, 'details', None)
    if isinstance(body, dict):
        error = body.get('error', body)
        details = error.get('details', []) if isinstance(error, dict) else []
        for info in details if isinstance(details, list) else []:
            if isinstance(info, dict) and str(info.get('@type', '')).endswith('google.rpc.RetryInfo'):
                duration = info.get('retryDelay', '')
                try:
                    delays.append(float(duration.removesuffix('s')) if isinstance(duration, str)
                                  else float(duration.get('seconds', 0)) + float(duration.get('nanos', 0)) / 1e9)
                except (ValueError, TypeError, AttributeError):
                    pass
    finite = [d for d in delays if math.isfinite(d) and d >= 0]
    return math.ceil(max(finite)) if finite else None


async def generate_with_retry(client, *, model, contents, config, fallback_model=''):
    start = time.monotonic()
    for attempt in range(1, MAX_ATTEMPTS + 1):
        # An optional explicitly configured fallback shares the same total attempt budget.
        selected = fallback_model if attempt == MAX_ATTEMPTS and fallback_model else model
        try:
            async with asyncio.timeout(max(.001, REQUEST_BUDGET - (time.monotonic() - start))):
                return await client.models.generate_content(model=selected, contents=contents, config=config)
        except APIError as exc:
            status = int(exc.code or 502)
            guidance = retry_guidance(exc)
            safe_model = selected if re.fullmatch(r'[a-zA-Z0-9_.-]{1,100}', selected) else '[invalid-model]'
            # Never log str(exc): Google's body may echo request text or credentials.
            logger.warning('Gemini failure exception=%s status=%d model=%s attempt=%d/%d reason=%s',
                           type(exc).__name__, status, safe_model, attempt, MAX_ATTEMPTS,
                           {400:'invalid_request',429:'rate_limit_or_quota',503:'temporarily_unavailable'}.get(status,'provider_error'))
            failure = GeminiFailure(status, attempt, safe_model, guidance or (60 if status == 429 else None))
            # 400 never retries. 429 returns immediately with guidance so a minute/day quota
            # cannot turn into an in-request retry loop. Only temporary 503s retry here.
            if status != 503 or attempt == MAX_ATTEMPTS:
                raise failure from None
            delay = max(2 ** (attempt - 1) + random.uniform(0, 1), guidance or 0)
            if time.monotonic() - start + delay >= REQUEST_BUDGET:
                raise failure from None
            await asyncio.sleep(delay)
        except (TimeoutError, httpx.HTTPError) as exc:
            safe_model = selected if re.fullmatch(r'[a-zA-Z0-9_.-]{1,100}', selected) else '[invalid-model]'
            logger.warning('Gemini failure exception=%s status=504 model=%s attempt=%d/%d reason=transport_timeout_or_error',
                           type(exc).__name__, safe_model, attempt, MAX_ATTEMPTS)
            raise GeminiFailure(504, attempt, safe_model) from None
