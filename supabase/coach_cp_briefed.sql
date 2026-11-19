-- Run once in the Supabase SQL editor.
-- Remembers which checkpoint the AI coach has already briefed each student on,
-- so the coach opens a new checkpoint with a summary of what ticks it off, once.
-- Only the coach-chat function (service role) reads or writes it; students can't.

create table if not exists public.coach_cp_briefed (
  user_id uuid not null,
  cp int not null,
  briefed_at timestamptz not null default now(),
  primary key (user_id, cp)
);
alter table public.coach_cp_briefed enable row level security;
