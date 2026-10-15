create table public.profiles (
 user_id uuid primary key references auth.users on delete cascade,
 name text not null, age int check(age between 18 and 120), height_cm numeric check(height_cm > 0),
 activity numeric, current_weight numeric, goal_weight numeric, objective text, weekly_change numeric, sex text,
 created_at timestamptz not null default now()
);
create table public.nutrition_goals (
 user_id uuid primary key references auth.users on delete cascade,
 calories numeric not null check(calories>0), protein numeric not null check(protein>=0),
 carbs numeric not null check(carbs>=0), fat numeric not null check(fat>=0),
 goal_weight numeric check(goal_weight>0), objective text,
 updated_at timestamptz not null default now()
);
create table public.meals (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 title text not null, day date not null, category text not null check(category in ('breakfast','lunch','dinner','snack')),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 30),
 created_at timestamptz not null default now()
);
create index meals_user_day on public.meals(user_id,day);
create table public.meal_items (
 id uuid primary key default gen_random_uuid(), meal_id uuid not null references public.meals on delete cascade,
 user_id uuid not null references auth.users on delete cascade, food jsonb not null,
 created_at timestamptz not null default now()
);
-- Keep normalized items transactionally consistent with the editable meal JSON.
create function public.sync_meal_items() returns trigger language plpgsql security definer set search_path=public as $$
begin
 delete from meal_items where meal_id=new.id;
 insert into meal_items(meal_id,user_id,food) select new.id,new.user_id,value from jsonb_array_elements(new.items);
 return new;
end $$;
create trigger sync_items after insert or update of items on public.meals for each row execute function public.sync_meal_items();
create table public.weight_logs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 day date not null, pounds numeric not null check(pounds>0 and pounds<=1500),
 created_at timestamptz not null default now(), unique(user_id,day)
);
do $$ declare t text; begin
 foreach t in array array['profiles','nutrition_goals','meals','weight_logs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy own_records on public.%I for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid())',t);
 end loop;
end $$;
alter table public.meal_items enable row level security;
create policy read_own_items on public.meal_items for select to authenticated using(user_id=auth.uid());
-- Items are written only by the parent meal trigger.
revoke insert,update,delete on public.meal_items from anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('meal-photos','meal-photos',false,8388608,array['image/jpeg','image/png','image/webp']);
-- Photos are processed transiently in the MVP, not persisted. No upload policy is granted.
