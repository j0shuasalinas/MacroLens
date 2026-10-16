-- Aggregate the whole month in PostgreSQL without a REST row-limit truncation.
create function public.nutrition_calendar(month_start date)
returns table(day date,calories numeric,protein numeric,carbs numeric,fat numeric,meal_count bigint)
language sql stable security invoker set search_path=public as $$
 with meal_totals as (
  select m.day,
   coalesce(sum((item->>'calories')::numeric),0) calories,
   coalesce(sum((item->>'protein')::numeric),0) protein,
   coalesce(sum((item->>'carbs')::numeric),0) carbs,
   coalesce(sum((item->>'fat')::numeric),0) fat
  from public.meals m cross join lateral jsonb_array_elements(m.items) item
  where m.user_id=auth.uid() and m.day>=date_trunc('month',month_start)::date
   and m.day<(date_trunc('month',month_start)+interval '1 month')::date
  group by m.id,m.day
 ), daily as (
  select t.day,sum(t.calories) calories,sum(t.protein) protein,sum(t.carbs) carbs,sum(t.fat) fat,count(*) meal_count
  from meal_totals t group by t.day
 )
 select d::date,coalesce(t.calories,0),coalesce(t.protein,0),coalesce(t.carbs,0),coalesce(t.fat,0),coalesce(t.meal_count,0)
 from generate_series(date_trunc('month',month_start),date_trunc('month',month_start)+interval '1 month - 1 day',interval '1 day') d
 left join daily t on t.day=d::date order by d;
$$;
revoke all on function public.nutrition_calendar(date) from public,anon;
grant execute on function public.nutrition_calendar(date) to authenticated;
