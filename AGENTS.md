<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AI Receptionist: Agent Instructions

## What this is
A multi-tenant SaaS that sells an AI phone receptionist to small businesses.
Each customer (organization) fills in a business profile; we turn it into a
Vapi assistant, give them a phone number from a pool, and log every call.
Customers forward their business line to that number.

This project was derived from `nyrvex-answering-service` (a single-tenant
call log for Nyrvex's own line). That repository is separate and must not be
modified from here.

## Rules that matter
- Tenant isolation is enforced by Postgres row level security, not by app
  code. Customer-facing reads use the signed-in user's client; only webhooks
  and provisioning use the service role. Never read tenant data with the
  service role in a page or action that a customer can reach without first
  checking membership.
- The receptionist must never invent facts about a customer's business and
  must say it is an AI. Keep that in `lib/agent/prompt.ts` and its tests.
- Everything Vapi-specific lives in `lib/vapi/client.ts`. Everything
  Paystack-specific lives in `lib/billing/paystack.ts`.
- Pure logic (prompt, plans, usage, enforcement, event mapping) is unit
  tested with vitest. Database rules are tested by `scripts/test-db.sh`.

## Checks before committing
`pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`, and
`scripts/test-db.sh` when `supabase/` changes.
