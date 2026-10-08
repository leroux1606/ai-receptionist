-- Monthly usage and overage report. Run in the Supabase SQL editor after a
-- month ends, then invoice any overage (automatic overage billing is NOT
-- built yet, see docs/LAUNCH_CHECKLIST.md).
--
-- Change the two timestamps to the month you are billing. Prices below must
-- match lib/billing/plans.ts (cents per extra minute).

with params as (
  select date_trunc('month', now() - interval '1 month') as period_start,
         date_trunc('month', now())                      as period_end
),
usage as (
  select c.org_id,
         sum(ceil(coalesce(c.duration_seconds, 0) / 60.0))::int as minutes_used,
         count(*)                                              as calls
  from public.calls c, params p
  where c.started_at >= p.period_start and c.started_at < p.period_end
  group by c.org_id
)
select o.name,
       o.plan,
       o.subscription_status,
       coalesce(u.calls, 0)        as calls,
       coalesce(u.minutes_used, 0) as minutes_used,
       case o.plan when 'starter' then 100 when 'pro' then 300 when 'business' then 800 else 30 end
                                   as minutes_included,
       greatest(0, coalesce(u.minutes_used, 0) -
         case o.plan when 'starter' then 100 when 'pro' then 300 when 'business' then 800 else 30 end)
                                   as overage_minutes,
       greatest(0, coalesce(u.minutes_used, 0) -
         case o.plan when 'starter' then 100 when 'pro' then 300 when 'business' then 800 else 30 end)
         * case o.plan when 'starter' then 9.00 when 'pro' then 8.00 when 'business' then 7.00 else 0 end
                                   as overage_rand
from public.organizations o
left join usage u on u.org_id = o.id
where o.plan <> 'trial'
order by overage_rand desc;
