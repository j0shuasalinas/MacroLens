import asyncio,json
from types import SimpleNamespace
from unittest.mock import AsyncMock
import httpx,pytest
from google.genai import errors
from pydantic import ValidationError
from app import ai,gemini
from app.config import settings
VALID={'items':[{'name':'Scone','grams':80,'calories':280,'protein':5,'carbs':40,'fat':11,'confidence':'low','uncertainty':'Estimated portion','source':'AI estimate','fdc_id':None}],'warnings':['Estimated']}
def error(status,headers=None,retry_delay=None):
    body={'error':{'code':status,'message':'PRIVATE image text API_KEY=secret','status':'INVALID_ARGUMENT' if status==400 else 'UNAVAILABLE'}}
    if retry_delay:body['error']['details']=[{'@type':'type.googleapis.com/google.rpc.RetryInfo','retryDelay':retry_delay}]
    return (errors.ClientError if status<500 else errors.ServerError)(status,body,httpx.Response(status,headers=headers or {},json=body))
def invoke(call,fallback=''):
    return asyncio.run(gemini.generate_with_retry(SimpleNamespace(models=SimpleNamespace(generate_content=call)),model='gemini-3.1-flash-lite',contents=[],config={},fallback_model=fallback))
def test_success():
    call=AsyncMock(return_value=SimpleNamespace(text=json.dumps(VALID)))
    assert invoke(call).text and call.await_count==1
@pytest.mark.parametrize('status',[400,401,403,404,429,500,504])
def test_non_503_never_retried(status,monkeypatch,caplog):
    sleep=AsyncMock();monkeypatch.setattr(gemini.asyncio,'sleep',sleep)
    call=AsyncMock(side_effect=error(status,{'Retry-After':'17'},'23.2s'))
    with pytest.raises(gemini.GeminiFailure) as exc:invoke(call)
    assert exc.value.status==status and exc.value.attempts==1 and exc.value.retry_after==24
    assert call.await_count==1 and sleep.await_count==0
    assert 'PRIVATE' not in caplog.text and 'secret' not in caplog.text
    assert f'status={status}' in caplog.text and 'model=gemini-3.1-flash-lite' in caplog.text
    assert 'ClientError' in caplog.text if status<500 else 'ServerError' in caplog.text
def test_503_backoff_jitter_then_success(monkeypatch):
    sleep=AsyncMock();monkeypatch.setattr(gemini.asyncio,'sleep',sleep);monkeypatch.setattr(gemini.random,'uniform',lambda a,b:.5)
    call=AsyncMock(side_effect=[error(503),error(503),SimpleNamespace(text='ok')])
    assert invoke(call).text=='ok' and call.await_count==3
    assert [c.args[0] for c in sleep.await_args_list]==[1.5,2.5]
def test_503_exhaustion_and_shared_fallback_budget(monkeypatch):
    sleep=AsyncMock();monkeypatch.setattr(gemini.asyncio,'sleep',sleep)
    call=AsyncMock(side_effect=error(503))
    with pytest.raises(gemini.GeminiFailure) as exc:invoke(call,'gemini-3.5-flash-lite')
    assert exc.value.status==503 and exc.value.attempts==3 and 'Stopped after 3' in exc.value.public_message
    assert [c.kwargs['model'] for c in call.await_args_list]==['gemini-3.1-flash-lite']*2+['gemini-3.5-flash-lite']
    assert sleep.await_count==2
def test_503_guidance_and_budget(monkeypatch):
    sleep=AsyncMock();monkeypatch.setattr(gemini.asyncio,'sleep',sleep)
    call=AsyncMock(side_effect=[error(503,{'Retry-After':'5'}),SimpleNamespace(text='ok')]);invoke(call)
    assert sleep.await_args.args[0]==5
    call=AsyncMock(side_effect=error(503,{'Retry-After':'120'}))
    with pytest.raises(gemini.GeminiFailure) as exc:invoke(call)
    assert call.await_count==1 and exc.value.retry_after==120
def test_timeout_stops():
    call=AsyncMock(side_effect=TimeoutError())
    with pytest.raises(gemini.GeminiFailure) as exc:invoke(call)
    assert exc.value.status==504 and call.await_count==1
def test_retry_after_date_and_invalid():
    from datetime import datetime,timedelta,timezone
    from email.utils import format_datetime
    date=format_datetime(datetime.now(timezone.utc)+timedelta(seconds=30))
    assert 28<=gemini.retry_guidance(error(429,{'Retry-After':date}))<=30
    assert gemini.retry_guidance(error(429,{'Retry-After':'invalid'})) is None
def test_payload_schema_and_strict_local_validation(monkeypatch):
    seen={};call=AsyncMock(return_value=SimpleNamespace(text=json.dumps(VALID)))
    class Client:
        def __init__(self,**kwargs):seen.update(kwargs);self.aio=self;self.models=SimpleNamespace(generate_content=call)
        async def __aenter__(self):return self
        async def __aexit__(self,*args):pass
    monkeypatch.setattr(ai.genai,'Client',Client)
    result=asyncio.run(ai.GeminiProvider().analyze(b'jpeg','image/jpeg'))
    assert result.items[0].name=='Scone' and seen['http_options'].retry_options.attempts==1
    assert seen['http_options'].timeout==30000
    kwargs=call.await_args.kwargs;assert kwargs['model']==settings.gemini_model
    image=kwargs['contents'][0].parts[0].inline_data
    assert image.mime_type=='image/jpeg' and image.data==b'jpeg' and kwargs['contents'][0].role=='user'
    config=kwargs['config'];assert config.response_mime_type=='application/json'
    schema=json.dumps(config.response_json_schema)
    assert not any(k in schema for k in ['$ref','$defs','exclusiveMinimum'])
    assert config.response_json_schema['properties']['items']['items']['properties']['grams']['type']=='number'
    call.return_value=SimpleNamespace(text=json.dumps({**VALID,'items':[{**VALID['items'][0],'grams':-1}]}))
    with pytest.raises(ValidationError):asyncio.run(ai.GeminiProvider().analyze(b'jpeg','image/jpeg'))

def test_503_then_400_stops_without_fallback(monkeypatch):
    monkeypatch.setattr(gemini.asyncio,'sleep',AsyncMock())
    call=AsyncMock(side_effect=[error(503),error(400)])
    with pytest.raises(gemini.GeminiFailure) as exc:invoke(call,'gemini-3.5-flash-lite')
    assert exc.value.status==400 and call.await_count==2

def test_bad_retry_metadata_is_ignored():
    exc=error(429,{'Retry-After':'NaN'})
    exc.details['error']['details']=None
    assert gemini.retry_guidance(exc) is None
