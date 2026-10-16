"""Run from services/api: .venv/bin/python scripts/check_gemini.py [--model MODEL].

Uses only Google's public scones sample. Never saves meals or prints raw model output,
credentials, provider exception bodies, or private image data.
"""
import argparse
import asyncio
import io
import json
import sys
import time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import httpx
from PIL import Image, ImageOps
from pydantic import ValidationError
from app.ai import GeminiProvider
from app.config import settings
from app.gemini import GeminiFailure

async def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model')
    args=parser.parse_args()
    if args.model:
        settings.gemini_model=args.model
    if not settings.gemini_api_key:
        raise SystemExit('GEMINI_API_KEY is not configured')
    async with httpx.AsyncClient(timeout=20) as client:
        response=await client.get('https://storage.googleapis.com/generativeai-downloads/images/scones.jpg')
        response.raise_for_status()
    with Image.open(io.BytesIO(response.content)) as photo:
        photo.thumbnail((1600,1600));output=io.BytesIO()
        ImageOps.exif_transpose(photo).convert('RGB').save(output,'JPEG',quality=85)
    start=time.monotonic()
    try:
        result=await GeminiProvider().analyze(output.getvalue(),'image/jpeg')
        report={'success':True,'model':settings.gemini_model,'validated_food_count':len(result.items)}
    except GeminiFailure as exc:
        report={'success':False,'model':exc.model,'status':exc.status,'attempts':exc.attempts,'message':exc.public_message}
    except ValidationError:
        report={'success':False,'model':settings.gemini_model,'message':'Response failed Pydantic validation; raw output withheld.'}
    report['elapsed_seconds']=round(time.monotonic()-start,1)
    print(json.dumps(report))
    return 0 if report['success'] else 1

if __name__=='__main__':
    raise SystemExit(asyncio.run(main()))
