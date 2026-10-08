import { describe, expect, it } from "vitest";
import {
  PLANS,
  billableMinutes,
  decideService,
  formatZar,
  summariseUsage,
  usagePeriodStart,
} from "./plans";

describe("billableMinutes", () => {
  it("rounds each call up to the next whole minute", () => {
    expect(billableMinutes(1)).toBe(1);
    expect(billableMinutes(60)).toBe(1);
    expect(billableMinutes(61)).toBe(2);
    expect(billableMinutes(192)).toBe(4);
  });

  it("treats missing or negative durations as zero", () => {
    expect(billableMinutes(null)).toBe(0);
    expect(billableMinutes(undefined)).toBe(0);
    expect(billableMinutes(0)).toBe(0);
    expect(billableMinutes(-5)).toBe(0);
  });
});

describe("summariseUsage", () => {
  it("is ok well under the allowance", () => {
    const usage = summariseUsage("starter", 10);
    expect(usage.level).toBe("ok");
    expect(usage.remainingMinutes).toBe(90);
    expect(usage.overageMinutes).toBe(0);
    expect(usage.overageZarCents).toBe(0);
  });

  it("warns at 80 percent", () => {
    expect(summariseUsage("starter", 80).level).toBe("near_limit");
    expect(summariseUsage("starter", 79).level).toBe("ok");
  });

  it("charges overage on paid plans", () => {
    const usage = summariseUsage("starter", 112);
    expect(usage.level).toBe("over_limit");
    expect(usage.overageMinutes).toBe(12);
    expect(usage.overageZarCents).toBe(12 * PLANS.starter.overageZarCentsPerMinute!);
    expect(usage.percentUsed).toBe(100);
  });

  it("never charges overage on the trial (hard cap)", () => {
    const usage = summariseUsage("trial", 45);
    expect(usage.overageMinutes).toBe(15);
    expect(usage.overageZarCents).toBe(0);
  });

  it("clamps nonsense input", () => {
    expect(summariseUsage("pro", -3).usedMinutes).toBe(0);
    expect(summariseUsage("pro", 2.9).usedMinutes).toBe(2);
  });
});

describe("decideService", () => {
  const base = {
    plan: "trial" as const,
    status: "trialing" as const,
    trialEndsAt: new Date("2026-10-20T00:00:00Z"),
    usedMinutes: 0,
    now: new Date("2026-10-10T00:00:00Z"),
  };

  it("answers during a live trial", () => {
    expect(decideService(base)).toEqual({ allowed: true });
  });

  it("stops when the trial has expired", () => {
    expect(decideService({ ...base, now: new Date("2026-10-21T00:00:00Z") })).toEqual({
      allowed: false,
      reason: "trial_expired",
    });
  });

  it("stops when the trial minutes are used up", () => {
    expect(decideService({ ...base, usedMinutes: 30 })).toEqual({
      allowed: false,
      reason: "trial_minutes_used",
    });
  });

  it("keeps paying customers on past their allowance", () => {
    expect(
      decideService({ ...base, plan: "starter", status: "active", usedMinutes: 500 }),
    ).toEqual({ allowed: true });
  });

  it("stops unpaid and canceled accounts", () => {
    expect(decideService({ ...base, plan: "pro", status: "past_due" })).toEqual({
      allowed: false,
      reason: "payment_required",
    });
    expect(decideService({ ...base, plan: "pro", status: "canceled" })).toEqual({
      allowed: false,
      reason: "canceled",
    });
  });
});

describe("formatZar", () => {
  it("formats whole and fractional rand amounts", () => {
    expect(formatZar(89900)).toBe("R899");
    expect(formatZar(89950)).toBe("R899.50");
    expect(formatZar(0)).toBe("R0");
    expect(formatZar(449900)).toBe("R4 499");
  });
});

describe("usagePeriodStart", () => {
  const createdAt = new Date("2026-09-25T10:00:00Z");

  it("counts a trial from the day it began, even across a month end", () => {
    const start = usagePeriodStart({
      plan: "trial",
      createdAt,
      now: new Date("2026-10-03T00:00:00Z"),
    });
    expect(start.toISOString()).toBe("2026-09-25T10:00:00.000Z");
  });

  it("counts paid plans from the first of the current month (UTC)", () => {
    const start = usagePeriodStart({
      plan: "pro",
      createdAt,
      now: new Date("2026-10-17T13:45:00Z"),
    });
    expect(start.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});
