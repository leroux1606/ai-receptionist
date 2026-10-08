import { describe, expect, it } from "vitest";
import { autoPauseDetail, planEnforcement } from "./enforce";

const blocked = { allowed: false, reason: "payment_required" } as const;
const ok = { allowed: true } as const;

describe("planEnforcement", () => {
  it("pauses a live line that is no longer allowed", () => {
    expect(planEnforcement({ decision: blocked, agentStatus: "live", statusDetail: null })).toBe("pause");
  });

  it("leaves non-live lines alone when blocked", () => {
    for (const agentStatus of ["draft", "paused", "error", "provisioning"] as const) {
      expect(planEnforcement({ decision: blocked, agentStatus, statusDetail: null })).toBe("none");
    }
  });

  it("resumes a line WE paused once the account is fine again", () => {
    expect(
      planEnforcement({ decision: ok, agentStatus: "paused", statusDetail: "auto:payment_required" }),
    ).toBe("resume");
  });

  it("never resumes a line the customer paused themselves", () => {
    expect(
      planEnforcement({ decision: ok, agentStatus: "paused", statusDetail: "customer" }),
    ).toBe("none");
  });

  it("does nothing for a healthy live line", () => {
    expect(planEnforcement({ decision: ok, agentStatus: "live", statusDetail: null })).toBe("none");
  });
});

describe("autoPauseDetail", () => {
  it("tags the reason so we can tell automatic pauses from customer ones", () => {
    expect(autoPauseDetail(blocked)).toBe("auto:payment_required");
  });
});
