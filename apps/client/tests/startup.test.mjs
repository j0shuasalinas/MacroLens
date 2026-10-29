import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStartupReads } from '../src/startup-reads.ts';
import { createAccountQueryClient } from '../src/query-cache.ts';

function fixture({ session = true, failure = false, profile = { name: 'A', onboarded_at: '2026-10-28' } } = {}) {
  const calls = [];
  const client = {
    auth: { getSession: async () => ({ data: { session: session ? { user: { id: 'owner-a' } } : null }, error: null }) },
    from(table) {
      const call = { table, filters: [] }; calls.push(call);
      const result = { data: table === 'profiles' ? profile : table === 'nutrition_goals' ? { calories: 2200 } : [{ id: 'own-meal' }], error: failure ? { message: 'private details' } : null };
      const query = {
        select(fields) { call.fields = fields; return query; },
        eq(key, value) { call.filters.push([key, value]); return query; },
        order() { return query; }, limit(value) { call.limit = value; return query; },
        maybeSingle() { return Promise.resolve(result); },
        then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
      };
      return query;
    },
    async rpc(name, args) {
      calls.push({ rpc: name, args });
      return { data: [{ day: args.month_start === '2026-10-01' ? '2026-10-31' : '2026-11-01', calories: args.month_start === '2026-10-01' ? '150' : '250' }], error: failure ? {} : null };
    },
  };
  return { reads: createStartupReads(client), calls };
}

test('startup reads remain scoped to the signed-in user and reuse profile completion', async () => {
  const { reads, calls } = fixture();
  assert.equal((await reads.onboarding()).completed, true);
  assert.equal((await reads.profile()).name, 'A');
  assert.equal((await reads.goals()).calories, 2200);
  assert.equal((await reads.meals('2026-10-28'))[0].id, 'own-meal');
  for (const call of calls) assert.deepEqual(call.filters[0], ['user_id', 'owner-a']);
  assert.deepEqual(calls.at(-1).filters[1], ['day', '2026-10-28']);
  assert.equal(calls.at(-1).limit, 500);
  assert.equal((await fixture({ profile: null }).reads.onboarding()).completed, false);
});

test('signed-out startup makes no database call', async () => {
  const { reads, calls } = fixture({ session: false });
  for (const read of [() => reads.onboarding(), () => reads.profile(), () => reads.goals(), () => reads.meals('2026-10-28'), () => reads.weekly('2026-11-02')]) {
    await assert.rejects(read, /sign in/);
  }
  assert.equal(calls.length, 0);
});

test('errors fail closed instead of treating missing access as completed onboarding', async () => {
  const { reads } = fixture({ failure: true });
  for (const read of [() => reads.onboarding(), () => reads.goals(), () => reads.meals('2026-10-28'), () => reads.weekly('2026-11-02')]) {
    await assert.rejects(read, error => error.message.includes('could not be loaded') && !error.message.includes('private details'));
  }
});

test('weekly startup uses the invoker calendar RPC across month and DST boundaries', async () => {
  const { reads, calls } = fixture();
  const days = await reads.weekly('2026-11-02');
  assert.equal(days.length, 7);
  assert.equal(days[0].day, '2026-10-27');
  assert.equal(days.at(-1).day, '2026-11-02');
  assert.equal(days.find(day => day.day === '2026-10-31').calories, 150);
  assert.equal(days.find(day => day.day === '2026-11-01').calories, 250);
  assert.deepEqual(calls, [
    { rpc: 'nutrition_calendar', args: { month_start: '2026-10-01' } },
    { rpc: 'nutrition_calendar', args: { month_start: '2026-11-01' } },
  ]);
});

test('account caches cannot expose a previous identity and clear without disk persistence', () => {
  const a = createAccountQueryClient(); const b = createAccountQueryClient();
  a.setQueryData(['profile'], { name: 'A' });
  assert.equal(b.getQueryData(['profile']), undefined);
  b.setQueryData(['profile'], { name: 'B' });
  a.clear();
  assert.equal(a.getQueryData(['profile']), undefined);
  assert.deepEqual(b.getQueryData(['profile']), { name: 'B' });
  b.clear();
});
