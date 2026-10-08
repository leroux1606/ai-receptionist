# Pricing and unit economics

**Every number in this file is an assumption to be replaced with measured
data.** The prices in `lib/billing/plans.ts` are starting points, not
validated. Do the "Measure your real cost" step below before publishing.

## What a call minute costs you

A minute of AI phone call is the sum of several metered services:

| Part | Typical provider | Notes |
|---|---|---|
| Platform fee | Vapi | Per minute, check their current price |
| Telephony | Twilio or a local SIP provider | Inbound per-minute; the forwarded leg may add cost |
| Speech to text | Deepgram (via Vapi) | Per minute |
| Language model | OpenAI (via Vapi) | Per token; short calls are cheap |
| Voice | ElevenLabs or similar (via Vapi) | Usually the biggest variable |

All-in, voice AI commonly lands around **R2.50 to R4.50 per minute**. That is
an estimate, not a quote. Your real figure comes from the cost columns of
your own provider dashboards after a batch of test calls.

## Margin at the current prices

Margin if every included minute is used (the worst case for you), at three
possible all-in costs per minute. The last column assumes customers use only
half their allowance at R3.50 per minute, which is more typical.

| Plan | Price / month | Minutes | Price per minute | Margin at R2.50 | Margin at R3.50 | Margin at R4.50 | Half used, R3.50 |
|---|---|---|---|---|---|---|---|
| Starter | R899 | 100 | R8.99 | R649 (72%) | R549 (61%) | R449 (50%) | R724 (81%) |
| Pro | R1,999 | 300 | R6.66 | R1,249 (62%) | R949 (47%) | R649 (32%) | R1,474 (74%) |
| Business | R4,499 | 800 | R5.62 | R2,499 (56%) | R1,699 (38%) | R899 (20%) | R3,099 (69%) |

Reading it: the Business plan only works if your real cost is toward the low
end. If you measure R4.50 per minute, raise the Business price or cut its
minutes. Overage rates (R9, R8, R7 per extra minute) should always sit
comfortably above your cost per minute.

## Measure your real cost (do this before launch)

1. Place 20 realistic test calls: 5 short (under a minute), 10 normal (2 to 3
   minutes), 5 long or awkward.
2. Add up what Vapi, your telephony provider, the model provider and the voice
   provider charged for those calls.
3. Divide by the total billed minutes (each call rounds up to a whole minute,
   see `billableMinutes` in `lib/billing/plans.ts`).
4. Add a 25% safety margin. That is your cost per minute for the table above.

## Fixed monthly costs to cover

Hosting (Vercel), database (Supabase), email (Resend), the phone numbers
themselves and any minimum platform fees. Add them up; your break-even number
of customers is `fixed costs / average margin per customer`.

## Changing prices

Edit `lib/billing/plans.ts` (display, usage and overage maths), then update
the matching plans in the Paystack dashboard and `scripts/monthly-usage.sql`.
Existing subscribers stay on their Paystack plan until you move them.

## Selling it

The strongest early customers are businesses where a missed call is a lost
sale and nobody is always free to answer: dentists, vets, physiotherapists,
plumbers and electricians, salons, small law and accounting practices,
estate agents. Start by offering the free trial to ten of them personally.
