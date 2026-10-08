import Link from "next/link";
import { AgentStatusBadge } from "@/components/app/agent-status";
import { CallList } from "@/components/calls/call-list";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PLANS, summariseUsage, usagePeriodStart } from "@/lib/billing/plans";
import { listCalls } from "@/lib/calls/queries";
import { getContext } from "@/lib/org/current";
import { cn } from "@/lib/utils";

export const metadata = { title: "Overview" };

export default async function DashboardPage() {
  const { supabase, org, agent } = await getContext();

  const [{ data: minutes }, calls] = await Promise.all([
    supabase.rpc("org_minutes_used", {
      p_org: org.id,
      p_since: usagePeriodStart({ plan: org.plan, createdAt: new Date(org.created_at) }).toISOString(),
    }),
    listCalls(5),
  ]);

  const usage = summariseUsage(org.plan, Number(minutes ?? 0));
  const plan = PLANS[org.plan];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your receptionist at a glance.
          </p>
        </div>
        <AgentStatusBadge status={agent.status} />
      </div>

      {agent.status === "draft" || agent.status === "error" ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {agent.status === "error" ? "Your line needs attention" : "Finish setting up"}
            </CardTitle>
            <CardDescription>
              {agent.status_detail ??
                "Tell your receptionist about your business, then switch it on."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/settings/agent" className={cn(buttonVariants())}>
              Open receptionist settings
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {agent.phone_number ? (
        <Card>
          <CardHeader>
            <CardTitle>Your receptionist&apos;s number</CardTitle>
            <CardDescription>
              Forward your business line to this number when you can&apos;t answer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xl">{agent.phone_number}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Use your phone&apos;s call-forwarding setting (or ask your phone provider) to
              forward unanswered or all calls here. You keep your existing number.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Minutes this month</CardTitle>
            <CardDescription>
              {plan.label} plan · {usage.includedMinutes} minutes included
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold tabular-nums">
              {usage.usedMinutes}
              <span className="ml-1 text-base font-normal text-muted-foreground">
                / {usage.includedMinutes}
              </span>
            </p>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={usage.percentUsed}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Minutes used"
            >
              <div
                className={cn(
                  "h-full rounded-full",
                  usage.level === "ok" ? "bg-primary" : "bg-destructive",
                )}
                style={{ width: `${usage.percentUsed}%` }}
              />
            </div>
            {usage.level !== "ok" ? (
              <p className="text-sm text-muted-foreground">
                {org.plan === "trial"
                  ? "Your free trial minutes are nearly used. Choose a plan to keep your receptionist answering."
                  : usage.level === "over_limit"
                    ? "You are over your included minutes. Extra minutes are billed at your plan's overage rate."
                    : "You are close to your included minutes."}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {org.plan === "trial" ? "Free trial" : `${plan.label} plan`}
            </CardTitle>
            <CardDescription>
              {org.plan === "trial"
                ? `Ends ${new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(new Date(org.trial_ends_at))}`
                : `Status: ${org.subscription_status.replace("_", " ")}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/settings/billing"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              {org.plan === "trial" ? "Choose a plan" : "Manage plan"}
            </Link>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg tracking-tight">Recent calls</h2>
          <Link href="/calls" className="text-sm text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </div>
        <CallList
          calls={calls}
          emptyHint={
            agent.status === "live"
              ? "No calls yet. Call your receptionist's number to hear it in action."
              : "Once your receptionist is live, every call will show up here."
          }
        />
      </section>
    </div>
  );
}
