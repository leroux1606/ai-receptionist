import { describe, expect, it, vi } from "vitest";
import { normalizeProfile } from "@/lib/agent/profile";
import {
  VapiError,
  buildAssistantPayload,
  createVapiClient,
  webhookUrl,
} from "./client";

const profile = normalizeProfile({
  businessName: "Sunrise Dental",
  businessHours: "Mon-Fri 08:00-17:00",
  services: "General dentistry",
  notifyEmail: "reception@sunrise.co.za",
});

const settings = {
  publicBaseUrl: "https://app.example.com/",
  agentId: "agent-1",
  webhookSecret: "s3cret",
  model: "gpt-test",
  voiceId: "voice-1",
};

describe("webhookUrl", () => {
  it("builds a per-agent url without double slashes", () => {
    expect(webhookUrl("https://app.example.com/", "agent-1")).toBe(
      "https://app.example.com/api/webhooks/vapi/agent-1",
    );
  });
});

describe("buildAssistantPayload", () => {
  const payload = buildAssistantPayload(profile, settings);

  it("points the server at this agent's webhook with its own secret", () => {
    expect(payload.server.url).toBe("https://app.example.com/api/webhooks/vapi/agent-1");
    expect(payload.server.headers.Authorization).toBe("Bearer s3cret");
    expect(payload.serverMessages).toEqual(["end-of-call-report"]);
  });

  it("carries the business prompt and greeting", () => {
    expect(payload.firstMessage).toContain("Sunrise Dental");
    expect(payload.model.messages[0].content).toContain("Mon-Fri 08:00-17:00");
    expect(payload.model.model).toBe("gpt-test");
    expect(payload.voice.voiceId).toBe("voice-1");
  });

  it("asks Vapi for the outcome and booking we store", () => {
    const schema = payload.analysisPlan.structuredDataPlan.schema;
    expect(schema.properties.outcome.enum).toContain("transferred");
    expect(schema.properties.booking.properties.attendee_phone).toBeDefined();
  });

  it("only adds a transfer tool when a transfer number exists", () => {
    expect("tools" in payload.model).toBe(false);
    const withTransfer = buildAssistantPayload(
      { ...profile, transferNumber: "+27821234567" },
      settings,
    );
    const tools = (withTransfer.model as { tools?: { destinations: { number: string }[] }[] }).tools;
    expect(tools?.[0].destinations[0].number).toBe("+27821234567");
  });

  it("respects the recording preference", () => {
    expect(payload.artifactPlan.recordingEnabled).toBe(true);
    const off = buildAssistantPayload({ ...profile, recordCalls: false }, settings);
    expect(off.artifactPlan.recordingEnabled).toBe(false);
  });
});

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), { status }),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe("createVapiClient", () => {
  it("creates an assistant with bearer auth and returns its id", async () => {
    const fetchImpl = mockFetch(201, { id: "asst-1" });
    const client = createVapiClient({ apiKey: "key", fetchImpl });
    const result = await client.createAssistant({ name: "x" });

    expect(result).toEqual({ id: "asst-1" });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.vapi.ai/assistant");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer key");
    expect(JSON.parse(init.body as string)).toEqual({ name: "x" });
  });

  it("patches a phone number to attach and detach an assistant", async () => {
    const fetchImpl = mockFetch(200, {});
    const client = createVapiClient({ apiKey: "key", fetchImpl });
    await client.setNumberAssistant("num-1", "asst-1");
    await client.setNumberAssistant("num-1", null);

    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
    expect(calls[0][0]).toBe("https://api.vapi.ai/phone-number/num-1");
    expect(JSON.parse(calls[0][1].body as string)).toEqual({ assistantId: "asst-1" });
    expect(JSON.parse(calls[1][1].body as string)).toEqual({ assistantId: null });
  });

  it("throws a VapiError carrying status and body on failure", async () => {
    const client = createVapiClient({
      apiKey: "key",
      fetchImpl: mockFetch(400, { message: "bad voice" }),
    });
    await expect(client.createAssistant({})).rejects.toMatchObject({
      name: "VapiError",
      status: 400,
      body: { message: "bad voice" },
    });
  });

  it("rejects a success response with no assistant id", async () => {
    const client = createVapiClient({ apiKey: "key", fetchImpl: mockFetch(200, {}) });
    await expect(client.createAssistant({})).rejects.toBeInstanceOf(VapiError);
  });
});
