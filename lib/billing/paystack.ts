import { createHmac } from "node:crypto";
import { isPaidPlan, isPlanId, PLANS, type PlanId } from "@/lib/billing/plans";
import { timingSafeEqualString } from "@/lib/webhooks/timing-safe";

// Paystack subscription billing (ZAR). Customers pay via a hosted checkout;
// Paystack then notifies us by signed webhook. We never see card details.
//
// Setup (docs/LAUNCH_CHECKLIST.md): create three Plans in the Paystack
// dashboard matching lib/billing/plans.ts and put their plan codes in
// PAYSTACK_PLAN_STARTER / _PRO / _BUSINESS. UNVERIFIED against the live API
// in this build environment: check one test-mode payment end to end.

export function verifyPaystackSignature(
  rawBody: string,
  signatureHeader: string | null,
  secretKey: string,
): boolean {
  if (!signatureHeader || !secretKey) {
    return false;
  }
  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  return timingSafeEqualString(signatureHeader.toLowerCase(), expected);
}

export type PlanCodes = Partial<Record<PlanId, string>>;

export function planCodesFromEnv(env: Record<string, string | undefined>): PlanCodes {
  return {
    starter: env.PAYSTACK_PLAN_STARTER,
    pro: env.PAYSTACK_PLAN_PRO,
    business: env.PAYSTACK_PLAN_BUSINESS,
  };
}

function planFromCode(code: string | null, codes: PlanCodes): PlanId | null {
  if (!code) return null;
  for (const [plan, planCode] of Object.entries(codes)) {
    if (planCode && planCode === code && isPlanId(plan)) {
      return plan;
    }
  }
  return null;
}

export type BillingAction =
  | { type: "activate"; orgId: string; plan: PlanId; customerRef: string | null }
  | { type: "subscription_created"; customerRef: string; subscriptionRef: string }
  | { type: "payment_failed"; customerRef: string }
  | { type: "canceled"; customerRef: string }
  | { type: "ignore" };

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/**
 * Turns a verified Paystack webhook body into one thing for us to do.
 * Pure: no database, no network.
 */
export function interpretPaystackEvent(body: unknown, codes: PlanCodes): BillingAction {
  if (!isRec(body) || typeof body.event !== "string" || !isRec(body.data)) {
    return { type: "ignore" };
  }
  const data = body.data;
  const customer = isRec(data.customer) ? data.customer : {};
  const customerRef = str(customer.customer_code);
  const metadata = isRec(data.metadata) ? data.metadata : {};
  const planObject = isRec(data.plan) ? data.plan : {};

  switch (body.event) {
    case "charge.success": {
      const orgId = str(metadata.org_id);
      if (!orgId) return { type: "ignore" };
      const metaPlan = str(metadata.plan);
      const plan = isPaidPlan(metaPlan)
        ? metaPlan
        : planFromCode(str(planObject.plan_code), codes);
      if (!plan) return { type: "ignore" };
      // If Paystack names the plan, it must agree with our metadata.
      const codePlan = planFromCode(str(planObject.plan_code), codes);
      if (codePlan && codePlan !== plan) return { type: "ignore" };
      return { type: "activate", orgId, plan, customerRef };
    }
    case "subscription.create": {
      const subscriptionRef = str(data.subscription_code);
      if (!customerRef || !subscriptionRef) return { type: "ignore" };
      return { type: "subscription_created", customerRef, subscriptionRef };
    }
    case "invoice.payment_failed": {
      if (!customerRef) return { type: "ignore" };
      return { type: "payment_failed", customerRef };
    }
    case "subscription.disable":
    case "subscription.not_renew": {
      if (!customerRef) return { type: "ignore" };
      return { type: "canceled", customerRef };
    }
    default:
      return { type: "ignore" };
  }
}

export type CheckoutInput = {
  email: string;
  orgId: string;
  plan: PlanId;
  planCode: string;
  callbackUrl: string;
};

export async function initializeCheckout(
  input: CheckoutInput,
  options: { secretKey: string; fetchImpl?: typeof fetch },
): Promise<{ authorizationUrl: string; reference: string }> {
  const doFetch = options.fetchImpl ?? fetch;
  const response = await doFetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      // With a plan code Paystack uses the plan's amount; this is the fallback.
      amount: PLANS[input.plan].priceZarCents,
      currency: "ZAR",
      plan: input.planCode,
      callback_url: input.callbackUrl,
      metadata: { org_id: input.orgId, plan: input.plan },
    }),
  });

  const json = (await response.json().catch(() => null)) as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; reference?: string };
  } | null;

  if (!response.ok || !json?.status || !json.data?.authorization_url || !json.data.reference) {
    throw new Error(`Paystack checkout failed: ${json?.message ?? response.status}`);
  }
  return {
    authorizationUrl: json.data.authorization_url,
    reference: json.data.reference,
  };
}
