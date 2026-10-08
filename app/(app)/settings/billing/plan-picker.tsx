"use client";

import { useActionState } from "react";
import { startCheckout, type CheckoutState } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PAID_PLAN_IDS, PLANS, formatZar, type PlanId } from "@/lib/billing/plans";

const initialState: CheckoutState = { error: null };

export function PlanPicker({ currentPlan }: { currentPlan: PlanId }) {
  const [state, formAction, pending] = useActionState(startCheckout, initialState);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {PAID_PLAN_IDS.map((id) => {
          const plan = PLANS[id];
          const isCurrent = id === currentPlan;
          return (
            <Card key={id}>
              <CardHeader>
                <CardTitle>{plan.label}</CardTitle>
                <CardDescription>{plan.blurb}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-semibold">
                  {formatZar(plan.priceZarCents)}
                  <span className="text-sm font-normal text-muted-foreground"> / month</span>
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>{plan.includedMinutes} minutes included</li>
                  {plan.overageZarCentsPerMinute ? (
                    <li>Then {formatZar(plan.overageZarCentsPerMinute)} per extra minute</li>
                  ) : null}
                </ul>
                <form action={formAction}>
                  <input type="hidden" name="plan" value={id} />
                  <Button type="submit" className="w-full" disabled={pending || isCurrent} variant={isCurrent ? "outline" : "default"}>
                    {isCurrent ? "Current plan" : pending ? "Redirecting…" : `Choose ${plan.label}`}
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
