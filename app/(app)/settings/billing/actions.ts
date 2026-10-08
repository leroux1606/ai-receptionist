"use server";

import { redirect } from "next/navigation";
import { isPaidPlan } from "@/lib/billing/plans";
import { initializeCheckout, planCodesFromEnv } from "@/lib/billing/paystack";
import { getPaystackSecretKey, getPublicBaseUrl, isPaystackConfigured } from "@/lib/config";
import { getContext } from "@/lib/org/current";

export type CheckoutState = { error: string | null };

export async function startCheckout(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const plan = String(formData.get("plan") ?? "");
  if (!isPaidPlan(plan)) {
    return { error: "Choose a plan." };
  }
  if (!isPaystackConfigured()) {
    return { error: "Online payment is not switched on yet. Please contact support." };
  }

  const planCode = planCodesFromEnv(process.env)[plan];
  if (!planCode) {
    return { error: "That plan is not available yet. Please contact support." };
  }

  const { org, user } = await getContext();

  let url: string;
  try {
    const result = await initializeCheckout(
      {
        email: user.email,
        orgId: org.id,
        plan,
        planCode,
        callbackUrl: `${getPublicBaseUrl()}/settings/billing?checkout=done`,
      },
      { secretKey: getPaystackSecretKey() },
    );
    url = result.authorizationUrl;
  } catch (error) {
    console.error("checkout failed", error);
    return { error: "We could not start the payment. Please try again." };
  }

  redirect(url);
}
