// Opt-in: supply a disposable two-account fixture; never imported by the app.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createStartupReads } from '../src/startup-reads.ts';
const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const clients = fixture.users.map(() => createClient(fixture.url, fixture.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }));
for (let i=0;i<clients.length;i++) {
  const {error}=await clients[i].auth.setSession({ access_token: fixture.users[i].access_token, refresh_token: fixture.users[i].refresh_token });
  assert.ifError(error);
  const start=performance.now();
  const reads=createStartupReads(clients[i]);
  const [onboarding,goals,meals,weekly]=await Promise.all([reads.onboarding(),reads.goals(),reads.meals('2026-10-28'),reads.weekly('2026-10-28')]);
  assert.equal(onboarding.profile.name,i===0?'Startup A':'Startup B');
  assert.equal(onboarding.completed,true); assert.equal(goals.calories,2200);
  assert.equal(meals.length,1);assert.equal(meals[0].items[0].calories,i===0?321:654);
  assert.equal(weekly.at(-1).calories,i===0?321:654);
  const other=await clients[i].from('profiles').select('name').eq('user_id',fixture.users[1-i].uid);
  assert.ifError(other.error);assert.deepEqual(other.data,[]);
  console.log(`User ${i+1}: startup reads and cross-user RLS passed in ${Math.round(performance.now()-start)}ms; no Python API used`);
}
const anon=createClient(fixture.url,fixture.key,{auth:{persistSession:false}});
await assert.rejects(()=>createStartupReads(anon).onboarding(),/sign in/);
console.log('Signed-out startup blocked');
