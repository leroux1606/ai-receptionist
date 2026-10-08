import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { PlanId, SubscriptionStatus } from "@/lib/billing/plans";
import type { AgentRow } from "@/lib/server/agents";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type OrgRow = {
  id: string;
  name: string;
  plan: PlanId;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string;
  created_at: string;
  billing_customer_ref: string | null;
};

/**
 * The signed-in user's business and agent. Redirects to login when signed
 * out and to onboarding when they have no business yet. Cached per request.
 * All reads go through the user's own client, so row level security is the
 * real tenant boundary.
 */
export const getContext = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  const [{ data: org }, { data: agent }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", membership.org_id).single(),
    supabase.from("agents").select("*").eq("org_id", membership.org_id).single(),
  ]);

  if (!org || !agent) {
    throw new Error("Your account is missing its business record. Contact support.");
  }

  return {
    supabase,
    user: { id: user.id, email: user.email ?? "" },
    org: org as OrgRow,
    agent: agent as AgentRow,
  };
});
