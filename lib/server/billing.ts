import "server-only";
import type { BillingAction } from "@/lib/billing/paystack";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { enforceServiceForOrg } from "@/lib/server/enforce";

/** Applies one interpreted Paystack event, then re-checks the phone line. */
export async function applyBillingAction(action: BillingAction): Promise<void> {
  if (action.type === "ignore") {
    return;
  }
  const supabase = createServiceRoleClient();

  async function orgIdForCustomer(customerRef: string): Promise<string | null> {
    const { data } = await supabase
      .from("organizations")
      .select("id")
      .eq("billing_customer_ref", customerRef)
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  }

  let orgId: string | null = null;

  switch (action.type) {
    case "activate": {
      const { error } = await supabase
        .from("organizations")
        .update({
          plan: action.plan,
          subscription_status: "active",
          ...(action.customerRef ? { billing_customer_ref: action.customerRef } : {}),
        })
        .eq("id", action.orgId);
      if (error) throw new Error(`Failed to activate plan: ${error.message}`);
      orgId = action.orgId;
      break;
    }
    case "subscription_created": {
      orgId = await orgIdForCustomer(action.customerRef);
      if (orgId) {
        await supabase
          .from("organizations")
          .update({ billing_subscription_ref: action.subscriptionRef })
          .eq("id", orgId);
      }
      break;
    }
    case "payment_failed": {
      orgId = await orgIdForCustomer(action.customerRef);
      if (orgId) {
        await supabase.from("organizations").update({ subscription_status: "past_due" }).eq("id", orgId);
      }
      break;
    }
    case "canceled": {
      orgId = await orgIdForCustomer(action.customerRef);
      if (orgId) {
        await supabase.from("organizations").update({ subscription_status: "canceled" }).eq("id", orgId);
      }
      break;
    }
  }

  if (orgId) {
    await enforceServiceForOrg(orgId);
  }
}
