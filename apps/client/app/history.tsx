import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { api, Meal, sum, today, useDraft } from '../src/api';
import { Button, Card, Input, s } from '../src/ui';
export default function History() {
  const [search,setSearch]=useState('');const [day,setDay]=useState('');const [error,setError]=useState('');const [deleting,setDeleting]=useState<string>();
  const cache=useQueryClient();const meals=useQuery<Meal[]>({queryKey:['history',day],queryFn:()=>api('/meals'+(day?'?day='+encodeURIComponent(day):''))});
  async function remove(id:string){try{await api('/meals/'+id,'DELETE');setDeleting(undefined);await cache.invalidateQueries();}catch(e){setError((e as Error).message);}}
  return <ScrollView style={s.page} contentContainerStyle={s.content}><Text style={s.title}>Your food journal.</Text><Button quiet title="← Open calendar" onPress={()=>router.push('/calendar')}/><Input label="Search meals or foods" value={search} onChangeText={setSearch}/><Input label="Date (YYYY-MM-DD, optional)" value={day} onChangeText={setDay}/>{(error||meals.error)&&<Text style={s.error}>{error||meals.error?.message}</Text>}{meals.isLoading&&<Text style={s.subtitle}>Loading meals…</Text>}{meals.data?.filter(m=>(m.title+' '+m.items.map(i=>i.name).join(' ')).toLowerCase().includes(search.toLowerCase())).map(m=><Card key={m.id}><Text style={s.label}>{m.title}</Text><Text style={s.subtitle}>{m.day} · {m.category} · {Math.round(sum([m],'calories'))} kcal</Text><Text style={s.subtitle}>{m.items.map(i=>i.name).join(' · ')}</Text><View style={s.row}><Button title="Edit" onPress={()=>{useDraft.getState().setMeal(m);router.push('/review');}}/><Button quiet title="Log again today" onPress={()=>{useDraft.getState().setMeal({...m,id:undefined,day:today()});router.push('/review');}}/><Button quiet title={deleting===m.id?'Confirm delete':'Delete'} onPress={()=>deleting===m.id?remove(m.id!):setDeleting(m.id)}/></View></Card>)}{meals.data?.length===0&&<Card><Text style={s.subtitle}>Your journal starts with your first meal. Scan a photo or enter a meal from Home.</Text></Card>}</ScrollView>;
}
