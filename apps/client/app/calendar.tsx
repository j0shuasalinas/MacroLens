import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, blankFood, Meal, sum, today, useDraft } from '../src/api';
import { Button, Card, colors, s } from '../src/ui';

type Day = { day: string; calories: number; protein: number; carbs: number; fat: number; meal_count: number };
const keyFor = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
export default function Calendar() {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const detailY = useRef(0);
  const currentDay = today();
  const [selected, setSelected] = useState(currentDay);
  const [month, setMonth] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }));
  const { width } = useWindowDimensions();
  const calendar = useQuery<Day[]>({ queryKey: ['calendar', month.year, month.month], queryFn: () => api(`/calendar?year=${month.year}&month=${month.month}`) });
  const meals = useQuery<Meal[]>({ queryKey: ['meals', selected], queryFn: () => api('/meals?day=' + selected) });
  const lookup = useMemo(() => new Map(calendar.data?.map(day => [day.day, day])), [calendar.data]);
  const firstWeekday = new Date(month.year, month.month - 1, 1, 12).getDay();
  const count = new Date(month.year, month.month, 0, 12).getDate();
  const cells = Math.ceil((firstWeekday + count) / 7) * 7;
  const chosen = calendar.isError ? undefined : lookup.get(selected);
  const loggedDays = calendar.data?.filter(day => day.meal_count > 0) || [];
  const mealCount = loggedDays.reduce((total, day) => total + day.meal_count, 0);
  const average = loggedDays.length ? Math.round(loggedDays.reduce((total, day) => total + day.calories, 0) / loggedDays.length) : null;
  const monthLabel = new Date(month.year, month.month - 1, 1, 12).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const selectedLabel = new Date(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)) - 1, Number(selected.slice(8)), 12).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  function changeMonth(delta: number) {
    const date = new Date(month.year, month.month - 1 + delta, 1, 12);
    const next = { year: date.getFullYear(), month: date.getMonth() + 1 };
    setMonth(next); setSelected(keyFor(next.year, next.month, 1));
  }
  function jumpToday() {
    const date = new Date(); setMonth({ year: date.getFullYear(), month: date.getMonth() + 1 }); setSelected(today());
  }
  function logMeal() { useDraft.getState().setMeal({ title: '', day: selected, category: 'lunch', items: [blankFood()] }); router.push('/review'); }
  return <ScrollView ref={scroll} style={s.page} contentContainerStyle={[s.content, { maxWidth: 880 }]}>
    <Text style={s.eyebrow}>ONE DAY AT A TIME</Text><Text style={s.title}>Your nutrition calendar.</Text><Text style={s.subtitle}>A little perspective on your month. Tap a date to see what you logged.</Text>
    <View style={[s.row, { justifyContent: 'space-between' }]}><Button quiet title="Today" onPress={jumpToday} /><Button quiet title="Search meals →" onPress={() => router.push('/history')} /></View>
    <Card><View style={[s.row, { justifyContent: 'space-between', flexWrap: 'nowrap' }]}><Pressable accessibilityRole="button" accessibilityLabel="Previous month" disabled={month.year <= 1900 && month.month === 1} onPress={() => changeMonth(-1)} style={{ padding: 12 }}><Text style={{ fontSize: 25, color: colors.text }}>‹</Text></Pressable><Text accessibilityLiveRegion="polite" style={s.label}>{monthLabel}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={month.year >= 9998 && month.month === 12} onPress={() => changeMonth(1)} style={{ padding: 12 }}><Text style={{ fontSize: 25, color: colors.text }}>›</Text></Pressable></View>
      <View style={{ flexDirection: 'row' }}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <Text key={day} style={{ width: `${100 / 7}%`, textAlign: 'center', color: colors.muted, fontSize: 11, fontWeight: '600', paddingBottom: 8 }}>{day}</Text>)}</View>
      {calendar.isLoading && <Text accessibilityLiveRegion="polite" style={s.subtitle}>Loading your month…</Text>}
      {calendar.error && <View style={{ gap: 10 }}><Text style={s.error}>{calendar.error.message}</Text><Button quiet title="Reload month" onPress={() => calendar.refetch()} /></View>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{Array.from({ length: cells }, (_, index) => {
        const number = index - firstWeekday + 1;
        if (number < 1 || number > count) return <View key={index} style={{ width: `${100 / 7}%`, height: 76 }} />;
        const date = keyFor(month.year, month.month, number);
        const data = lookup.get(date); const active = date === selected; const logged = !!data?.meal_count;
        return <View key={date} style={{ width: `${100 / 7}%`, padding: 2 }}><Pressable accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`${date}${date === currentDay ? ', today' : ''}, ${calendar.isLoading ? 'loading' : calendar.error ? 'totals unavailable' : logged ? `${Math.round(data!.calories)} calories, ${data!.meal_count} ${data!.meal_count === 1 ? 'meal' : 'meals'}` : 'no meals logged'}`} onPress={() => { setSelected(date); if(width < 650 && detailY.current) scroll.current?.scrollTo({y:Math.max(0,detailY.current-16),animated:true}); }} style={{ minHeight: 72, paddingVertical: 10, borderRadius: 14, alignItems: 'center', gap: 5, backgroundColor: active ? colors.primary : logged ? colors.soft : 'transparent', borderWidth: 1, borderColor: date === currentDay ? colors.green : 'transparent' }}>
          <Text style={{ color: active ? '#ffffff' : colors.text, fontWeight: '700', fontSize: 15 }}>{number}</Text><Text numberOfLines={1} style={{ color: active ? '#d0e6d8' : colors.green, fontSize: width < 400 ? 9 : 11 }}>{calendar.isLoading || calendar.error ? '—' : logged ? Math.round(data!.calories).toLocaleString() : '—'}</Text><View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: logged ? (active ? '#b4dfc4' : colors.green) : 'transparent' }} />
        </Pressable></View>;
      })}</View>
      {calendar.isSuccess && <View style={[s.row, { justifyContent: 'space-between', borderTopWidth: 1, borderColor: colors.border, paddingTop: 16 }]}>{[[String(loggedDays.length), 'days logged'], [String(mealCount), 'meals saved'], [average === null ? '—' : average.toLocaleString(), 'avg kcal / logged day']].map(([value, label]) => <View key={label} style={{ gap: 4 }}><Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{value}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>{label}</Text></View>)}</View>}
      <Text style={[s.subtitle, { fontSize: 12 }]}>Numbers are logged calories (kcal). A dot marks saved meals; an outlined date is today. A dash means no meals logged, not that you didn’t eat.</Text>
    </Card>
    <View onLayout={event => { detailY.current=event.nativeEvent.layout.y; }} style={{ gap: 6 }}><Text accessibilityLiveRegion="polite" style={s.label}>{selectedLabel}{selected === currentDay ? ' · Today' : ''}</Text><Text style={s.subtitle}>{chosen ? `${chosen.meal_count} ${chosen.meal_count === 1 ? 'meal' : 'meals'} saved` : 'Choose a date to explore your meals'}</Text></View>
    {width < 650 && <Button quiet title="↑ Back to month" onPress={()=>scroll.current?.scrollTo({y:0,animated:true})} />}
    {chosen && <Card><Text style={{ color: colors.text, fontSize: 36, fontWeight: '800', letterSpacing: -1 }}>{Math.round(chosen.calories).toLocaleString()} <Text style={s.subtitle}>kcal logged</Text></Text><View style={[s.row, { justifyContent: 'space-between' }]}>{(['protein', 'carbs', 'fat'] as const).map(key => <View key={key} style={{ gap: 4 }}><Text style={{ color: colors[key], fontSize: 20, fontWeight: '700' }}>{Math.round(chosen[key])} g</Text><Text style={s.subtitle}>{key[0].toUpperCase() + key.slice(1)}</Text></View>)}</View></Card>}
    <Button title="＋ Log a meal for this day" onPress={logMeal} />
    {meals.isLoading && <Text style={s.subtitle}>Getting this day’s meals…</Text>}{meals.error && <Card><Text style={s.error}>{meals.error.message}</Text><Button quiet title="Reload meals" onPress={() => meals.refetch()} /></Card>}
    {meals.data?.map(meal => <Card key={meal.id}><View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.label}>{meal.title}</Text><Text style={{ color: colors.green, fontWeight: '700' }}>{Math.round(sum([meal], 'calories'))} kcal</Text></View><Text style={s.subtitle}>{meal.category[0].toUpperCase() + meal.category.slice(1)} · {meal.items.map(item => item.name).join(', ')}</Text><Button quiet title="View or edit meal →" onPress={() => { useDraft.getState().setMeal(meal); router.push('/review'); }} /></Card>)}
    {meals.isSuccess && meals.data.length === 0 && <Card><Text style={s.label}>A fresh page.</Text><Text style={s.subtitle}>No meals saved for this day. You can add one above whenever you’re ready.</Text></Card>}
    {!!chosen && chosen.meal_count > 500 && <Text style={s.subtitle}>Showing the latest 500 meals for this day. The summary includes every saved meal.</Text>}
  </ScrollView>;
}
