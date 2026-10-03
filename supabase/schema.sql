create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  task text not null check (char_length(task) <= 2000),
  plan jsonb not null,
  time_budget text not null default '10 minutes',
  energy_level text not null default 'Somewhat steady',
  model_provider text not null,
  model_name text not null,
  backboard_thread_id text,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;
revoke all on public.plans from anon, authenticated;
grant select, insert on public.plans to authenticated;

create policy "Users can read their own plans" on public.plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own plans" on public.plans
  for insert to authenticated with check ((select auth.uid()) = user_id);
create index if not exists plans_user_created_idx on public.plans (user_id, created_at desc);

-- This usage ledger is accessed only by the server-side Edge Function.
create table if not exists public.plan_generation_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.plan_generation_usage enable row level security;
revoke all on public.plan_generation_usage from anon, authenticated;
grant all on public.plan_generation_usage to service_role;
create index if not exists plan_generation_usage_user_date_idx
  on public.plan_generation_usage (user_id, created_at desc);

create or replace function public.consume_plan_generation(target_user uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare recent_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_user::text, 0));
  delete from public.plan_generation_usage
  where user_id = target_user and created_at < now() - interval '48 hours';
  select count(*) into recent_count from public.plan_generation_usage
  where user_id = target_user and created_at > now() - interval '24 hours';
  if recent_count >= 30 then return false; end if;
  insert into public.plan_generation_usage(user_id) values (target_user);
  return true;
end;
$$;
revoke all on function public.consume_plan_generation(uuid) from public, anon, authenticated;
grant execute on function public.consume_plan_generation(uuid) to service_role;
