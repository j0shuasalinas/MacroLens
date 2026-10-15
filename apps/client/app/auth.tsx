import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { supabase, configured } from '../src/api';
import { Button, Input, Card, s, colors } from '../src/ui';
export default function Auth() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [signup, setSignup] = useState(false); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function submit() { setBusy(true); setMessage(''); try {
    const { error, data } = signup ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (signup && !data.session) setMessage('Check your email to confirm your account, then sign in.');
  } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); } }
  return <ScrollView style={s.page} contentContainerStyle={[s.content, { maxWidth: 560, paddingTop: 70 }]}><Text style={{ color: colors.green, fontWeight: '800', fontSize: 22 }}>◉ MACROLENS</Text><Text style={[s.title, { fontSize: 48 }]}>Fuel your{ '\n' }next chapter.</Text><Text style={s.subtitle}>A clearer picture of your nutrition. Photograph meals, refine your estimates, and track the progress that matters.</Text><Card><Text style={s.label}>{signup ? 'Create your account' : 'Welcome back'}</Text><Input label="Email" value={email} onChangeText={setEmail} /><Input label="Password (6+ characters)" value={password} onChangeText={setPassword} secure /><Button title={busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'} disabled={busy || !configured || password.length < 6 || !email} onPress={submit} /><Button quiet title={signup ? 'Already have an account? Sign in' : 'New here? Create an account'} onPress={() => setSignup(!signup)} />{!!message && <Text accessibilityRole="alert" style={s.error}>{message}</Text>}{!configured && <Text style={s.error}>Connect Supabase in apps/client/.env to enable authentication. See README for setup.</Text>}</Card><View><Text style={s.subtitle}>Photo nutrition is an estimate. You stay in control of every saved result.</Text></View></ScrollView>;
}
