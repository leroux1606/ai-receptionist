import type { ServiceDecision } from "@/lib/billing/plans";

// Decides what to do with a business's phone line after a usage or billing
// change. Pure so the rules are tested; lib/server/enforce.ts applies them.

export const AUTO_PAUSE_PREFIX = "auto:";
export const CUSTOMER_PAUSE_DETAIL = "customer";

export type EnforcementAction = "pause" | "resume" | "none";

export function planEnforcement(input: {
  decision: ServiceDecision;
  agentStatus: "draft" | "provisioning" | "live" | "paused" | "error";
  statusDetail: string | null;
}): EnforcementAction {
  const { decision, agentStatus, statusDetail } = input;

  if (!decision.allowed) {
    return agentStatus === "live" ? "pause" : "none";
  }

  // Only undo pauses WE applied. A customer who paused their own line stays paused.
  if (agentStatus === "paused" && statusDetail?.startsWith(AUTO_PAUSE_PREFIX)) {
    return "resume";
  }
  return "none";
}

export function autoPauseDetail(
  decision: Extract<ServiceDecision, { allowed: false }>,
): string {
  return `${AUTO_PAUSE_PREFIX}${decision.reason}`;
}
