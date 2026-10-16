import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { supabase, configured } from '../src/api';
import { Button, Input, Card, s, colors } from '../src/ui';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signup, setSignup] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setMessage('');
    try {
      const credentials = { email: email.trim(), password };
      const { error, data } = signup ? await supabase.auth.signUp(credentials) : await supabase.auth.signInWithPassword(credentials);
      if (error) throw error;
      setPassword('');
      if (signup && !data.session) setMessage('You’re almost in! Check your email to confirm your account, then come back to sign in.');
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  return <ScrollView style={s.page} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { maxWidth: 500, paddingTop: 48 }]}>
    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 25, letterSpacing: -1 }}>◉ MacroLens</Text>
    <View style={{ backgroundColor: '#eaf0e5', borderRadius: 30, padding: 26, alignItems: 'center', gap: 18 }}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><Text style={{ fontSize: 52 }}>🥑</Text><Text style={{ fontSize: 68 }}>🍽</Text><Text style={{ fontSize: 48 }}>🥦</Text></View>
      <View style={{ backgroundColor: colors.card, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 13 }}><Text style={{ color: colors.green, fontWeight: '700', fontSize: 13 }}>A photo. A little clarity. A healthier habit.</Text></View>
    </View>
    <Text style={[s.title, { fontSize: 40 }]}>Eat well.{ '\n' }Keep it simple.</Text>
    <Text style={s.subtitle}>Spend less time logging and more time living. Snap your meals, check the estimates, and follow your progress.</Text>
    <Card><Text style={s.label}>{signup ? 'Let’s get you started' : 'Good to see you'}</Text>
      <Input label="Email address" placeholder="you@example.com" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Input label="Password" placeholder={signup ? 'At least 6 characters' : 'Your password'} value={password} onChangeText={setPassword} secure />
      <Button title={busy ? 'One moment…' : signup ? 'Create my account →' : 'Sign in →'} disabled={busy || !configured || password.length < 6 || !email.trim()} onPress={submit} />
      <Button quiet title={signup ? 'Already a member? Sign in' : 'Create an account & build my plan'} disabled={busy} onPress={() => { setSignup(!signup); setMessage(''); }} />
      {!!message && <Text accessibilityRole="alert" style={s.error}>{message}</Text>}
      {!configured && <Text style={s.error}>MacroLens isn’t connected yet. Complete the connection setup in the README to get started.</Text>}
    </Card>
    <Text style={[s.subtitle, { textAlign: 'center', fontSize: 12 }]}>Your meals, your decisions. Every photo estimate is yours to review.</Text>
  </ScrollView>;
}
