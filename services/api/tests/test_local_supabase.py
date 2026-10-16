"""Opt-in real Supabase test. Uses only the local stack on port 55421."""
import json
import os
from uuid import uuid4
import httpx
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

@pytest.mark.skipif(not os.getenv('MACROLENS_LOCAL_STATUS'),reason='Local Supabase not requested')
def test_real_persistence_and_rls(monkeypatch):
    status=json.load(open(os.environ['MACROLENS_LOCAL_STATUS']))
    url=status['API_URL']
    assert url in ['http://127.0.0.1:55421','http://localhost:55421'], 'This test must never target cloud data'
    key=status['ANON_KEY']; admin=status['SERVICE_ROLE_KEY']
    monkeypatch.setattr(settings,'supabase_url',url)
    monkeypatch.setattr(settings,'supabase_anon_key',key)
    monkeypatch.setattr(settings,'supabase_service_role_key',admin)
    headers={'apikey':key}
    users=[]
    try:
        for _ in range(2):
            email=f'macrolens-{uuid4()}@example.com'
            response=httpx.post(url+'/auth/v1/signup',headers=headers,json={'email':email,'password':'Local-test-only-398!'},timeout=15)
            response.raise_for_status()
            data=response.json();users.append((data['user']['id'],data['access_token']))
        a={'Authorization':'Bearer '+users[0][1]}; b={'Authorization':'Bearer '+users[1][1]}
        payload={'title':'Isolation test','day':'2026-10-15','category':'lunch','items':[{'name':'Rice','grams':100,'calories':130,'protein':3,'carbs':28,'fat':1}]}
        with TestClient(app) as client:
            response=client.post('/meals',headers=a,json=payload)
            assert response.status_code==200,response.text
            mid=response.json()['id']
            assert len(client.get('/meals',headers=a).json())==1
            assert client.get('/meals',headers=b).json()==[]
            assert client.put('/meals/'+mid,headers=b,json=payload).status_code==404
            client.delete('/meals/'+mid,headers=b)
            assert len(client.get('/meals',headers=a).json())==1
            assert client.get('/summary?day=2026-10-15',headers=a).json()['calories']==130
            assert client.get('/summary?day=2026-10-15',headers=b).json()['calories']==0
            calendar=client.get('/calendar?year=2026&month=10',headers=a)
            assert calendar.status_code==200 and len(calendar.json())==31
            logged=next(day for day in calendar.json() if day['day']=='2026-10-15')
            assert logged['calories']==130 and logged['meal_count']==1
            assert all(day['meal_count']==0 for day in client.get('/calendar?year=2026&month=10',headers=b).json())
            leap=client.get('/calendar?year=2024&month=2',headers=a).json()
            assert len(leap)==29 and leap[-1]['day']=='2024-02-29'

            direct_a={'apikey':key,**a};direct_b={'apikey':key,**b}
            assert len(httpx.get(url+'/rest/v1/meal_items',headers=direct_a).json())==1
            assert httpx.get(url+'/rest/v1/meal_items',headers=direct_b).json()==[]
            forged=httpx.post(url+'/rest/v1/meals',headers=direct_b,json={**payload,'user_id':users[0][0]})
            assert forged.status_code in (401,403)
            assert client.post('/weights',headers=a,json={'day':'2026-10-15','pounds':165}).status_code==200
            assert client.get('/weights',headers=b).json()==[]
            assert client.put('/goals',headers=a,json={'calories':2900}).status_code==200
            assert client.put('/profile',headers=a,json={'name':'Test','age':21,'height_cm':175,'activity':1.55,'current_weight':165,'goal_weight':175,'objective':'Lean bulk','weekly_change':.25,'sex':'male'}).status_code==200
            assert client.get('/profile',headers=b).json() is None
            profile={'name':'Onboarded','age':21,'height_cm':175,'activity':1.55,'current_weight':165,'goal_weight':175,'objective':'Lean bulk','weekly_change':.25,'sex':'male'}
            assert client.get('/onboarding',headers=a).json()['completed'] is False
            suggested=client.post('/onboarding/suggest',headers=a,json=profile).json()
            completed=client.post('/onboarding/complete',headers=a,json={'profile':profile,'goals':suggested})
            assert completed.status_code==200 and completed.json()['completed'] is True
            assert client.get('/onboarding',headers=a).json()['completed'] is True
            assert client.get('/onboarding',headers=b).json()['completed'] is False
            # The RPC is a single transaction: invalid goals must roll back profile changes.
            bad=httpx.post(url+'/rest/v1/rpc/complete_onboarding',headers=direct_a,json={'profile_data':{**profile,'name':'Must roll back'},'goal_data':{**suggested,'fat':-1}})
            assert bad.status_code>=400
            assert client.get('/profile',headers=a).json()['name']=='Onboarded'
            # Even a forged user id inside JSON cannot choose another user's record.
            own=httpx.post(url+'/rest/v1/rpc/complete_onboarding',headers=direct_b,json={'profile_data':{**profile,'user_id':users[0][0],'name':'User B'},'goal_data':suggested})
            assert own.status_code==200
            assert client.get('/profile',headers=a).json()['name']=='Onboarded'
            assert client.get('/profile',headers=b).json()['name']=='User B'

            assert client.put('/meals/'+mid,headers=a,json={**payload,'title':'Edited'}).json()['title']=='Edited'
            # Moving/editing a meal changes the calendar date and recalculates all items.
            changed={**payload,'day':'2026-10-16','items':payload['items']*2}
            assert client.put('/meals/'+mid,headers=a,json=changed).status_code==200
            moved=client.get('/calendar?year=2026&month=10',headers=a).json()
            assert next(d for d in moved if d['day']=='2026-10-15')['meal_count']==0
            assert next(d for d in moved if d['day']=='2026-10-16')['calories']==260
            assert next(d for d in moved if d['day']=='2026-10-16')['meal_count']==1

            assert client.delete('/meals/'+mid,headers=a).status_code==200
            assert httpx.get(url+'/rest/v1/meal_items',headers=direct_a).json()==[]
            assert all(d['meal_count']==0 for d in client.get('/calendar?year=2026&month=10',headers=a).json())
            assert client.delete('/account',headers=a).status_code==200
            assert client.get('/meals',headers=a).status_code==401
            # Auth deletion cascades saved profile, targets and weight.
            admin_headers={'apikey':admin,'Authorization':'Bearer '+admin}
            for table in ['profiles','nutrition_goals','weight_logs']:
                assert httpx.get(url+'/rest/v1/'+table,headers=admin_headers,params={'user_id':'eq.'+users[0][0]}).json()==[]
            bucket=httpx.get(url+'/storage/v1/bucket/meal-photos',headers=admin_headers).json()
            assert bucket['public'] is False
    finally:
        for uid,_ in users:
            httpx.delete(url+'/auth/v1/admin/users/'+uid,headers={'apikey':admin,'Authorization':'Bearer '+admin},timeout=15)
