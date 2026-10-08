import { describe, expect, it } from "vitest";
import { isEndOfCallReport, mapEndOfCallReport } from "./vapi";
import {
  deriveWebhookSecret,
  extractPresentedSecret,
  matchesWebhookSecret,
} from "./secrets";

const endOfCallPayload = {
  message: {
    type: "end-of-call-report",
    endedReason: "customer-ended-call",
    startedAt: "2026-08-24T18:00:00.000Z",
    endedAt: "2026-08-24T18:03:12.000Z",
    durationSeconds: 192,
    summary: "Caller asked about whitening and booked a check-up.",
    call: {
      id: "call-123",
      status: "ended",
      customer: { number: "+27821234567" },
    },
    artifact: {
      transcript: "AI: Sunrise Dental, how can I help? User: I'd like a check-up.",
      recordingUrl: "https://recordings.example/call-123.wav",
      messages: [],
    },
    analysis: {
      summary: "Booked a check-up for Wednesday.",
      structuredData: {
        outcome: "booked",
        caller_name: "Thabo",
        booking: {
          title: "Check-up",
          starts_at: "2026-08-26T09:00:00.000Z",
          ends_at: "2026-08-26T09:30:00.000Z",
          attendee_name: "Thabo",
          attendee_email: "thabo@example.com",
          attendee_phone: "+27821234567",
          notes: "Prefers mornings",
          calendar_event_id: "evt-1",
        },
      },
    },
  },
};

describe("isEndOfCallReport", () => {
  it("returns true for end-of-call-report messages", () => {
    expect(isEndOfCallReport(endOfCallPayload)).toBe(true);
  });

  it("returns false for other message types", () => {
    expect(
      isEndOfCallReport({ message: { type: "status-update", status: "ended" } }),
    ).toBe(false);
  });
});

describe("mapEndOfCallReport", () => {
  it("maps caller, transcript, outcome and booking", () => {
    const mapped = mapEndOfCallReport(endOfCallPayload);

    expect(mapped.providerCallId).toBe("call-123");
    expect(mapped.callerNumber).toBe("+27821234567");
    expect(mapped.callerName).toBe("Thabo");
    expect(mapped.startedAt).toBe("2026-08-24T18:00:00.000Z");
    expect(mapped.endedAt).toBe("2026-08-24T18:03:12.000Z");
    expect(mapped.durationSeconds).toBe(192);
    expect(mapped.transcript).toContain("check-up");
    expect(mapped.summary).toBe("Booked a check-up for Wednesday.");
    expect(mapped.outcome).toBe("booked");
    expect(mapped.endedReason).toBe("customer-ended-call");
    expect(mapped.recordingUrl).toBe("https://recordings.example/call-123.wav");
    expect(mapped.booking).toEqual({
      title: "Check-up",
      startsAt: "2026-08-26T09:00:00.000Z",
      endsAt: "2026-08-26T09:30:00.000Z",
      attendeeName: "Thabo",
      attendeeEmail: "thabo@example.com",
      attendeePhone: "+27821234567",
      notes: "Prefers mornings",
      calendarEventId: "evt-1",
    });
  });

  it("defaults unknown outcomes to unresolved and tolerates no booking", () => {
    const mapped = mapEndOfCallReport({
      message: {
        type: "end-of-call-report",
        call: { id: "call-456" },
        analysis: { structuredData: { outcome: "won-the-lottery" } },
      },
    });

    expect(mapped.outcome).toBe("unresolved");
    expect(mapped.booking).toBeNull();
    expect(mapped.callerName).toBeNull();
  });

  it("accepts the transferred outcome", () => {
    const mapped = mapEndOfCallReport({
      message: {
        type: "end-of-call-report",
        call: { id: "call-t" },
        analysis: { structuredData: { outcome: "transferred" } },
      },
    });
    expect(mapped.outcome).toBe("transferred");
  });

  it("reads structured outputs from the artifact as well", () => {
    const mapped = mapEndOfCallReport({
      message: {
        type: "end-of-call-report",
        call: { id: "call-so" },
        artifact: {
          structuredOutputs: {
            abc: { result: { outcome: "message_taken", caller_name: "Lerato" } },
          },
        },
      },
    });
    expect(mapped.outcome).toBe("message_taken");
    expect(mapped.callerName).toBe("Lerato");
  });

  it("computes duration from timestamps when durationSeconds is missing", () => {
    const mapped = mapEndOfCallReport({
      message: {
        type: "end-of-call-report",
        startedAt: "2026-08-24T18:00:00.000Z",
        endedAt: "2026-08-24T18:02:00.000Z",
        call: { id: "call-789" },
      },
    });

    expect(mapped.durationSeconds).toBe(120);
  });

  it("rejects a report without a call id", () => {
    expect(() =>
      mapEndOfCallReport({ message: { type: "end-of-call-report", call: {} } }),
    ).toThrow("missing call.id");
  });
});

describe("per-agent webhook secrets", () => {
  const key = "k".repeat(48);

  it("derives a stable, url-safe secret per agent", () => {
    const a = deriveWebhookSecret(key, "agent-a");
    expect(a).toBe(deriveWebhookSecret(key, "agent-a"));
    expect(a).not.toBe(deriveWebhookSecret(key, "agent-b"));
    expect(a).toMatch(/^[A-Za-z0-9_-]{40,}$/);
  });

  it("changes every secret when the master key changes", () => {
    expect(deriveWebhookSecret(key, "agent-a")).not.toBe(
      deriveWebhookSecret("z".repeat(48), "agent-a"),
    );
  });

  it("accepts only the secret derived for that exact agent", () => {
    const secret = deriveWebhookSecret(key, "agent-a");
    expect(matchesWebhookSecret(secret, key, "agent-a")).toBe(true);
    expect(matchesWebhookSecret(secret, key, "agent-b")).toBe(false);
    expect(matchesWebhookSecret("wrong", key, "agent-a")).toBe(false);
    expect(matchesWebhookSecret(null, key, "agent-a")).toBe(false);
  });

  it("refuses a weak master key", () => {
    expect(() => deriveWebhookSecret("short", "agent-a")).toThrow("WEBHOOK_MASTER_KEY");
  });

  it("accepts a Bearer token or a bare header value", () => {
    expect(extractPresentedSecret("Bearer abc")).toBe("abc");
    expect(extractPresentedSecret("abc")).toBe("abc");
    expect(extractPresentedSecret(null)).toBeNull();
    expect(extractPresentedSecret("Bearer ")).toBeNull();
  });
});
