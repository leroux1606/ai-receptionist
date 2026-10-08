import type { BusinessProfile } from "@/lib/agent/profile";
import { buildFirstMessage, buildSystemPrompt } from "@/lib/agent/prompt";
import { CALL_OUTCOMES } from "@/lib/calls/types";

// Thin adapter around the Vapi REST API. Everything Vapi-specific lives in
// this file so a change on their side is a one-file fix.
//
// UNVERIFIED AGAINST THE LIVE API: this was written without access to
// docs.vapi.ai. Field names follow Vapi's documented assistant/phone-number
// schema as best known. Before launch, run docs/LAUNCH_CHECKLIST.md step
// "Verify the Vapi adapter" with a real key; the payload builder is pure and
// unit tested, so any correction is a small edit here.

export class VapiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "VapiError";
  }
}

export type VapiAssistantSettings = {
  /** Public https URL of this app, no trailing slash. */
  publicBaseUrl: string;
  agentId: string;
  webhookSecret: string;
  /** LLM model name, e.g. from VAPI_MODEL. */
  model: string;
  /** Provider voice id, e.g. from VAPI_VOICE_ID. */
  voiceId: string;
  voiceProvider?: string;
};

export const STRUCTURED_DATA_SCHEMA = {
  type: "object",
  properties: {
    outcome: {
      type: "string",
      enum: [...CALL_OUTCOMES],
      description:
        "How the call ended: booked, message_taken, callback_requested, transferred or unresolved.",
    },
    caller_name: { type: "string", description: "The caller's name, if given." },
    booking: {
      type: "object",
      description: "Only present if the caller asked for an appointment.",
      properties: {
        title: { type: "string" },
        starts_at: { type: "string", description: "ISO 8601 date-time" },
        ends_at: { type: "string", description: "ISO 8601 date-time" },
        attendee_name: { type: "string" },
        attendee_email: { type: "string" },
        attendee_phone: { type: "string" },
        notes: { type: "string" },
      },
    },
  },
  required: ["outcome"],
} as const;

export function webhookUrl(publicBaseUrl: string, agentId: string): string {
  return `${publicBaseUrl.replace(/\/+$/, "")}/api/webhooks/vapi/${agentId}`;
}

/** Pure: the exact JSON we send to Vapi for a customer's assistant. */
export function buildAssistantPayload(
  profile: BusinessProfile,
  settings: VapiAssistantSettings,
) {
  const tools = profile.transferNumber
    ? [
        {
          type: "transferCall",
          destinations: [
            {
              type: "number",
              number: profile.transferNumber,
              message: "One moment, I'll put you through now.",
            },
          ],
        },
      ]
    : [];

  return {
    name: `${profile.businessName} receptionist`.slice(0, 40),
    firstMessage: buildFirstMessage(profile),
    model: {
      provider: "openai",
      model: settings.model,
      temperature: 0.3,
      messages: [{ role: "system", content: buildSystemPrompt(profile) }],
      ...(tools.length > 0 ? { tools } : {}),
    },
    voice: {
      provider: settings.voiceProvider ?? "11labs",
      voiceId: settings.voiceId,
    },
    transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
    server: {
      url: webhookUrl(settings.publicBaseUrl, settings.agentId),
      headers: { Authorization: `Bearer ${settings.webhookSecret}` },
    },
    serverMessages: ["end-of-call-report"],
    analysisPlan: {
      summaryPlan: { enabled: true },
      structuredDataPlan: { enabled: true, schema: STRUCTURED_DATA_SCHEMA },
    },
    artifactPlan: { recordingEnabled: profile.recordCalls },
    endCallFunctionEnabled: true,
    backgroundDenoisingEnabled: true,
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 900,
  };
}

export type VapiClient = {
  createAssistant(payload: object): Promise<{ id: string }>;
  updateAssistant(id: string, payload: object): Promise<void>;
  deleteAssistant(id: string): Promise<void>;
  /** Point a phone number at an assistant, or detach it with null. */
  setNumberAssistant(phoneNumberId: string, assistantId: string | null): Promise<void>;
};

export function createVapiClient(options: {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): VapiClient {
  const baseUrl = (options.baseUrl ?? "https://api.vapi.ai").replace(/\/+$/, "");
  const doFetch = options.fetchImpl ?? fetch;

  async function request(method: string, path: string, body?: object): Promise<unknown> {
    const response = await doFetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      throw new VapiError(
        `Vapi ${method} ${path} failed with ${response.status}`,
        response.status,
        parsed,
      );
    }
    return parsed;
  }

  return {
    async createAssistant(payload) {
      const result = (await request("POST", "/assistant", payload)) as { id?: unknown };
      if (typeof result?.id !== "string") {
        throw new VapiError("Vapi did not return an assistant id", 502, result);
      }
      return { id: result.id };
    },
    async updateAssistant(id, payload) {
      await request("PATCH", `/assistant/${encodeURIComponent(id)}`, payload);
    },
    async deleteAssistant(id) {
      await request("DELETE", `/assistant/${encodeURIComponent(id)}`);
    },
    async setNumberAssistant(phoneNumberId, assistantId) {
      await request("PATCH", `/phone-number/${encodeURIComponent(phoneNumberId)}`, {
        assistantId,
      });
    },
  };
}
