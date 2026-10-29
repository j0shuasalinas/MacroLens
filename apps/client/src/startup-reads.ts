import type { SupabaseClient } from '@supabase/supabase-js';
import type { Meal } from './api';

// These reads use the user's JWT and existing database RLS, never a service key.
// Keeping initial reads off the Python host avoids its idle cold start on both platforms.
const profileFields = 'name,age,height_cm,activity,current_weight,goal_weight,objective,weekly_change,sex,onboarded_at';
export function createStartupReads(client: SupabaseClient) {
  async function owner() {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) throw new Error('Please sign in to load your nutrition.');
    return data.session.user.id;
  }
  function checked<T>(result: { data: T; error: unknown }): T {
    if (result.error) throw new Error('Your nutrition could not be loaded. Please check your connection and try again.');
    return result.data;
  }
  async function profile() {
    const uid = await owner();
    return checked(await client.from('profiles').select(profileFields).eq('user_id', uid).maybeSingle());
  }
  return {
    profile,
    async onboarding() {
      const saved = await profile();
      return { completed: Boolean(saved?.onboarded_at), profile: saved };
    },
    async goals() {
      const uid = await owner();
      return checked(await client.from('nutrition_goals')
        .select('calories,protein,carbs,fat,goal_weight,objective').eq('user_id', uid).maybeSingle());
    },
    async meals(day: string): Promise<Meal[]> {
      const uid = await owner();
      return checked(await client.from('meals').select('id,title,day,category,items')
        .eq('user_id', uid).eq('day', day).order('created_at', { ascending: false }).limit(500)) as Meal[];
    },
    async weekly(day: string): Promise<{ day: string; calories: number }[]> {
      await owner();
      const end = new Date(day + 'T00:00:00Z');
      const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(end); date.setUTCDate(date.getUTCDate() - 6 + index);
        return date.toISOString().slice(0, 10);
      });
      const months = [...new Set(days.map(value => value.slice(0, 7) + '-01'))];
      // This existing SECURITY INVOKER RPC aggregates all records under auth.uid().
      const rows = (await Promise.all(months.map(async month => checked(await client.rpc('nutrition_calendar', { month_start: month }))))).flat();
      return days.map(date => ({ day: date, calories: Number(rows.find(row => row.day === date)?.calories ?? 0) }));
    },
  };
}
