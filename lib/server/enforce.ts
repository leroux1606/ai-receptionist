import "server-only";
import {
  decideService,
  usagePeriodStart,
  type PlanId,
  type SubscriptionStatus,
} from "@/lib/billing/plans";
import { getVapiConfig, isVapiConfigured } from "@/lib/config";
import { autoPauseDetail, planEnforcement } from "@/lib/provisioning/enforce";
import { pauseAgent, resumeAgent } from "@/lib/provisioning/go-live";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createVapiClient } from "@/lib/vapi/client";
import { createProvisioningStore, snapshotFromRow, type AgentRow } from "@/lib/server/agents";

type OrgRow = {
  id: string;
  plan: PlanId;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string;
  created_at: string;
};

export async function getOrgMinutesUsed(
  org: Pick<OrgRow, "id" | "plan" | "created_at">,
): Promise<number> {
  const { data, error } = await createServiceRoleClient().rpc("org_minutes_used", {
    p_org: org.id,
    p_since: usagePeriodStart({ plan: org.plan, createdAt: new Date(org.created_at) }).toISOString(),
  });
  if (error) {
    throw new Error(`Failed to read usage: ${error.message}`);
  }
  return Number(data ?? 0);
}

/**
 * Re-evaluates one business: pauses its phone line if the trial ended, the
 * minutes ran out or a payment failed, and resumes lines WE paused once the
 * account is healthy again. Safe to call as often as you like.
 */
export async function enforceServiceForOrg(orgId: string): Promise<"paused" | "resumed" | "unchanged"> {
  const supabase = createServiceRoleClient();

  const [{ data: org }, { data: agent }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, plan, subscription_status, trial_ends_at, created_at")
      .eq("id", orgId)
      .maybeSingle(),
    supabase.from("agents").select("*").eq("org_id", orgId).maybeSingle(),
  ]);

  if (!org || !agent || !isVapiConfigured()) {
    return "unchanged";
  }

  const orgRow = org as OrgRow;
  const agentRow = agent as AgentRow;
  const decision = decideService({
    plan: orgRow.plan,
    status: orgRow.subscription_status,
    trialEndsAt: new Date(orgRow.trial_ends_at),
    usedMinutes: await getOrgMinutesUsed(orgRow),
  });

  const action = planEnforcement({
    decision,
    agentStatus: agentRow.status,
    statusDetail: agentRow.status_detail,
  });
  if (action === "none") {
    return "unchanged";
  }

  const deps = {
    vapi: createVapiClient({ apiKey: getVapiConfig().apiKey }),
    store: createProvisioningStore(),
  };
  const snapshot = snapshotFromRow(agentRow);

  if (action === "pause" && !decision.allowed) {
    await pauseAgent(snapshot, deps, autoPauseDetail(decision));
    return "paused";
  }
  if (action === "resume") {
    return (await resumeAgent(snapshot, deps)) ? "resumed" : "unchanged";
  }
  return "unchanged";
}
