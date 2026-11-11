-- Stage 1 setup for the server-side coach. Safe to run more than once.
-- Adds new tables and one function only. Nothing existing is changed or dropped.

-- 1. Knowledge base storage. RLS on with NO policies, so only the server
--    function (service role) can read it. Students and the public cannot.
create table if not exists public.coach_kb (
  id text primary key,
  sort int not null default 0,
  content text not null,
  updated_at timestamptz not null default now()
);
alter table public.coach_kb enable row level security;

-- 2. Daily message counter per student. Same lock-down.
create table if not exists public.coach_usage (
  user_id uuid not null,
  day date not null,
  n int not null default 0,
  primary key (user_id, day)
);
alter table public.coach_usage enable row level security;

-- 3. Adds 1 to today's count (Sydney time) and returns the new total.
create or replace function public.coach_bump_usage(uid uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare cur int;
begin
  insert into public.coach_usage (user_id, day, n)
  values (uid, (now() at time zone 'Australia/Sydney')::date, 1)
  on conflict (user_id, day) do update set n = public.coach_usage.n + 1
  returning n into cur;
  return cur;
end;
$$;

revoke all on function public.coach_bump_usage(uuid) from public, anon, authenticated;
grant execute on function public.coach_bump_usage(uuid) to service_role;
