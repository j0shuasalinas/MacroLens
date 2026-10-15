import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
for (const name of ['EXPO_PUBLIC_API_URL','EXPO_PUBLIC_SUPABASE_URL']) {
  const value = process.env[name];
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be an absolute HTTPS URL for a production export`); }
  if (url.protocol !== 'https:' || ['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error(`${name} must point to a deployed HTTPS service`);
  if (value.endsWith('/')) throw new Error(`${name} must not have a trailing slash`);
}
if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is required');
