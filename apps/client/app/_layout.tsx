import { Stack, router, usePathname } from 'expo-router';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View, Text, useWindowDimensions, ActivityIndicator, AppState, Pressable } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import { supabase, useDraft, blankFood, today, api } from '../src/api';
import { Button, colors, s } from '../src/ui';
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false } } });
function AuthenticatedLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const path = usePathname();
  const { width } = useWindowDimensions();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, value) => { setSession(value); if (_event === 'SIGNED_OUT') { queryClient.clear(); useDraft.getState().setMeal({title:'',day:today(),category:'lunch',items:[blankFood()]}); } });
    const state = AppState.addEventListener('change', value => value === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh());
    return () => { data.subscription.unsubscribe(); state.remove(); };
  }, []);
  const onboarding = useQuery<{completed:boolean}>({queryKey:['onboarding',session?.user.id],queryFn:()=>api('/onboarding'),enabled:ready && !!session,staleTime:5*60*1000,retry:1});
  useEffect(() => {
    if (!ready) return;
    if (!session) { if (path !== '/auth') router.replace('/auth'); return; }
    if (onboarding.isSuccess) {
      if (!onboarding.data.completed && path !== '/onboarding') router.replace('/onboarding');
      else if (onboarding.data.completed && (path === '/auth' || path === '/onboarding')) router.replace('/');
    }
  }, [session,ready,path,onboarding.isSuccess,onboarding.data]);
  const completed = !!session && onboarding.data?.completed === true;
  const canRender = !session ? path === '/auth' : onboarding.isSuccess && (completed ? path !== '/auth' && path !== '/onboarding' : path === '/onboarding');
  const desktop = width > 850;
  const nav = <View style={{ gap: desktop ? 8 : 0, width: desktop ? 218 : '100%', flexDirection: desktop ? 'column' : 'row', padding: desktop ? 22 : 8, backgroundColor: colors.card, borderRightWidth: desktop ? 1 : 0, borderTopWidth: desktop ? 0 : 1, borderColor: colors.border }}>
    {desktop && <View style={{ gap: 6, marginBottom: 36, marginTop: 12 }}><Text style={{ color: colors.text, fontSize: 25, fontWeight: '800', letterSpacing: -1 }}>◉ MacroLens</Text><Text style={{ color: colors.muted, fontSize: 12 }}>A little clarity, every day.</Text></View>}
    {([['Home','⌂','/'],['Calendar','▦','/calendar'],['Scan','＋','/scan'],['Coach','✧','/coach'],['Profile','⚙','/settings']] as const).map(([label, icon, href]) => {
      const selected = path === href || (href === '/scan' && path === '/review') || (href === '/calendar' && path === '/history');
      const scan = href === '/scan';
      return <Pressable accessibilityRole="button" accessibilityLabel={scan ? 'Scan a meal' : label} accessibilityState={{ selected }} key={href} onPress={() => router.push(href)}
        style={{ flex: desktop ? undefined : 1, minHeight: 56, paddingVertical: desktop ? 13 : 3, paddingHorizontal: desktop ? 12 : 0, borderRadius: 16, gap: desktop ? 13 : 3, flexDirection: desktop ? 'row' : 'column', alignItems: 'center', justifyContent: desktop ? 'flex-start' : 'center', backgroundColor: desktop && selected ? colors.soft : 'transparent' }}>
        <View style={{ width: scan && !desktop ? 40 : 28, height: scan && !desktop ? 40 : 28, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: scan && !desktop ? colors.primary : 'transparent' }}><Text style={{ fontSize: scan ? 25 : 22, lineHeight: 28, color: scan && !desktop ? '#ffffff' : selected ? colors.green : colors.muted }}>{icon}</Text></View>
        <Text style={{ fontWeight: selected ? '800' : '500', fontSize: desktop ? 14 : 10, color: selected ? colors.text : colors.muted }}>{label}</Text>
      </Pressable>;
    })}
  </View>;
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><StatusBar style="dark" />{!ready || (session && onboarding.isPending) ? <ActivityIndicator color={colors.green} /> : <View style={{ flex: 1, flexDirection: width > 850 ? 'row' : 'column' }}>{completed && width > 850 && nav}<View style={{ flex: 1 }}>{onboarding.error && session ? <View style={[s.content,{gap:16}]}><Text style={s.label}>Let’s get you back on track.</Text><Text style={s.error}>{onboarding.error.message}</Text><Button title="Try again" onPress={()=>onboarding.refetch()}/><Button quiet title="Sign out" onPress={()=>supabase.auth.signOut()}/></View> : canRender ? <Stack key={session?.user.id || 'guest'} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} /> : null}</View>{completed && width <= 850 && nav}</View>}</SafeAreaView></SafeAreaProvider>;
}

export default function Layout() { return <QueryClientProvider client={queryClient}><AuthenticatedLayout /></QueryClientProvider>; }
