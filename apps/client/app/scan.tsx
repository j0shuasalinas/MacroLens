import { useState } from 'react';
import { Image, Platform, ScrollView, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { api, today, useDraft } from '../src/api';
import { Button, Card, s } from '../src/ui';
export default function Scan() {
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset>(); const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  async function choose(camera: boolean) { setError(''); try {
    if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Camera permission is required. You can upload a photo instead.');
    const result = camera ? await ImagePicker.launchCameraAsync({quality:.8}) : await ImagePicker.launchImageLibraryAsync({quality:.8,mediaTypes:['images']});
    if (!result.canceled) setPhoto(result.assets[0]);
  } catch(e) {setError((e as Error).message);} }
  async function analyze() { if (!photo) return; setBusy(true); setError(''); try {
    const data = new FormData();
    if (Platform.OS === 'web') data.append('image', await (await fetch(photo.uri)).blob(), photo.fileName || 'meal.jpg');
    else data.append('image', {uri:photo.uri,name:photo.fileName || 'meal.jpg',type:photo.mimeType || 'image/jpeg'} as unknown as Blob);
    const result = await api('/analyze','POST',data);
    if (!result.items.length) throw new Error('No food was identified. Try a clearer photo or enter the meal manually.');
    useDraft.getState().setMeal({title:'Photo meal',day:today(),category:'lunch',items:result.items});
    router.push({pathname:'/review',params:{warnings:result.warnings.join('\n')}});
  } catch(e) {setError((e as Error).message);} finally {setBusy(false);} }
  return <ScrollView style={s.page} contentContainerStyle={s.content}><Text style={s.title}>A picture of your plate.</Text><Text style={s.subtitle}>Use good lighting and include the full meal. A known size reference helps estimate portions.</Text><Card>{photo ? <Image source={{uri:photo.uri}} style={{width:'100%',height:320,borderRadius:14}} resizeMode="contain" /> : <Text style={[s.title,{paddingVertical:70,textAlign:'center'}]}>＋</Text>}<Button title="Choose photo" disabled={busy} onPress={() => choose(false)} /><Button title="Take photo" quiet disabled={busy} onPress={() => choose(true)} /><Button title={busy ? 'Analyzing your meal…' : 'Analyze with Gemini'} disabled={!photo || busy} onPress={analyze} /></Card>{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}<Text style={s.subtitle}>Your photo is sent to our API and Google Gemini for analysis. MacroLens does not retain the image. Portions, oils, sauces, and hidden ingredients remain uncertain. Review all results before saving.</Text></ScrollView>;
}
