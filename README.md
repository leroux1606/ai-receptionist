# AI Receptionist

## Start here (plain English)

**This repository is one app, and everything is at the top level.** There is
no second app and no sub-folder to dive into. You can ignore your other
repositories (ReverseSearch, Nyrvex-Answering-Service, ComplianceKit,
AccessKit): none of them is needed to run or sell this.

What it is: a service you sell to small businesses. Their calls are answered
by an AI receptionist that takes messages and appointment requests and emails
them a summary.

Where to look:

| I want to... | Open |
|---|---|
| Know what to do next to launch | `docs/LAUNCH_CHECKLIST.md` |
| Set prices | `docs/PRICING.md` |
| See how it works | the rest of this file |
| Run it on my computer | "Run it" below |

The three folders you will actually touch: `app/` (the website), `lib/` (the
logic), `supabase/` (the database).

---

A multi-tenant SaaS that sells an AI phone receptionist to small businesses.

A business signs up, tells the receptionist about itself (hours, services,
common questions), and switches it on. It gets a phone number to forward its
calls to. The AI answers, takes messages, requests appointments and emails
the owner a summary. Every call lands in a dashboard with its transcript.

Stack: Next.js 16, Supabase (Postgres, auth, row level security), Vapi for the
voice layer, Paystack for ZAR subscriptions, Resend for email.

Derived from `nyrvex-answering-service`, the single-tenant call log for
Nyrvex's own line. This is a separate project; that repository is untouched.

## Status

Built and verified in a sandbox with no live third-party accounts. Read
[`docs/LAUNCH_CHECKLIST.md`](docs/LAUNCH_CHECKLIST.md): it lists what is
proven, what must be verified against live Vapi and Paystack, and the known
gaps. [`docs/PRICING.md`](docs/PRICING.md) explains the unit economics; the
prices in the code are assumptions until you measure real call costs.

## How it works

```
Customer's phone --forward--> pooled number (Vapi) --> AI receptionist
                                                         |
                          end-of-call-report webhook <---+
                                   |
        /api/webhooks/vapi/{agentId}  (per-agent derived secret)
                                   |
        persist_call() -> Postgres (RLS by organization) -> dashboard + email
```

- **Onboarding**: sign up, name the business, fill in the profile
  (`/settings/agent`), "Save and go live".
- **Go live** (`lib/provisioning/go-live.ts`): builds the assistant from the
  profile (`lib/agent/prompt.ts`), creates or updates it in Vapi, claims a
  number from the pool, attaches it, marks the agent live.
- **Billing** (`lib/billing`): Paystack hosted checkout; signed webhooks
  activate plans, pause on failed payments and resume after.
- **Limits** (`lib/provisioning/enforce.ts`): trials are hard capped at 14
  days or 30 minutes; paying customers are never cut off for going over, but
  unpaid or canceled accounts are paused. An hourly cron re-checks everything.
- **Isolation**: Postgres row level security is the tenant boundary.
  Customers cannot edit provisioning fields, change their plan or read other
  tenants' rows; webhooks and provisioning use the service role.
- **Webhook security**: each agent's secret is `HMAC(WEBHOOK_MASTER_KEY,
  agentId)`. Nothing secret is stored per tenant, editing a live agent never
  rotates it, and one tenant's secret is useless on another's endpoint.

## Run it

```bash
pnpm install
cp .env.example .env.local     # fill in at least the Supabase values
# apply supabase/migrations/*.sql to your Supabase project
pnpm dev                       # http://localhost:3000
```

Without Vapi or Paystack keys the app still runs: sign-up, onboarding, the
profile form and the dashboard work, and "go live" or checkout explain that
those services are not switched on.

## Test it

```bash
pnpm test                 # unit tests (pure logic, no network)
pnpm exec tsc --noEmit
pnpm lint
pnpm build
# database rules, against a DISPOSABLE Postgres:
PGHOST=localhost PGUSER=postgres scripts/test-db.sh
```

## Layout

| Path | What |
|---|---|
| `supabase/migrations` | Schema, RLS, RPCs (`create_organization`, `persist_call`, `claim_phone_number`, `org_minutes_used`) |
| `supabase/tests` | Supabase stand-in and tenant-isolation tests |
| `lib/agent` | Business profile rules and the receptionist's prompt |
| `lib/vapi` | The only file that knows Vapi's API |
| `lib/billing` | Plans, usage maths, Paystack |
| `lib/provisioning` | Go live, pause, resume and enforcement rules |
| `lib/server` | Supabase-backed glue (service role) |
| `app/(app)` | Signed-in app: overview, calls, receptionist, billing |
| `app/api/webhooks` | Vapi and Paystack receivers |
| `scripts/monthly-usage.sql` | Month-end overage report for manual invoicing |
