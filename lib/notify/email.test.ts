import { describe, expect, it, vi } from "vitest";
import type { MappedCall } from "@/lib/calls/types";
import { buildCallEmail, sendEmail } from "./email";

const call: MappedCall = {
  providerCallId: "c1",
  callerNumber: "+27821234567",
  callerName: "Thabo",
  startedAt: null,
  endedAt: null,
  durationSeconds: 90,
  transcript: null,
  summary: "Wants a check-up on Wednesday morning.",
  outcome: "booked",
  endedReason: null,
  recordingUrl: null,
  booking: {
    title: "Check-up",
    startsAt: "2026-10-14T09:00:00Z",
    endsAt: null,
    attendeeName: "Thabo",
    attendeeEmail: null,
    attendeePhone: "+27821234567",
    notes: "Prefers mornings",
    calendarEventId: null,
  },
  rawPayload: {},
};

describe("buildCallEmail", () => {
  it("leads with the outcome and caller, and includes the summary and link", () => {
    const { subject, text } = buildCallEmail({
      businessName: "Sunrise Dental",
      call,
      dashboardUrl: "https://app.example.com/calls/1",
    });
    expect(subject).toBe("Appointment requested: Thabo (Sunrise Dental)");
    expect(text).toContain("Wants a check-up on Wednesday morning.");
    expect(text).toContain("Number: +27821234567");
    expect(text).toContain("https://app.example.com/calls/1");
    expect(text).toContain("Prefers mornings");
  });

  it("falls back gracefully with no name, summary or booking", () => {
    const { subject, text } = buildCallEmail({
      businessName: "Acme",
      call: { ...call, callerName: null, callerNumber: null, summary: null, booking: null, outcome: "unresolved" },
      dashboardUrl: "https://x/y",
    });
    expect(subject).toBe("Call ended: Unknown caller (Acme)");
    expect(text).toContain("No summary was produced");
    expect(text).not.toContain("Appointment details");
    expect(text).not.toMatch(/undefined|null/);
  });
});

describe("sendEmail", () => {
  it("posts to Resend with bearer auth", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    await sendEmail({ to: "a@b.co", subject: "s", text: "t" }, { apiKey: "k", from: "x@y.co", fetchImpl });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    expect(JSON.parse(init.body as string)).toMatchObject({ from: "x@y.co", to: ["a@b.co"] });
  });

  it("throws when the provider rejects", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 403 })) as unknown as typeof fetch;
    await expect(
      sendEmail({ to: "a@b.co", subject: "s", text: "t" }, { apiKey: "k", from: "x", fetchImpl }),
    ).rejects.toThrow("403");
  });
});
