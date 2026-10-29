import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createStartupReads } from './startup-reads';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
export const supabase = createClient(url || 'https://unconfigured.supabase.co', key || 'unconfigured', {
  auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: Platform.OS === 'web' },
});
export const startupReads = createStartupReads(supabase);
export const apiUrl = process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://localhost:8010' : '');
if (!__DEV__ && !apiUrl.startsWith('https://')) throw new Error('Production EXPO_PUBLIC_API_URL must use HTTPS');
export class ApiError extends Error {
  constructor(message: string, public status: number, public retryAfterSeconds = 0) { super(message); }
}
export async function api(path: string, method = 'GET', body?: unknown) {
  const { data } = await supabase.auth.getSession();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 65000);
  try {
    const response = await fetch(apiUrl + path, {
      method, signal: controller.signal,
      headers: { Authorization: `Bearer ${data.session?.access_token || ''}`, ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) {
      const guidance = response.headers.get('Retry-After');
      const seconds = guidance ? Number(guidance) : 0;
      const retryAfter = Number.isFinite(seconds) ? Math.max(0, seconds) : Math.max(0, (Date.parse(guidance || '') - Date.now()) / 1000) || 0;
      throw new ApiError(typeof result.detail === 'string' ? result.detail : 'Please check your input and retry.', response.status, Math.ceil(retryAfter));
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The request timed out. Retrying has stopped. Please try again later.');
    throw error;
  } finally { clearTimeout(timer); }
}
export type Food = { name: string; grams: number; calories: number; protein: number; carbs: number; fat: number; confidence: 'low' | 'medium' | 'high'; uncertainty: string; source: string; fdc_id?: number | null };
export type Meal = { id?: string; title: string; day: string; category: 'breakfast' | 'lunch' | 'dinner' | 'snack'; items: Food[] };
export const blankFood = (): Food => ({ name: '', grams: 100, calories: 0, protein: 0, carbs: 0, fat: 0, confidence: 'low', uncertainty: 'Manually entered; confirm quantities.', source: 'Manual' });
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const useDraft = create<{ meal: Meal; setMeal: (meal: Meal) => void }>((set) => ({ meal: { title: '', day: today(), category: 'lunch', items: [blankFood()] }, setMeal: (meal) => set({ meal }) }));
export const sum = (meals: Meal[], field: 'calories' | 'protein' | 'carbs' | 'fat') => meals.reduce((s, m) => s + m.items.reduce((n, i) => n + i[field], 0), 0);
