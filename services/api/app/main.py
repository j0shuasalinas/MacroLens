import asyncio
import io
import logging
import time
from collections import defaultdict, deque
from datetime import date, timedelta
from uuid import UUID
import httpx
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError
from google.genai.errors import APIError
from pydantic import ValidationError
from .config import settings
from .models import Meal, Goals, Weight, Profile, totals
from .ai import provider, enrich

logging.basicConfig(level=logging.INFO)
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('httpcore').setLevel(logging.WARNING)
logger = logging.getLogger('macrolens')
app = FastAPI(title='MacroLens API', version='0.1.0')
origins = [o.strip() for o in settings.cors_origins.split(',') if o.strip()]
if settings.environment == 'production' and any(not o.startswith('https://') for o in origins):
    raise RuntimeError('Production CORS origins must use HTTPS')
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                   allow_methods=['GET','POST','PUT','DELETE'], allow_headers=['Authorization','Content-Type'])

@app.exception_handler(Exception)
async def unexpected(request: Request, exc: Exception):
    logger.error('Unhandled request failure: %s %s', request.method, request.url.path)
    return JSONResponse(status_code=500, content={'detail':'Unexpected server error. Please retry.'})

@app.exception_handler(httpx.HTTPError)
async def upstream(request: Request, exc: Exception):
    logger.warning('Database request failed: %s', type(exc).__name__)
    return JSONResponse(status_code=503, content={'detail':'Data service unavailable. Please retry.'})

@app.get('/health')
def health():
    return {'status':'ok'}

async def user(authorization: str = Header(default='')):
    if not authorization.startswith('Bearer ') or not settings.supabase_url:
        raise HTTPException(401, 'Authentication required')
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(settings.supabase_url + '/auth/v1/user',
            headers={'apikey':settings.supabase_anon_key, 'Authorization':authorization})
    if response.status_code != 200:
        raise HTTPException(401, 'Invalid or expired session')
    return {'id':str(UUID(response.json()['id'])), 'authorization':authorization}

async def db(method, table, actor, params=None, body=None):
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.request(method, settings.supabase_url + '/rest/v1/' + table,
            headers={'apikey':settings.supabase_anon_key, 'Authorization':actor['authorization'],
                     'Prefer':'return=representation,resolution=merge-duplicates'}, params=params, json=body)
    response.raise_for_status()
    return response.json() if response.content else None

buckets = defaultdict(deque)
def limit(uid):
    now = time.monotonic()
    # Bound inactive-user memory; production uses a shared gateway limit as documented.
    for key in list(buckets):
        while buckets[key] and buckets[key][0] < now - 60:
            buckets[key].popleft()
        if not buckets[key]:
            del buckets[key]
    if len(buckets[uid]) >= 5:
        raise HTTPException(429, 'Five analyses per minute allowed', headers={'Retry-After':'60'})
    buckets[uid].append(now)

@app.post('/analyze')
async def analyze(image: UploadFile = File(...), actor=Depends(user)):
    limit(actor['id'])
    raw = await image.read(8 * 1024 * 1024 + 1)
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(413, 'Maximum image size is 8 MB')
    try:
        with Image.open(io.BytesIO(raw)) as photo:
            if photo.format not in ('JPEG','PNG','WEBP') or photo.width * photo.height > 25000000:
                raise ValueError()
            photo.load()
            photo.thumbnail((1600,1600))
            output = io.BytesIO()
            photo.convert('RGB').save(output, format='JPEG', quality=85)
            raw = output.getvalue()  # Strip metadata; do not retain user photos.
    except (UnidentifiedImageError, ValueError, OSError, Image.DecompressionBombError):
        raise HTTPException(415, 'Upload a valid JPEG, PNG or WebP under 25 megapixels')
    if not settings.gemini_api_key:
        raise HTTPException(503, 'Meal analysis is not configured')
    try:
        return await enrich(await provider().analyze(raw, 'image/jpeg'))
    except APIError as exc:
        code = 429 if exc.code == 429 else 502
        raise HTTPException(code, 'AI provider busy. Please retry shortly.', headers={'Retry-After':'30'})
    except (ValidationError, ValueError):
        raise HTTPException(502, 'AI returned an invalid result. Try another photo or log manually.')
    except (httpx.HTTPError, asyncio.TimeoutError):
        raise HTTPException(504, 'AI request timed out. Please retry.')

@app.get('/meals')
async def meals(day: date | None = None, actor=Depends(user)):
    params = {'user_id':f"eq.{actor['id']}", 'order':'day.desc,created_at.desc', 'limit':'500'}
    if day:
        params['day'] = f'eq.{day}'
    return await db('GET','meals',actor,params)

@app.post('/meals')
async def create_meal(meal: Meal, actor=Depends(user)):
    return (await db('POST','meals',actor,body={**meal.model_dump(mode='json'), 'user_id':actor['id']}))[0]

@app.put('/meals/{meal_id}')
async def update_meal(meal_id: UUID, meal: Meal, actor=Depends(user)):
    rows = await db('PATCH','meals',actor,{'id':f'eq.{meal_id}','user_id':f"eq.{actor['id']}"},meal.model_dump(mode='json'))
    if not rows:
        raise HTTPException(404, 'Meal not found')
    return rows[0]

@app.delete('/meals/{meal_id}')
async def delete_meal(meal_id: UUID, actor=Depends(user)):
    await db('DELETE','meals',actor,{'id':f'eq.{meal_id}','user_id':f"eq.{actor['id']}"})
    return {'deleted':True}

@app.get('/summary')
async def summary(day: date, actor=Depends(user)):
    return totals(await meals(day, actor))

@app.get('/summary/weekly')
async def weekly(day: date, actor=Depends(user)):
    return [{'day':str(day-timedelta(days=i)), **totals(await meals(day-timedelta(days=i), actor))} for i in range(6,-1,-1)]

@app.get('/goals')
async def goals(actor=Depends(user)):
    rows = await db('GET','nutrition_goals',actor,{'user_id':f"eq.{actor['id']}"})
    return rows[0] if rows else Goals().model_dump()

@app.put('/goals')
async def save_goals(value: Goals, actor=Depends(user)):
    return (await db('POST','nutrition_goals',actor,{'on_conflict':'user_id'}, {**value.model_dump(),'user_id':actor['id']}))[0]

@app.get('/profile')
async def profile(actor=Depends(user)):
    rows = await db('GET','profiles',actor,{'user_id':f"eq.{actor['id']}"})
    return rows[0] if rows else None

@app.put('/profile')
async def save_profile(value: Profile, actor=Depends(user)):
    return (await db('POST','profiles',actor,{'on_conflict':'user_id'}, {**value.model_dump(),'user_id':actor['id']}))[0]

@app.get('/weights')
async def weights(actor=Depends(user)):
    return await db('GET','weight_logs',actor,{'user_id':f"eq.{actor['id']}",'order':'day.asc','limit':'1000'})

@app.post('/weights')
async def save_weight(value: Weight, actor=Depends(user)):
    return await db('POST','weight_logs',actor,{'on_conflict':'user_id,day'}, {**value.model_dump(mode='json'),'user_id':actor['id']})

@app.delete('/account')
async def delete_account(actor=Depends(user)):
    if not settings.supabase_service_role_key:
        raise HTTPException(503, 'Account deletion is not configured')
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.delete(settings.supabase_url + '/auth/v1/admin/users/' + actor['id'],
            headers={'apikey':settings.supabase_service_role_key,'Authorization':'Bearer '+settings.supabase_service_role_key})
        response.raise_for_status()
    return {'deleted':True}


@app.get('/progress')
async def progress(actor=Depends(user)):
    entries = await weights(actor)
    entries = [w for w in entries if date.fromisoformat(w['day']) <= date.today()]
    weeks = {}
    for entry in entries:
        day = date.fromisoformat(entry['day'])
        week = str(day - timedelta(days=day.weekday()))
        weeks.setdefault(week, []).append(float(entry['pounds']))
    averages = [{'week': key, 'average': round(sum(values)/len(values),2), 'entries':len(values)} for key,values in sorted(weeks.items())]
    rate = None
    if len(entries)>1:
        days = (date.fromisoformat(entries[-1]['day'])-date.fromisoformat(entries[0]['day'])).days
        if days>=14:
            rate = round((float(entries[-1]['pounds'])-float(entries[0]['pounds']))/days*7,2)
    return {'weekly_averages':averages, 'observed_pounds_per_week':rate,
            'guidance':'Review 2–3 weeks of averages before considering a small calorie change. Targets are never changed automatically.'}
