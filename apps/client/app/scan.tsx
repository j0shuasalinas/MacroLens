import { useState } from 'react';
import { Image, Platform, ScrollView, Text, View, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { router } from 'expo-router';
import { api, today, useDraft } from '../src/api';
import { Button, Card, s, colors } from '../src/ui';

export default function Scan() {
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function choose(camera: boolean) {
    setError('');
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Camera access is turned off. Allow it in your device settings, or choose a photo below.');
      const options: ImagePicker.ImagePickerOptions = { quality: .8, mediaTypes: ['images'] };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled) setPhoto(result.assets[0]);
    } catch (e) { setError((e as Error).message); }
  }
  async function analyze() {
    if (!photo) return;
    setBusy(true); setError('');
    try {
      // Normalize phone photos before sending: quality alone does not reduce dimensions.
      const scale = Math.min(1, 1600 / Math.max(photo.width, photo.height));
      let prepared: ImageManipulator.ImageResult;
      try {
        prepared = await ImageManipulator.manipulateAsync(photo.uri,
          scale < 1 ? [{ resize: { width: Math.max(1, Math.round(photo.width * scale)), height: Math.max(1, Math.round(photo.height * scale)) } }] : [],
          { compress: .85, format: ImageManipulator.SaveFormat.JPEG });
      } catch {
        throw new Error('We couldn’t open this photo. Try a JPEG, PNG or WebP, or take a new photo. For an HEIC/RAW file your browser cannot open, export it as JPEG first.');
      }
      const data = new FormData();
      if (Platform.OS === 'web') data.append('image', await (await fetch(prepared.uri)).blob(), 'meal.jpg');
      else data.append('image', { uri: prepared.uri, name: 'meal.jpg', type: 'image/jpeg' } as unknown as Blob);
      const result = await api('/analyze', 'POST', data);
      if (!result.items.length) throw new Error('We couldn’t spot any food. Try a brighter photo with the whole plate in view, or enter the meal yourself.');
      useDraft.getState().setMeal({ title: 'Photo meal', day: today(), category: 'lunch', items: result.items });
      router.push({ pathname: '/review', params: { warnings: result.warnings.join('\n') } });
    } catch (e) {
      const message = (e as Error).message;
      setError(message.includes('not configured') ? 'Photo scanning isn’t set up yet. You can still enter your meal manually.' : message);
    } finally { setBusy(false); }
  }
  return <ScrollView style={s.page} contentContainerStyle={[s.content, { maxWidth: 740 }]}>
    <Text style={s.eyebrow}>SNAP · REVIEW · SAVE</Text><Text style={s.title}>What’s on your plate?</Text>
    <Text style={s.subtitle}>Take a photo. We’ll estimate the nutrition. You make the final call. Large photos are automatically resized for a faster upload.</Text>
    <View style={{ backgroundColor: '#eaf0e5', borderRadius: 30, minHeight: 300, overflow: 'hidden', borderWidth: 1, borderColor: '#dce5d6' }}>
      {photo ? <Image accessibilityLabel="Your selected meal photo" source={{ uri: photo.uri }} style={{ width: '100%', height: 340 }} resizeMode="contain" /> :
        <View style={{ flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 28 }}>
          <View style={{ width: 130, height: 130, borderRadius: 28, borderWidth: 2, borderStyle: 'dashed', borderColor: '#a0b299', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 52 }}>🍽</Text></View>
          <Text style={s.label}>Your next meal starts here</Text><Text style={[s.subtitle, { textAlign: 'center' }]}>Keep the whole plate in frame.{ '\n' }Good lighting makes a difference.</Text>
        </View>}
      {busy && <View style={{ position: 'absolute', inset: 0, backgroundColor: '#ffffffeb', alignItems: 'center', justifyContent: 'center', gap: 18 }}><ActivityIndicator size="large" color={colors.green} /><Text style={s.label}>Taking a closer look…</Text><Text style={s.subtitle}>This can take a little while.</Text></View>}
    </View>
    {photo ? <><Button title={busy ? 'Analyzing your meal…' : 'Get nutrition estimate →'} disabled={busy} onPress={analyze} /><Button quiet title="Choose a different photo" disabled={busy} onPress={() => choose(false)} /></> :
      <><Button title="Take a food photo" disabled={busy} onPress={() => choose(true)} /><Button title="Choose from photos" quiet disabled={busy} onPress={() => choose(false)} /></>}
    {!!error && <Card><Text accessibilityRole="alert" style={s.error}>{error}</Text></Card>}
    <Button quiet title="Enter a meal manually" disabled={busy} onPress={() => router.push('/review')} />
    <View style={{ padding: 6, gap: 8 }}><Text style={s.label}>You’re always in control.</Text><Text style={s.subtitle}>Portions and hidden oils or sauces can be hard to judge. Edit any estimate before saving. Photos are processed by Google Gemini and aren’t stored by MacroLens.</Text></View>
  </ScrollView>;
}
