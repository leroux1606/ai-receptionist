import { goLiveBlockers, type BusinessProfile } from "@/lib/agent/profile";
import {
  buildAssistantPayload,
  type VapiClient,
} from "@/lib/vapi/client";
import { deriveWebhookSecret } from "@/lib/webhooks/secrets";

// Turns a customer's saved profile into a live phone line, and back off again.
// All side effects go through the injected `vapi` client and `store`, so every
// path (including failure halfway through) is unit tested with fakes.

export type AgentSnapshot = {
  id: string;
  profile: BusinessProfile;
  vapiAssistantId: string | null;
  vapiPhoneNumberId: string | null;
  phoneNumber: string | null;
};

export type ProvisioningPatch = Partial<{
  status: "draft" | "provisioning" | "live" | "paused" | "error";
  statusDetail: string | null;
  vapiAssistantId: string;
  vapiPhoneNumberId: string;
  phoneNumber: string;
}>;

export type ProvisioningStore = {
  save(agentId: string, patch: ProvisioningPatch): Promise<void>;
  /** Hands the agent a pooled number (idempotent), or throws if none are free. */
  claimNumber(agentId: string): Promise<{ e164: string; vapiPhoneNumberId: string }>;
};

export type ProvisioningConfig = {
  publicBaseUrl: string;
  model: string;
  voiceId: string;
  voiceProvider?: string;
  /** WEBHOOK_MASTER_KEY: per-agent webhook secrets are derived from it. */
  webhookMasterKey: string;
};

export type GoLiveResult =
  | { ok: true; phoneNumber: string }
  | { ok: false; reason: "incomplete_profile"; missing: string[] }
  | { ok: false; reason: "failed"; message: string };

export async function goLive(
  agent: AgentSnapshot,
  deps: { vapi: VapiClient; store: ProvisioningStore; config: ProvisioningConfig },
): Promise<GoLiveResult> {
  const blockers = goLiveBlockers(agent.profile);
  if (blockers.length > 0) {
    return {
      ok: false,
      reason: "incomplete_profile",
      missing: blockers.map((b) => b.message),
    };
  }

  await deps.store.save(agent.id, { status: "provisioning", statusDetail: null });

  try {
    // Derived, not stored: re-saving a live agent never changes its secret.
    const secret = deriveWebhookSecret(deps.config.webhookMasterKey, agent.id);
    const payload = buildAssistantPayload(agent.profile, {
      publicBaseUrl: deps.config.publicBaseUrl,
      agentId: agent.id,
      webhookSecret: secret,
      model: deps.config.model,
      voiceId: deps.config.voiceId,
      voiceProvider: deps.config.voiceProvider,
    });

    let assistantId = agent.vapiAssistantId;
    if (assistantId) {
      await deps.vapi.updateAssistant(assistantId, payload);
    } else {
      const created = await deps.vapi.createAssistant(payload);
      assistantId = created.id;
      // Persist immediately so a later failure cannot leak an orphan assistant.
      await deps.store.save(agent.id, { vapiAssistantId: assistantId });
    }

    const number = await deps.store.claimNumber(agent.id);
    await deps.vapi.setNumberAssistant(number.vapiPhoneNumberId, assistantId);

    await deps.store.save(agent.id, {
      status: "live",
      statusDetail: null,
      vapiPhoneNumberId: number.vapiPhoneNumberId,
      phoneNumber: number.e164,
    });

    return { ok: true, phoneNumber: number.e164 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await deps.store.save(agent.id, { status: "error", statusDetail: message });
    return { ok: false, reason: "failed", message };
  }
}

/**
 * Stops the line answering (unpaid, canceled or paused by the customer).
 * Callers get the carrier's normal behaviour for an unassigned number.
 */
export async function pauseAgent(
  agent: Pick<AgentSnapshot, "id" | "vapiPhoneNumberId">,
  deps: { vapi: VapiClient; store: ProvisioningStore },
  detail: string | null = null,
): Promise<void> {
  if (agent.vapiPhoneNumberId) {
    await deps.vapi.setNumberAssistant(agent.vapiPhoneNumberId, null);
  }
  await deps.store.save(agent.id, { status: "paused", statusDetail: detail });
}

/** Re-attaches a previously paused line. No-op if it never had an assistant. */
export async function resumeAgent(
  agent: Pick<AgentSnapshot, "id" | "vapiAssistantId" | "vapiPhoneNumberId">,
  deps: { vapi: VapiClient; store: ProvisioningStore },
): Promise<boolean> {
  if (!agent.vapiAssistantId || !agent.vapiPhoneNumberId) {
    return false;
  }
  await deps.vapi.setNumberAssistant(agent.vapiPhoneNumberId, agent.vapiAssistantId);
  await deps.store.save(agent.id, { status: "live", statusDetail: null });
  return true;
}
