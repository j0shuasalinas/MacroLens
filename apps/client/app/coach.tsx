import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api, today } from '../src/api';
import { Button, Card, colors, s } from '../src/ui';

type Message = { role: 'user' | 'assistant'; text: string };
const prompts = ['What’s one habit I can improve?', 'How can I get more protein?', 'Suggest a quick, affordable meal'];
export default function Coach() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [includeContext, setIncludeContext] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [failed, setFailed] = useState<{ text: string; history: Message[]; includeContext: boolean }>();
  const lock = useRef(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const mutation = useMutation({
    retry: false,
    mutationFn: (value: { text: string; history: Message[]; includeContext: boolean }) => api('/coach', 'POST', { message: value.text, history: value.history, include_context: value.includeContext, day: today() }),
    onSuccess: (result) => { setMessages(old => [...old, { role: 'assistant' as const, text: result.reply }].slice(-30)); setFailed(undefined); },
    onError: (_error, value) => setFailed(value),
    onSettled: () => { lock.current = false; },
  });
  function send(text: string) {
    text = text.trim(); if (!text || text.length > 1500 || lock.current || failed) return;
    lock.current = true;
    const history = messages.slice(-10).map(m => ({ ...m, text: m.text.slice(0, 2000) }));
    setMessages(old => [...old, { role: 'user' as const, text }].slice(-30)); setInput('');
    mutation.mutate({ text, history, includeContext });
  }
  function retry() { if (!failed || lock.current) return; lock.current = true; mutation.mutate(failed); }
  return <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={{ flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center' }}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { maxWidth: 800, paddingBottom: 18 }]} onContentSizeChange={() => { if(messages.length || mutation.isPending) scroll.current?.scrollToEnd({ animated: false }); }}>
        <View style={[s.row, { justifyContent: 'space-between' }]}><View style={{ gap: 6 }}><Text style={s.eyebrow}>A SMALL STEP FORWARD</Text><Text style={s.title}>Your nutrition coach.</Text></View>{messages.length > 0 && <Button quiet title="New chat" disabled={mutation.isPending} onPress={() => { setMessages([]); setFailed(undefined); mutation.reset(); }} />}</View>
        <Text style={s.subtitle}>Meal ideas, practical tweaks, and a little encouragement. Powered by Gemini. General guidance, not medical care.</Text>
        <Card><View style={[s.row, { flexWrap: 'nowrap', justifyContent: 'space-between' }]}><View style={{ flex: 1, gap: 4 }}><Text style={s.label}>Use my nutrition logs</Text><Text style={s.subtitle}>Optional: share saved targets and 7 days of nutrition totals with Google Gemini.</Text></View><Switch accessibilityLabel="Share my saved targets and recent nutrition totals with Gemini" disabled={mutation.isPending} value={includeContext} onValueChange={setIncludeContext} trackColor={{ true: '#a4d5b9', false: colors.border }} thumbColor={includeContext ? colors.green : '#ffffff'} /></View><Pressable accessibilityRole="button" accessibilityState={{expanded:showPrivacy}} onPress={()=>setShowPrivacy(!showPrivacy)} style={{minHeight:36,justifyContent:'center'}}><Text style={{fontSize:12,fontWeight:'700',color:colors.green}}>{showPrivacy?'Hide chat privacy details':'Chat privacy & history →'}</Text></Pressable>{showPrivacy && <Text style={[s.subtitle, { fontSize: 12 }]}>Your conversation stays in memory for this app session. Use New chat to clear it. Each message is sent to Google. Changing this switch won’t remove context already sent; start a new chat to begin fresh.</Text>}</Card>
        {messages.length === 0 && <View style={{ gap: 10 }}><Text style={s.label}>Where would you like to start?</Text>{prompts.map(text => <Button key={text} quiet title={text + ' →'} disabled={mutation.isPending} onPress={() => send(text)} />)}</View>}
        {messages.map((message, i) => <View key={i} style={{ alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '95%', backgroundColor: message.role === 'user' ? colors.primary : colors.card, borderWidth: 1, borderColor: message.role === 'user' ? colors.primary : colors.border, borderRadius: 22, borderBottomRightRadius: message.role === 'user' ? 6 : 22, borderBottomLeftRadius: message.role === 'assistant' ? 6 : 22, padding: 18, gap: 7 }}><Text style={{ fontSize: 11, fontWeight: '800', color: message.role === 'user' ? '#c9dfd0' : colors.green }}>{message.role === 'user' ? 'YOU' : 'MACROLENS COACH'}</Text><Text selectable style={{ fontSize: 15, lineHeight: 24, color: message.role === 'user' ? '#ffffff' : colors.text }}>{message.text}</Text></View>)}
        {mutation.isPending && <View accessibilityLiveRegion="polite" style={s.row}><ActivityIndicator color={colors.green} /><Text style={s.subtitle}>Coach is thinking… You can keep browsing while it responds.</Text></View>}
        {mutation.error && <Card><Text accessibilityRole="alert" style={s.error}>{mutation.error.message}</Text><View style={s.row}><Button title="Try again" disabled={mutation.isPending} onPress={retry} /><Button quiet title="Ask something else" disabled={mutation.isPending} onPress={() => { setInput(failed?.text || ''); setFailed(undefined); mutation.reset(); setMessages(old => old.slice(0, -1)); }} /></View></Card>}
      </ScrollView>
      <View style={{ padding: 16, gap: 8, backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.border }}><TextInput accessibilityLabel="Message your nutrition coach" placeholder="Ask about meals, habits, or your goals…" placeholderTextColor="#8a958e" multiline maxLength={1500} value={input} onChangeText={setInput} style={[s.input, { maxHeight: 120, minHeight: 54 }]} /><View style={[s.row, { justifyContent: 'space-between' }]}><Text style={[s.subtitle, { fontSize: 11 }]}>AI can make mistakes. You stay in control.</Text><Button title="Send ↑" disabled={!input.trim() || mutation.isPending || !!failed} onPress={() => send(input)} /></View></View>
    </View>
  </KeyboardAvoidingView>;
}
