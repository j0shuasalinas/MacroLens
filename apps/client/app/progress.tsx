import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, today } from '../src/api';
import { Button, Card, Input, s, colors } from '../src/ui';
export default function Progress(){
 const [pounds,setPounds]=useState('165');const [day,setDay]=useState(today());const [error,setError]=useState('');const [busy,setBusy]=useState(false);const cache=useQueryClient();
 const weights=useQuery<{day:string;pounds:number}[]>({queryKey:['weights'],queryFn:()=>api('/weights')});
 const goals=useQuery({queryKey:['goals'],queryFn:()=>api('/goals')});
 const recent=weights.data?.slice(-30)||[];const values=recent.map(w=>Number(w.pounds));const low=Math.min(...values)-1;const high=Math.max(...values)+1;
 const cutoff=new Date();cutoff.setDate(cutoff.getDate()-6);const cutoffDay=`${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,'0')}-${String(cutoff.getDate()).padStart(2,'0')}`;const lastWeek=recent.filter(w=>w.day>=cutoffDay && w.day<=today());
 const average=lastWeek.length?lastWeek.reduce((a,w)=>a+Number(w.pounds),0)/lastWeek.length:null;
 const first=recent[0];const last=recent.at(-1);const days=first&&last?(Date.parse(last.day)-Date.parse(first.day))/86400000:0;
 const rate=days>=14?(Number(last!.pounds)-Number(first!.pounds))/days*7:null;
 async function save(){setBusy(true);try{await api('/weights','POST',{day,pounds:Number(pounds)});await cache.invalidateQueries({queryKey:['weights']});setError('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <ScrollView style={s.page} contentContainerStyle={s.content}><Text style={s.title}>A little progress, every day.</Text><Text style={s.subtitle}>Your weight is one part of the picture. Watch the longer trend, not every fluctuation.</Text><Card><Text style={s.label}>Your 7-day average: {average?.toFixed(1)??'—'} lb</Text><Text style={s.subtitle}>Goal: {goals.data?.goal_weight??'—'} lb · {rate===null?'Keep logging for two weeks to see your trend':`${rate.toFixed(2)} lb/week observed`}</Text>{values.length>1?<View accessibilityLabel="Weight chart showing the last 30 entries" style={[s.row,{height:160,alignItems:'flex-end'}]}>{recent.map(w=><View key={w.day} style={{flex:1,minWidth:4,height:20+(Number(w.pounds)-low)/(high-low)*120,backgroundColor:colors.green,borderRadius:4}}/>)}</View>:<Text style={s.subtitle}>Add a few entries to see your weight chart.</Text>}<Text style={s.subtitle}>{first?.day} — {last?.day}</Text></Card><Card><Input label="Weight (lb)" numeric value={pounds} onChangeText={setPounds}/><Input label="Date (YYYY-MM-DD)" value={day} onChangeText={setDay}/><Text style={s.subtitle}>Saving on an existing date replaces that day’s entry.</Text><Button title={busy?'Saving…':'Log my weight'} disabled={busy||Number(pounds)<=0} onPress={save}/></Card>{(error||weights.error)&&<Text style={s.error}>{error||weights.error?.message}</Text>}<Card><Text style={s.label}>Give yourself time</Text><Text style={s.subtitle}>Review at least 2–3 weeks of weekly averages before considering a small calorie adjustment. Your goals only change when you edit and save them.</Text><Button quiet title="Review calorie goals" onPress={()=>router.push('/settings')}/></Card>{[...recent].reverse().map(w=><Text key={w.day} style={s.subtitle}>{w.day} · {w.pounds} lb</Text>)}</ScrollView>;
}
