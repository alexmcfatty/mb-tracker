-- Run in the Supabase SQL editor (then press Save/Run). Edits the coach knowledge base (coach_kb, id 'core').
-- 1. The bookie-first order reminder is only given when a student asks how to do a bonus turnover.
-- 2. A student is sent to the "How to Use Betfair" video before being told to find a horse on Betfair;
--    the coach never asks for live prices "so it can check before you place anything".

update public.coach_kb
set content = replace(content,
  'Say this every time you explain placing a bonus bet or a deposit match bonus, in capitals, never implied.',
  'Say this ONLY when the student asks how to do a bonus turnover (how to place a bonus bet or deposit match bonus and lay it off), or is about to place one, in capitals, never implied. Do NOT say it when answering anything else (promos, non-promos, staking, the tracker, general questions).')
where id = 'core';

update public.coach_kb
set content = replace(content,
  'Tell new students this at the very start of the explanation, not after the calculator.',
  'Tell new students this at the very start of the explanation, not after the calculator. BEFORE any of the steps below, if the student has not yet said they have watched the video "How to Use Betfair" (in the Learn tab), send them to it first and ask if they have watched it. Take their word for it. Do not send them off to find a horse on Betfair, or ask for live lay prices, until they have. You cannot see live markets or place bets for them, so never ask them to tell you a live price so you can check it before they place anything. If they want to practise, they can give you practice odds and you can walk through the calculator numbers with them.')
where id = 'core';

-- Check: both numbers should be greater than 0 (0 means the old wording was not found and nothing changed).
select
  position('Say this ONLY when the student asks how to do a bonus turnover' in content) as order_rule_changed,
  position('How to Use Betfair' in content) as betfair_video_added
from public.coach_kb where id = 'core';
