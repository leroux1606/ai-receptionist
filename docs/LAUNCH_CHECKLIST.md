# Launch checklist

Work top to bottom. Items marked **YOU** need your accounts, money or a
decision; I could not do them from the build environment. Nothing here has
been run against live Vapi, Twilio, Paystack, Resend or Supabase, so step 3
and step 5 are real verification, not formalities.

## 0. What is already proven

- 90 unit tests: prompt building, plans and usage, enforcement rules, Vapi
  and Paystack payload and event handling, per-agent webhook secrets.
- `scripts/test-db.sh`: the migration runs on real Postgres and 30 checks
  prove tenant isolation, protected columns, retry de-duplication and the
  phone-number pool.
- A production build, and a smoke test of the running app: webhooks reject
  missing, wrong and cross-tenant secrets; protected pages redirect to login.

## 1. Accounts and keys (YOU)

- [ ] Supabase project. Run `supabase/migrations/*.sql` (SQL editor or CLI).
- [ ] Supabase Auth: set the site URL to your domain, add
      `https://YOURDOMAIN/auth/callback` as a redirect URL, decide whether
      email confirmation is on (the sign-up form handles both).
- [ ] Vapi account and private API key.
- [ ] A voice provider choice inside Vapi (ElevenLabs or similar). Listen to
      several voices on a phone call, not in a browser demo. Put its id in
      `VAPI_VOICE_ID`.
- [ ] Resend account, verify your sending domain.
- [ ] Paystack account (ZAR). Create three subscription plans matching
      `lib/billing/plans.ts`; put the codes in `PAYSTACK_PLAN_*`.
- [ ] Vercel project for this folder (`ai-receptionist/`). Set every variable
      from `.env.example`. Generate `WEBHOOK_MASTER_KEY` with
      `openssl rand -base64 48` and never change it casually: changing it
      invalidates every customer's webhook secret until each agent is re-saved.
- [ ] Point Paystack's webhook at `https://YOURDOMAIN/api/webhooks/paystack`.

## 2. Phone numbers (YOU) - the part most likely to bite

Customers keep their own number and forward calls to the number you give them.

- **Use a South African number for the AI line.** If a South African customer
  forwards calls to a foreign number they may pay international rates on every
  forwarded call, and will blame you. Get local numbers through Twilio or a
  South African SIP provider and import them into Vapi. Regulatory documents
  are usually required for South African numbers; start this first because
  it can take days or weeks.
- Buy a handful (one per expected customer, plus spares) and add each to the
  pool, with the id Vapi gave the imported number:

```sql
insert into public.phone_numbers (e164, vapi_phone_number_id)
values ('+27105550101', 'vapi-phone-number-id-1');
```

- Going live fails cleanly with "no free phone numbers in the pool" when the
  pool is empty, and the customer sees "could not switch the line on".
  Watch the pool size.

## 3. Verify the Vapi adapter (YOU, 30 minutes) - required

`lib/vapi/client.ts` was written without access to Vapi's current docs. Its
request shapes (assistant fields, `server.headers`, `analysisPlan`,
transfer tool, phone-number PATCH) must be confirmed against the live API.

- [ ] Compare `buildAssistantPayload` with Vapi's current "create assistant"
      reference. Fix any field name in that one file; its tests will show
      what changed.
- [ ] Run a real go-live for a test account, call the number, and confirm in
      Supabase that the call row, transcript, summary and outcome appear.
- [ ] Confirm the `end-of-call-report` carries `analysis.structuredData`
      with `outcome`, `caller_name` and `booking` as the schema requests.
      If your Vapi plan puts them elsewhere, `extractStructuredData` in
      `lib/webhooks/vapi.ts` already also reads `artifact.structuredOutputs`.
- [ ] Confirm the transfer tool actually transfers (needs a transfer number).

## 4. Test it like a hostile caller (YOU + a friend)

Run at least 20 calls against a test business, including: a caller who
mumbles, one who asks a price you never provided, one who asks "are you a
robot?", one who swears, one who describes an emergency, one who changes
their mind about the appointment, one who stays silent, one who asks about a
competitor. Read every transcript. Tighten `lib/agent/prompt.ts`; the tests
there guard the rules you must not break.

## 5. Verify billing end to end (YOU)

- [ ] In Paystack **test mode**, run a full checkout from the billing page.
- [ ] Confirm the webhook upgrades the organization and the plan shows up.
- [ ] Trigger a failed payment (test card) and confirm the line pauses, then
      resumes after a successful payment.
- [ ] Confirm a customer who paused their own line is NOT auto-resumed.

## 6. Run tenant isolation on real Supabase (YOU)

`scripts/test-db.sh` proves the rules on plain Postgres with a Supabase
stand-in. Prove them once on the real thing: create two real users in two
browsers, give each a business, and confirm neither can see the other's
calls by URL guessing (`/calls/<other id>` must be a 404).

## 7. Legal (YOU, before any paying customer)

- [ ] A South African attorney reviews `/terms` and `/privacy` (both are
      clearly marked drafts) and the processor agreement you will need
      between you and each business under POPIA.
- [ ] Decide call-recording defaults and the wording of the opening line.
      The receptionist always says it is a virtual assistant and, if
      recording is on, that the call may be recorded.
- [ ] Check whether you must register an information officer with the
      Information Regulator.
- [ ] Fill in `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_COMPANY_NAME` and
      `NEXT_PUBLIC_SUPPORT_EMAIL`.

## 8. Use it yourself first: Nyrvex as customer number one

Sign up as a normal customer and create a business profile for Nyrvex (hours,
ComplianceKit and AccessKit descriptions, common questions). That gives
Nyrvex its answering line with no change to the ComplianceKit or AccessKit
repositories, and it is the best test the product will ever get. Live with it
for two weeks before selling.

## 9. Pricing (YOU)

Do the measurement in `docs/PRICING.md` and adjust `lib/billing/plans.ts`
before you publish prices.

## 10. Known gaps (decide what you need before launch)

| Gap | Impact | Workaround today |
|---|---|---|
| Overage is not charged automatically | Over-allowance minutes are tracked but not invoiced | Run `scripts/monthly-usage.sql` after each month and invoice by hand |
| No calendar integration | The AI records appointment requests, it cannot see availability | Say so in the booking instructions; owner confirms |
| No admin back office | You manage customers in the Supabase table editor | Fine for the first ten customers |
| One user per business | A business cannot invite staff | Share one login at first |
| English only | No Afrikaans or Zulu | `LANGUAGES` in `lib/agent/profile.ts` is the extension point; voice and transcriber must also support it |
| No self-serve cancel or card update | Customer must contact you | Manage the subscription in Paystack |
| No usage warning emails | Customer sees usage in the dashboard only | Add to the webhook handler later |
| No rate limiting on sign-up | Possible abuse of free trials | Add Vercel/Cloudflare protection and email confirmation |
| Billing month is UTC | A South African month boundary is 2 hours off | Immaterial at small scale; note it in your terms |
| Transfer numbers limited to +27 | Customers abroad cannot transfer to a foreign number | Deliberate toll-fraud guard, see `ALLOWED_TRANSFER_PREFIXES` |
| Trial abuse | A person could create many trials | Require email confirmation; consider a phone check later |
