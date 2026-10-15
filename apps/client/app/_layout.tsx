import { Stack, router, usePathname } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View, Text, useWindowDimensions, ActivityIndicator, AppState, Pressable } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';
import { supabase, useDraft, blankFood, today } from '../src/api';
import { colors } from '../src/ui';
const queryClient = new QueryClient();
export default function Layout() {
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
  useEffect(() => { if (ready && !session && path !== '/auth') router.replace('/auth'); else if (ready && session && path === '/auth') router.replace('/'); }, [session, ready, path]);
  const nav = <View style={{ gap: width > 850 ? 12 : 4, width: width > 850 ? 200 : '100%', flexDirection: width > 850 ? 'column' : 'row', padding: width > 850 ? 20 : 10, backgroundColor: colors.card, justifyContent: 'flex-start' }}>{width > 850 && <Text style={{ color: colors.green, fontSize: 23, fontWeight: '800', marginBottom: 30 }}>◉ MacroLens</Text>}{([['Today','/'],['Scan','/scan'],['History','/history'],['Progress','/progress'],['Settings','/settings']] as const).map(([label, href]) => <Pressable accessibilityRole="button" accessibilityState={{selected:path===href}} key={href} onPress={() => router.push(href)} style={{flex:width>850?undefined:1,paddingVertical:14,borderRadius:12,alignItems:'center',backgroundColor:path===href?colors.green:'transparent'}}><Text style={{fontWeight:'700',fontSize:width>850?14:12,color:path===href?'#062019':colors.muted}}>{label}</Text></Pressable>)}</View>;
  return <QueryClientProvider client={queryClient}><SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><StatusBar style="light" />{!ready ? <ActivityIndicator color={colors.green} /> : <View style={{ flex: 1, flexDirection: width > 850 ? 'row' : 'column' }}>{session && width > 850 && nav}<View style={{ flex: 1 }}>{session || path === '/auth' ? <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} /> : null}</View>{session && width <= 850 && nav}</View>}</SafeAreaView></SafeAreaProvider></QueryClientProvider>;
}
