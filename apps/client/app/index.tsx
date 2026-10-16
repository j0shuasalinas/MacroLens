import { ScrollView, Text, View, Pressable, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { api, Meal, sum, today, useDraft } from '../src/api';
import { Button, Card, colors, ProgressRing, s } from '../src/ui';

export default function Dashboard() {
  const day = today();
  const { width } = useWindowDimensions();
  const meals = useQuery<Meal[]>({ queryKey: ['meals', day], queryFn: () => api('/meals?day=' + day) });
  const goals = useQuery({ queryKey: ['goals'], queryFn: () => api('/goals') });
  const weekly = useQuery<{ day: string; calories: number }[]>({ queryKey: ['weekly', day], queryFn: () => api('/summary/weekly?day=' + day) });
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api('/profile') });
  const calories = sum(meals.data || [], 'calories');
  const remaining = goals.data ? Math.max(0, Math.round(goals.data.calories - calories)) : null;
  const error = meals.error || goals.error || weekly.error || profile.error;
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <View style={[s.row, { justifyContent: 'space-between' }]}><View style={{ gap: 5 }}><Text style={s.eyebrow}>MACROLENS</Text><Text style={s.title}>{profile.data?.name ? `Hey, ${profile.data.name.split(' ')[0]}.` : 'Your day, in focus.'}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open your profile" onPress={() => router.push('/settings')} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#e4ecdf', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.green, fontSize: 18, fontWeight: '800' }}>{profile.data?.name?.[0]?.toUpperCase() || 'M'}</Text></Pressable></View>
    <Text style={[s.subtitle, { marginTop: -12 }]}>{dateLabel}</Text>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>{Array.from({ length: 7 }, (_, index) => {
      const d = new Date(); d.setDate(d.getDate() - 6 + index);
      const logged = (weekly.data?.[index]?.calories || 0) > 0;
      return <View key={index} style={{ flex: 1, alignItems: 'center', gap: 8, paddingVertical: 12, borderRadius: 18, backgroundColor: index === 6 ? colors.primary : 'transparent' }}>
        <Text style={{ fontSize: 11, color: index === 6 ? '#d6e2d8' : colors.muted }}>{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: index === 6 ? '#ffffff' : colors.text }}>{d.getDate()}</Text>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: logged ? (index === 6 ? '#b0e2c4' : colors.green) : 'transparent' }} />
      </View>;
    })}</View>
    {!!error && <Card><Text style={s.error}>{error.message}</Text><Button quiet title="Try again" onPress={() => { meals.refetch(); goals.refetch(); weekly.refetch(); profile.refetch(); }} /></Card>}
    <Card><View style={[s.row, { justifyContent: 'space-between', flexWrap: 'nowrap', gap: 8 }]}>
      <View style={{ flex: 1, gap: 4 }}><Text style={s.subtitle}>{calories > (goals.data?.calories || Infinity) ? 'Daily goal reached' : 'Calories left today'}</Text>
        <Text style={{ color: colors.text, fontSize: width < 360 ? 36 : width < 400 ? 44 : 60, fontWeight: '800', letterSpacing: -2 }}>{meals.isLoading ? '…' : remaining?.toLocaleString() ?? '—'}</Text>
        <Text style={s.subtitle}>{Math.round(calories).toLocaleString()} eaten · {goals.data?.calories?.toLocaleString() ?? '—'} goal</Text></View>
      <ProgressRing value={goals.data ? calories / goals.data.calories : 0} size={width < 360 ? 96 : width < 400 ? 112 : 138} />
    </View></Card>
    <View style={{ flexDirection: 'row', gap: 10 }}>{(['protein', 'carbs', 'fat'] as const).map(key => {
      const consumed = Math.round(sum(meals.data || [], key));
      return <View key={key} style={{ flex: 1, minWidth: 0, backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: width < 400 ? 12 : 18, gap: 10 }}>
        <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: key === 'protein' ? '#f9e9e5' : key === 'carbs' ? '#e7eff9' : '#f8f0d9', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors[key], fontWeight: '800', fontSize: 12 }}>{key === 'protein' ? 'P' : key === 'carbs' ? 'C' : 'F'}</Text></View>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>{consumed}<Text style={{ fontSize: 12, fontWeight: '500', color: colors.muted }}> g</Text></Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{key[0].toUpperCase() + key.slice(1)}</Text>
        <View style={{ height: 5, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' }}><View style={{ height: 5, backgroundColor: colors[key], borderRadius: 4, width: `${Math.min(100, consumed / (goals.data?.[key] || 1) * 100)}%` }} /></View>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{goals.data?.[key] ?? '—'} g goal</Text>
      </View>;
    })}</View>
    <Button title="＋  Scan your meal" onPress={() => router.push('/scan')} />
    {profile.isSuccess && !profile.data && <View style={{ backgroundColor: colors.soft, borderRadius: 20, padding: 18, gap: 10 }}><Text style={s.label}>A little more you.</Text><Text style={s.subtitle}>Personalize your goals in a minute. You can change them any time.</Text><Button quiet title="Set up my goals →" onPress={() => router.push('/settings')} /></View>}
    <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.label}>Today’s meals</Text><Pressable accessibilityRole="button" onPress={() => router.push('/history')} style={{ padding: 12 }}><Text style={{ color: colors.green, fontSize: 13, fontWeight: '700' }}>View journal →</Text></Pressable></View>
    {meals.data?.length ? meals.data.map(meal => <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${meal.title}`} key={meal.id} onPress={() => { useDraft.getState().setMeal(meal); router.push('/review'); }}>
      <Card><View style={[s.row, { flexWrap: 'nowrap' }]}><View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 24 }}>🍽</Text></View><View style={{ flex: 1, gap: 4 }}><Text style={s.label}>{meal.title}</Text><Text numberOfLines={1} style={s.subtitle}>{meal.items.map(i => i.name).join(', ')}</Text></View><Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{Math.round(sum([meal], 'calories'))}<Text style={{ color: colors.muted, fontSize: 11 }}> kcal</Text></Text></View></Card>
    </Pressable>) : !meals.isLoading && !meals.error ? <Card><View style={{ alignItems: 'center', paddingVertical: 15, gap: 12 }}><Text style={{ fontSize: 34 }}>🍽</Text><Text style={s.label}>What’s on your plate?</Text><Text style={[s.subtitle, { textAlign: 'center', maxWidth: 310 }]}>Snap your first meal and we’ll help with the numbers. You review everything before saving.</Text><Button quiet title="Enter a meal instead" onPress={() => router.push('/review')} /></View></Card> : null}
    <Card><Text style={s.label}>Your next small win</Text><Text style={s.subtitle}>Want more protein, easier meals, or a little direction? Ask your coach.</Text><View style={s.row}><Button title="Ask my coach →" onPress={() => router.push('/coach')} /><Button quiet title="View weight progress" onPress={() => router.push('/progress')} /></View></Card>
    <Text style={[s.subtitle, { textAlign: 'center', fontSize: 12 }]}>Small steps, every day. {weekly.data?.filter(d => d.calories > 0).length ?? 0} of the last 7 days logged.</Text>
  </ScrollView>;
}
