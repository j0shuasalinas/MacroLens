-- Explicit completion marker: only set after both profile and confirmed goals are saved.
alter table public.profiles add column onboarded_at timestamptz;
update public.profiles p set onboarded_at=now()
where exists(select 1 from public.nutrition_goals g where g.user_id=p.user_id);

create function public.complete_onboarding(profile_data jsonb, goal_data jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare uid uuid := auth.uid();
begin
 if uid is null then raise exception 'Authentication required'; end if;
 insert into profiles(user_id,name,age,height_cm,activity,current_weight,goal_weight,objective,weekly_change,sex,onboarded_at)
 values(uid,profile_data->>'name',(profile_data->>'age')::int,(profile_data->>'height_cm')::numeric,
 (profile_data->>'activity')::numeric,(profile_data->>'current_weight')::numeric,(profile_data->>'goal_weight')::numeric,
 profile_data->>'objective',(profile_data->>'weekly_change')::numeric,profile_data->>'sex',now())
 on conflict(user_id) do update set name=excluded.name,age=excluded.age,height_cm=excluded.height_cm,
 activity=excluded.activity,current_weight=excluded.current_weight,goal_weight=excluded.goal_weight,
 objective=excluded.objective,weekly_change=excluded.weekly_change,sex=excluded.sex,onboarded_at=now();
 insert into nutrition_goals(user_id,calories,protein,carbs,fat,goal_weight,objective)
 values(uid,(goal_data->>'calories')::numeric,(goal_data->>'protein')::numeric,(goal_data->>'carbs')::numeric,
 (goal_data->>'fat')::numeric,(profile_data->>'goal_weight')::numeric,profile_data->>'objective')
 on conflict(user_id) do update set calories=excluded.calories,protein=excluded.protein,carbs=excluded.carbs,
 fat=excluded.fat,goal_weight=excluded.goal_weight,objective=excluded.objective,updated_at=now();
 return jsonb_build_object('completed',true);
end $$;
revoke all on function public.complete_onboarding(jsonb,jsonb) from public,anon;
grant execute on function public.complete_onboarding(jsonb,jsonb) to authenticated;
