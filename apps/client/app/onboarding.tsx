import { useState } from 'react';
import { ScrollView, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, supabase } from '../src/api';
import { Button, Card, Choices, Input, colors, s } from '../src/ui';

type Targets = { calories: number; protein: number; carbs: number; fat: number; goal_weight: number; objective: string };
const titles = ['First, a little about you.', 'Find your starting point.', 'What are you working toward?', 'Your plan, your call.'];
export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [fields, setFields] = useState({ name: '', age: '', height: '', weight: '', goal: '' });
  const [sex, setSex] = useState('');
  const [objective, setObjective] = useState('Lean bulk');
  const [activity, setActivity] = useState(1.55);
  const [rate, setRate] = useState(.25);
  const [heightUnit, setHeightUnit] = useState('cm');
  const [weightUnit, setWeightUnit] = useState('lb');
  const [targets, setTargets] = useState<Targets>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cache = useQueryClient();
  const weight = (v: string) => Number(v) * (weightUnit === 'kg' ? 2.2046226218 : 1);
  const profile = () => ({ name: fields.name.trim(), age: Number(fields.age), sex, height_cm: Number(fields.height) * (heightUnit === 'in' ? 2.54 : 1), current_weight: weight(fields.weight), goal_weight: weight(fields.goal), activity, objective, weekly_change: rate });
  const input = (key: keyof typeof fields, label: string, placeholder: string) => <Input label={label} placeholder={placeholder} numeric={key !== 'name'} value={fields[key]} onChangeText={v => setFields({ ...fields, [key]: v })} />;
  function validate() {
    if (step === 0 && (!fields.name.trim() || fields.name.length > 100 || !Number.isInteger(Number(fields.age)) || Number(fields.age) < 18 || Number(fields.age) > 120 || !sex)) return 'Enter your name, age (18–120), and choose an equation option.';
    const cm = Number(fields.height) * (heightUnit === 'in' ? 2.54 : 1);
    if (step === 1 && (!Number.isFinite(cm) || cm < 100 || cm > 300 || !Number.isFinite(weight(fields.weight)) || weight(fields.weight) < 40 || weight(fields.weight) > 1500)) return 'Please check your measurements and units: height 100–300 cm (39.4–118 in), weight 40–1,500 lb (18.2–680 kg).';
    if (step === 2 && (!Number.isFinite(weight(fields.goal)) || weight(fields.goal) < 40 || weight(fields.goal) > 1500)) return 'What goal weight would you like to work toward?';
    return '';
  }
  async function next() {
    const problem = validate(); if (problem) { setError(problem); return; }
    setError('');
    if (step < 2) { setStep(step + 1); return; }
    setBusy(true);
    try { const result = await api('/onboarding/suggest', 'POST', profile()); setTargets(result); setStep(3); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function finish() {
    if (!targets) return;
    setBusy(true); setError('');
    try {
      await api('/onboarding/complete', 'POST', { profile: profile(), goals: targets });
      cache.setQueriesData({ queryKey: ['onboarding'] }, { completed: true });
      await Promise.all([cache.invalidateQueries({ queryKey: ['profile'] }), cache.invalidateQueries({ queryKey: ['goals'] })]);
      router.replace('/');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { maxWidth: 620, paddingTop: 35 }]}>
    <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -1 }}>◉ MacroLens</Text>
    <View style={{ flexDirection: 'row', gap: 7 }}>{titles.map((_, i) => <View key={i} style={{ flex: 1, height: 5, borderRadius: 4, backgroundColor: i <= step ? colors.green : colors.border }} />)}</View>
    <Text accessibilityLiveRegion="polite" style={s.eyebrow}>STEP {step + 1} OF 4 · {step === 3 ? 'READY WHEN YOU ARE' : 'ABOUT A MINUTE'}</Text>
    <Text style={s.title}>{titles[step]}</Text>
    {step === 0 && <><Text style={s.subtitle}>Let’s make this personal. We’ll use your details to estimate a starting calorie target.</Text><Card>{input('name', 'What should we call you?', 'Your first name')}{input('age', 'Your age', '18 or older')}
      <Choices label="Equation option" value={sex} options={[{ label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }]} onChange={setSex} />
      <Text style={s.subtitle}>This selects the sex-specific calorie equation, not your identity. You can override all suggestions. MacroLens target calculations are for adults.</Text></Card></>}
    {step === 1 && <><Text style={s.subtitle}>No perfect numbers needed. These help us find a sensible starting point.</Text><Card>
      <Choices label="Height unit" value={heightUnit} options={[{ label: 'Centimeters', value: 'cm' }, { label: 'Inches', value: 'in' }]} onChange={unit => { if (unit !== heightUnit && fields.height) setFields({ ...fields, height: String(Math.round(Number(fields.height) * (unit === 'in' ? 1 / 2.54 : 2.54) * 10) / 10) }); setHeightUnit(unit); }} />
      {input('height', `Height (${heightUnit})`, heightUnit === 'cm' ? 'e.g. 175' : 'e.g. 69')}
      <Choices label="Weight unit" value={weightUnit} options={[{ label: 'Pounds', value: 'lb' }, { label: 'Kilograms', value: 'kg' }]} onChange={unit => { if (unit !== weightUnit) setFields({ ...fields, weight: fields.weight ? String(Math.round(Number(fields.weight) * (unit === 'kg' ? .45359237 : 2.2046226218) * 10) / 10) : '', goal: fields.goal ? String(Math.round(Number(fields.goal) * (unit === 'kg' ? .45359237 : 2.2046226218) * 10) / 10) : '' }); setWeightUnit(unit); }} />
      {input('weight', `Current weight (${weightUnit})`, weightUnit === 'lb' ? 'e.g. 165' : 'e.g. 75')}
    </Card></>}
    {step === 2 && <><Text style={s.subtitle}>Choose a direction. Your targets will stay editable as life changes.</Text><Card>
      <Choices label="I’d like to…" value={objective} options={[{ label: 'Build muscle', value: 'Lean bulk' }, { label: 'Lose weight', value: 'Cutting' }, { label: 'Maintain', value: 'Maintenance' }, { label: 'Recompose', value: 'Recomposition' }]} onChange={v => { setObjective(v); setRate(v === 'Lean bulk' ? .25 : v === 'Cutting' ? -.5 : 0); }} />
      {input('goal', `Goal weight (${weightUnit})`, 'Your current weight is fine for maintenance')}
      <Choices label="Your usual activity" value={activity} options={[{ label: 'Mostly sitting', value: 1.2 }, { label: 'Lightly active', value: 1.375 }, { label: 'Moderately active', value: 1.55 }, { label: 'Very active', value: 1.725 }]} onChange={setActivity} />
      <Choices label="Preferred pace (lb per week)" value={rate} options={objective === 'Cutting' ? [{ label: '−0.25 · gradual', value: -.25 }, { label: '−0.5 · steady', value: -.5 }, { label: '−1 · faster', value: -1 }] : objective === 'Lean bulk' ? [{ label: '+0.25 · gradual', value: .25 }, { label: '+0.5 · steady', value: .5 }] : [{ label: 'Maintain weight', value: 0 }]} onChange={setRate} />
    </Card></>}
    {step === 3 && targets && <><Text style={s.subtitle}>Here’s your suggested starting point, {fields.name.trim()}. Change any number before saving.</Text><Card>
      <Text style={s.label}>Your daily targets</Text><Input label="Calories (kcal)" numeric value={String(targets.calories)} onChangeText={v => setTargets({ ...targets, calories: Number(v) })} />
      <View style={s.row}>{(['protein', 'carbs', 'fat'] as const).map(key => <Input key={key} label={`${key[0].toUpperCase() + key.slice(1)} (g)`} numeric value={String(targets[key])} onChangeText={v => setTargets({ ...targets, [key]: Number(v) })} />)}</View>
      <Text style={s.subtitle}>Calculated from your height, weight, age, activity and preferred pace using Mifflin–St Jeor. These are estimates, not measured needs. Targets never change automatically.</Text>
    </Card><View style={{ backgroundColor: colors.soft, borderRadius: 20, padding: 18, gap: 8 }}><Text style={s.label}>Your coach is here for the next step.</Text><Text style={s.subtitle}>Ask for meal ideas, more protein, or a small habit to work on. Sharing your logged nutrition with the coach is optional.</Text></View></>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <Button title={busy ? (step === 3 ? 'Saving your plan…' : 'Finding your starting point…') : step === 3 ? 'Save my plan & get started →' : step === 2 ? 'Calculate my targets →' : 'Continue →'} disabled={busy} onPress={step === 3 ? finish : next} />
    {step === 0 && <Button quiet title="Use a different account" disabled={busy} onPress={async () => { const {error} = await supabase.auth.signOut(); if(error)setError(error.message); }} />}
    {step > 0 && <Button quiet title="← Back" disabled={busy} onPress={() => { setError(''); setStep(step - 1); }} />}
  </ScrollView></KeyboardAvoidingView>;
}
