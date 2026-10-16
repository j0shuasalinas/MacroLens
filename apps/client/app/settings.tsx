import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, supabase } from '../src/api';
import { Button, Card, Choices, Input, s } from '../src/ui';

const initialProfile = { name: '', age: 21, height_cm: 175, current_weight: 165, goal_weight: 175, activity: 1.55, objective: 'Lean bulk', weekly_change: .25, sex: 'male' };
const initialGoals = { calories: 2900, protein: 160, carbs: 385, fat: 80, goal_weight: 175, objective: 'Lean bulk' };

export default function Settings() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api('/profile') });
  const goals = useQuery({ queryKey: ['goals'], queryFn: () => api('/goals') });
  if (profile.isLoading || goals.isLoading) return <ScrollView style={s.page} contentContainerStyle={s.content}><Text style={s.subtitle}>Getting your profile ready…</Text></ScrollView>;
  if (profile.error || goals.error) return <ScrollView style={s.page} contentContainerStyle={s.content}><Text style={s.error}>{profile.error?.message || goals.error?.message}</Text><Button title="Try again" onPress={() => { profile.refetch(); goals.refetch(); }} /></ScrollView>;
  return <SettingsForm profileData={profile.data} goalsData={goals.data} />;
}
function SettingsForm({ profileData, goalsData }: { profileData: typeof initialProfile | null; goalsData: typeof initialGoals }) {
  const cache = useQueryClient();
  const [p, setP] = useState(() => profileData ? Object.fromEntries(Object.keys(initialProfile).map(k => [k, profileData[k as keyof typeof initialProfile]])) as typeof initialProfile : initialProfile);
  const [g, setG] = useState(() => Object.fromEntries(Object.keys(initialGoals).map(k => [k, goalsData[k as keyof typeof initialGoals]])) as typeof initialGoals);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [showMethod, setShowMethod] = useState(false);
  const labels: Record<string, string> = { name: 'What should we call you?', age: 'Age (years)', height_cm: 'Height (cm)', current_weight: 'Current weight (lb)', goal_weight: 'Goal weight (lb)' };
  function field(key: 'name' | 'age' | 'height_cm' | 'current_weight' | 'goal_weight') {
    return <Input key={key} label={labels[key]} value={String(p[key])} numeric={key !== 'name'} placeholder={key === 'name' ? 'Your first name' : undefined} onChangeText={v => setP({ ...p, [key]: key === 'name' ? v : Number(v) })} />;
  }
  async function save() {
    setBusy(true); setMessage('');
    try {
      await api('/profile', 'PUT', p);
      await api('/goals', 'PUT', { ...g, goal_weight: p.goal_weight, objective: p.objective });
      await cache.invalidateQueries();
      setMessage('You’re all set. Your profile and goals are saved.');
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  async function suggest() {
    setBusy(true); setMessage('');
    try {
      const result = await api('/onboarding/suggest', 'POST', p);
      setG(result);
      setMessage('Your suggested targets are ready below. Take a look, adjust anything, and save when you’re happy.');
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try { await api('/account', 'DELETE'); await supabase.auth.signOut(); }
    catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  return <ScrollView style={s.page} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { maxWidth: 740 }]}>
    <Text style={s.eyebrow}>MADE FOR YOU</Text><Text style={s.title}>Your pace. Your goals.</Text>
    <Text style={s.subtitle}>A few details help us find your starting point. Everything stays editable.</Text>
    <Card><Text style={s.label}>01  A little about you</Text>{field('name')}<View style={s.row}>{field('age')}{field('height_cm')}</View>
      <Choices label="Sex used for calorie calculation" value={p.sex} options={[{ label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }]} onChange={sex => setP({ ...p, sex })} />
      <Text style={s.subtitle}>This only selects the equation used for suggestions. You can set your own targets below.</Text>
    </Card>
    <Card><Text style={s.label}>02  Where you’re headed</Text><View style={s.row}>{field('current_weight')}{field('goal_weight')}</View>
      <Choices label="What would you like to focus on?" value={p.objective} options={[
        { label: 'Build muscle', value: 'Lean bulk' }, { label: 'Lose weight', value: 'Cutting' }, { label: 'Maintain', value: 'Maintenance' }, { label: 'Recomposition', value: 'Recomposition' },
      ]} onChange={objective => setP({ ...p, objective, weekly_change: objective === 'Lean bulk' ? .25 : objective === 'Cutting' ? -.5 : 0 })} />
      <Choices label="How active is your usual week?" value={p.activity} options={[
        { label: 'Mostly sitting', value: 1.2 }, { label: 'Lightly active', value: 1.375 }, { label: 'Moderately active', value: 1.55 }, { label: 'Very active', value: 1.725 },
      ]} onChange={activity => setP({ ...p, activity })} />
      <Input label="Preferred weight change (lb/week)" numeric value={String(p.weekly_change)} onChangeText={v => setP({ ...p, weekly_change: Number(v) })} />
      <Text style={s.subtitle}>Use a positive number to gain, a negative number to lose, or 0 to maintain.</Text>
      <Button quiet title="Suggest my daily targets →" disabled={busy} onPress={suggest} />
    </Card>
    <Card><Text style={s.label}>03  Your daily targets</Text><Text style={s.subtitle}>Keep your current targets or try the suggestions above. You decide what to save.</Text>
      <Input label="Daily calories (kcal)" numeric value={String(g.calories)} onChangeText={v => setG({ ...g, calories: Number(v) })} />
      <View style={s.row}>{(['protein', 'carbs', 'fat'] as const).map(key => <Input key={key} label={`${key[0].toUpperCase() + key.slice(1)} (g)`} numeric value={String(g[key])} onChangeText={v => setG({ ...g, [key]: Number(v) })} />)}</View>
      <Text style={s.subtitle}>These macros add up to {Math.round(g.protein * 4 + g.carbs * 4 + g.fat * 9).toLocaleString()} kcal.</Text>
      <Button title={busy ? 'Saving your changes…' : 'Save my goals'} disabled={busy} onPress={save} />
      <Button quiet title={showMethod ? 'Hide calculation details' : 'How are suggestions calculated?'} onPress={() => setShowMethod(!showMethod)} />
      {showMethod && <Text style={s.subtitle}>We use Mifflin–St Jeor resting energy × activity, plus 500 kcal/day per target lb/week, capped at a 500 kcal daily adjustment. Protein is 2 g/kg, fat is 25% of calories, and the rest is carbs. This is a starting estimate, not a measured energy requirement. Targets never change automatically.</Text>}
    </Card>
    {!!message && <Card><Text accessibilityRole="alert" style={s.subtitle}>{message}</Text></Card>}
    <Button quiet title="Sign out" disabled={busy} onPress={async () => { const { error } = await supabase.auth.signOut(); if (error) setMessage(error.message); }} />
    <Button quiet title={showDelete ? 'Keep my account' : 'Manage account deletion'} onPress={() => setShowDelete(!showDelete)} />
    {showDelete && <Card><Text style={s.label}>Delete your account?</Text><Text style={s.subtitle}>This permanently removes your profile, meals and weight entries. It can’t be undone.</Text><Input label="Type DELETE to confirm" value={confirmation} onChangeText={setConfirmation} /><Button quiet title="Permanently delete account" disabled={confirmation !== 'DELETE' || busy} onPress={remove} /></Card>}
  </ScrollView>;
}
