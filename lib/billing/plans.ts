// Plan catalogue and usage rules.
//
// ALL NUMBERS HERE ARE STARTING ASSUMPTIONS, not validated prices. Voice AI
// costs roughly R2-R4 per minute all-in (telephony + speech-to-text + LLM +
// voice + platform fee). Check your real per-minute cost on a month of calls
// before you publish prices. See docs/PRICING.md.

export const PLAN_IDS = ["trial", "starter", "pro", "business"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export type Plan = {
  id: PlanId;
  label: string;
  /** Monthly price in ZAR cents. 0 for the trial. */
  priceZarCents: number;
  includedMinutes: number;
  /** Price per extra minute in ZAR cents. null = hard cap, no overage. */
  overageZarCentsPerMinute: number | null;
  blurb: string;
};

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    label: "Free trial",
    priceZarCents: 0,
    includedMinutes: 30,
    overageZarCentsPerMinute: null,
    blurb: "14 days, 30 minutes, no card needed.",
  },
  starter: {
    id: "starter",
    label: "Starter",
    priceZarCents: 89900,
    includedMinutes: 100,
    overageZarCentsPerMinute: 900,
    blurb: "For sole traders and very small teams.",
  },
  pro: {
    id: "pro",
    label: "Pro",
    priceZarCents: 199900,
    includedMinutes: 300,
    overageZarCentsPerMinute: 800,
    blurb: "For busy practices, salons, clinics and trades.",
  },
  business: {
    id: "business",
    label: "Business",
    priceZarCents: 449900,
    includedMinutes: 800,
    overageZarCentsPerMinute: 700,
    blurb: "For multi-staff businesses with high call volume.",
  },
};

export const PAID_PLAN_IDS: PlanId[] = ["starter", "pro", "business"];

export function isPlanId(value: unknown): value is PlanId {
  return PLAN_IDS.includes(value as PlanId);
}

export function isPaidPlan(value: unknown): value is PlanId {
  return PAID_PLAN_IDS.includes(value as PlanId);
}

/** Each call is billed per started minute (rounded up). */
export function billableMinutes(durationSeconds: number | null | undefined): number {
  if (!durationSeconds || durationSeconds <= 0) {
    return 0;
  }
  return Math.ceil(durationSeconds / 60);
}

/**
 * Where to start counting minutes. Trials are capped in total, so they count
 * from the day the trial began (otherwise a trial that straddles a month end
 * would get its allowance twice). Paid plans count the calendar month (UTC).
 */
export function usagePeriodStart(input: {
  plan: PlanId;
  createdAt: Date;
  now?: Date;
}): Date {
  if (input.plan === "trial") {
    return input.createdAt;
  }
  const now = input.now ?? new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export type UsageLevel = "ok" | "near_limit" | "over_limit";

export type UsageSummary = {
  includedMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  overageMinutes: number;
  overageZarCents: number;
  percentUsed: number;
  level: UsageLevel;
};

export function summariseUsage(planId: PlanId, usedMinutes: number): UsageSummary {
  const plan = PLANS[planId];
  const used = Math.max(0, Math.floor(usedMinutes));
  const overageMinutes = Math.max(0, used - plan.includedMinutes);
  const overageZarCents =
    plan.overageZarCentsPerMinute == null
      ? 0
      : overageMinutes * plan.overageZarCentsPerMinute;
  const percentUsed =
    plan.includedMinutes === 0
      ? 100
      : Math.min(100, Math.round((used / plan.includedMinutes) * 100));

  let level: UsageLevel = "ok";
  if (used >= plan.includedMinutes) {
    level = "over_limit";
  } else if (percentUsed >= 80) {
    level = "near_limit";
  }

  return {
    includedMinutes: plan.includedMinutes,
    usedMinutes: used,
    remainingMinutes: Math.max(0, plan.includedMinutes - used),
    overageMinutes,
    overageZarCents,
    percentUsed,
    level,
  };
}

export type ServiceDecision =
  | { allowed: true }
  | { allowed: false; reason: "trial_expired" | "trial_minutes_used" | "payment_required" | "canceled" };

/**
 * Should this business's AI line keep answering calls?
 * Paying customers are never cut off for going over their minutes (they are
 * billed overage). Trials are hard-capped. Unpaid or canceled accounts stop.
 */
export function decideService(input: {
  plan: PlanId;
  status: SubscriptionStatus;
  trialEndsAt: Date;
  usedMinutes: number;
  now?: Date;
}): ServiceDecision {
  const now = input.now ?? new Date();

  if (input.status === "canceled") {
    return { allowed: false, reason: "canceled" };
  }
  if (input.status === "past_due") {
    return { allowed: false, reason: "payment_required" };
  }
  if (input.plan === "trial") {
    if (now.getTime() > input.trialEndsAt.getTime()) {
      return { allowed: false, reason: "trial_expired" };
    }
    if (input.usedMinutes >= PLANS.trial.includedMinutes) {
      return { allowed: false, reason: "trial_minutes_used" };
    }
  }
  return { allowed: true };
}

export function formatZar(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const rands = Math.floor(abs / 100);
  const remainder = abs % 100;
  const grouped = String(rands).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const fraction = remainder === 0 ? "" : `.${String(remainder).padStart(2, "0")}`;
  return `${sign}R${grouped}${fraction}`;
}
