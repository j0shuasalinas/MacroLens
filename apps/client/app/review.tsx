import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, blankFood, Food, today, useDraft } from '../src/api';
import { Button, Input, Card, s } from '../src/ui';
export default function Review() {
  const {meal,setMeal} = useDraft(); const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  const {warnings} = useLocalSearchParams<{warnings?:string}>(); const cache = useQueryClient();
  function edit(index:number,key:keyof Food,value:string) {
    const items = meal.items.map((item,i) => { if(i!==index) return item;
      if (key==='grams') {const grams=Number(value); const ratio=item.grams>0 && grams>0?grams/item.grams:1; return {...item,grams,...Object.fromEntries((['calories','protein','carbs','fat'] as const).map(k=>[k,Number((item[k]*ratio).toFixed(1))]))};}
      return {...item,[key]:['calories','protein','carbs','fat'].includes(key)?Number(value):value, ...(['name','calories','protein','carbs','fat'].includes(key)?{source:'User edited',fdc_id:null}:{})}; });
    setMeal({...meal,items});
  }
  async function save() {setBusy(true);setError('');try {
    await api(meal.id?'/meals/'+meal.id:'/meals',meal.id?'PUT':'POST', {title:meal.title,day:meal.day,category:meal.category,items:meal.items});
    await cache.invalidateQueries(); setMeal({title:'',day:today(),category:'lunch',items:[blankFood()]});router.replace('/');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <ScrollView style={s.page} contentContainerStyle={s.content}><Text style={s.title}>Make it yours.</Text><Text style={s.subtitle}>Check the foods and portions below. Adjust anything that looks off, then save your meal.</Text>{!!warnings && <Text style={s.subtitle}>{warnings}</Text>}<Input label="What’s this meal called?" placeholder="e.g. Chicken & rice bowl" value={meal.title} onChangeText={title=>setMeal({...meal,title})} /><Input label="Meal date (YYYY-MM-DD)" value={meal.day} onChangeText={day=>setMeal({...meal,day})} /><View style={s.row}>{(['breakfast','lunch','dinner','snack'] as const).map(category=><Button key={category} title={category} quiet={meal.category!==category} onPress={()=>setMeal({...meal,category})} />)}</View>{meal.items.map((food,i)=><Card key={i}><Input label="Food name" value={food.name} onChangeText={v=>edit(i,'name',v)} /><View style={s.row}>{(['grams','calories','protein','carbs','fat'] as const).map(k=><Input key={k} label={k==='grams'?'Portion (g)':k==='calories'?'Calories (kcal)':`${k[0].toUpperCase()+k.slice(1)} (g)`} numeric value={String(food[k])} onChangeText={v=>edit(i,k,v)} />)}</View><Text style={s.subtitle}>{food.source} · {food.confidence} confidence{food.fdc_id ? ` · FDC ${food.fdc_id}` : ''}</Text><Input label="Anything uncertain?" value={food.uncertainty} onChangeText={v=>edit(i,'uncertainty',v)} /><Button quiet title="Remove food" onPress={()=>setMeal({...meal,items:meal.items.filter((_,n)=>n!==i)})} /></Card>)}<Button quiet title="＋ Add food" onPress={()=>setMeal({...meal,items:[...meal.items,blankFood()]})} />{!!error&&<Text style={s.error}>{error}</Text>}<Button title={busy?'Saving…':'Save meal →'} disabled={busy || !meal.title || !meal.items.length || meal.items.some(i=>!i.name || i.grams<=0 || [i.grams,i.calories,i.protein,i.carbs,i.fat].some(v=>!Number.isFinite(v)||v<0))} onPress={save} /></ScrollView>;
}
