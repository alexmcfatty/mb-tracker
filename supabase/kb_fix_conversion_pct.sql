-- Fixes the coach's lay-conversion examples so they match the tracker's calculator (lay stake = bonus x (back-1) / (lay-0.10), 10% commission).
-- Old examples promised ~83% and said a winning horse loses money; the calculator gives ~76% and equal profit either way. Run once in the Supabase SQL editor.

update public.coach_kb set content = replace(content, $q$Lay stake: 25 \u00d7 (11 - 1) \u00f7 (12 \u00d7 0.9) = $23.15. Enter this exact amount into Betfair.
Liability: $23.15 \u00d7 (12 - 1) = $254.65. This must be sitting in your Betfair account before placing.

Outcome A \u2014 horse LOSES (most common at these odds):
Betfair lay wins $23.15, minus 10% commission = $20.84 cash in hand.
Extraction: $20.84 \u00f7 $25 = 83%.

Outcome B \u2014 horse WINS:
Bookie pays (11 - 1) \u00d7 $25 = $250 cash. Betfair lay loses $23.15 \u00d7 (12 - 1) = $254.65.
Net on this race: $250 - $254.65 = -$4.65 (small loss, offset by wins across all bets).
Over many bets both outcomes average to ~83% extraction \u2014 the formula guarantees this.$q$, $q$Lay stake: 25 × (11 - 1) ÷ (12 - 0.10) = $21.01. Enter this amount into Betfair (the calculator gives the same number).
Liability: $21.01 × (12 - 1) = $231.11. This must be sitting in your Betfair account before placing.

Outcome A — horse LOSES (most common at these odds):
Betfair lay wins $21.01, minus 10% commission = $18.91 cash in hand.
Conversion: $18.91 ÷ $25 = about 76%.

Outcome B — horse WINS:
Bookie pays (11 - 1) × $25 = $250. Betfair lay loses $21.01 × (12 - 1) = $231.11.
Net on this race: $250 - $231.11 = $18.89. About the same as Outcome A, so the result is locked in whichever way the race goes (tiny differences are rounding).
So this bet converts about 76% of the bonus after commission. The calculator shows this as the green conversion % (70%+ passes).$q$), updated_at = now() where id = 'core';

update public.coach_kb set content = replace(content, $q$Lay stake: 25 \u00d7 (9 - 1) \u00f7 (12 \u00d7 0.9) = $18.52.
If horse loses: $18.52 \u00d7 0.9 = $16.67 cash. Extraction: 67%.
Cost per bet: $20.84 (qualifying race) vs $16.67 (bad race) = $4.17 lost per $25 bonus bet.
Over 20 bonus bets: 20 \u00d7 $4.17 = $83.40 left on the table just by not checking the formula.$q$, $q$Lay stake: 25 × (9 - 1) ÷ (12 - 0.10) = $16.81.
Locked in: $16.81 × 0.9 = $15.13 cash. Conversion: about 61%.
Cost per bet: $18.91 (qualifying race) vs $15.13 (bad race) = $3.78 lost per $25 bonus bet.
Over 20 bonus bets: 20 × $3.78 = $75.60 left on the table just by not checking the formula.$q$), updated_at = now() where id = 'core';

update public.coach_kb set content = replace(content, $q$convert those bonus bets to cash at ~80% of face value$q$, $q$convert those bonus bets to cash at ~70% of face value$q$), updated_at = now() where id = 'core';

update public.coach_kb set content = replace(content, $q$(which you convert to ~80% of its value on Betfair)$q$, $q$(which you convert to ~70% of its value on Betfair)$q$), updated_at = now() where id = 'core';

update public.coach_kb set content = replace(content, $q$The bonus bet is worth ~80% of its face value when converted$q$, $q$The bonus bet is worth ~70% of its face value when converted$q$), updated_at = now() where id = 'core';

update public.coach_kb set content = replace(content, $q$you get back ~80% as a bonus$q$, $q$you get back ~70% as a bonus$q$), updated_at = now() where id = 'core';
