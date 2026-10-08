import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PLANS, formatZar, summariseUsage, usagePeriodStart } from "@/lib/billing/plans";
import { getContext } from "@/lib/org/current";
import { PlanPicker } from "./plan-picker";

export const metadata = { title: "Plan & billing" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const { supabase, org } = await getContext();
  const { data: minutes } = await supabase.rpc("org_minutes_used", {
      p_org: org.id,
      p_since: usagePeriodStart({ plan: org.plan, createdAt: new Date(org.created_at) }).toISOString(),
    });
  const usage = summariseUsage(org.plan, Number(minutes ?? 0));
  const plan = PLANS[org.plan];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl tracking-tight">Plan &amp; billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay monthly in rand. Cancel any time.
        </p>
      </div>

      {checkout === "done" ? (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status">
          Thanks! Your payment is being confirmed. Your plan updates in a moment; refresh this
          page if it still shows the old plan.
        </p>
      ) : null}

      {org.subscription_status === "past_due" ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">
          Your last payment failed, so your receptionist is paused. Choose a plan below to
          switch it back on.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            {plan.label}
            {org.plan !== "trial" ? ` · ${formatZar(plan.priceZarCents)} / month` : ""}
          </CardTitle>
          <CardDescription>
            Status: {org.subscription_status.replace("_", " ")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            {usage.usedMinutes} of {usage.includedMinutes} minutes used this month.
          </p>
          {usage.overageMinutes > 0 && org.plan !== "trial" ? (
            <p className="text-muted-foreground">
              Overage so far: {usage.overageMinutes} minutes ({formatZar(usage.overageZarCents)}).
              {" "}Extra minutes are billed after the month ends.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-heading text-lg tracking-tight">
          {org.plan === "trial" ? "Choose a plan" : "Change plan"}
        </h2>
        <PlanPicker currentPlan={org.plan} />
      </section>
    </div>
  );
}
