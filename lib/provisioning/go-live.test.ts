import { describe, expect, it, vi } from "vitest";
import { normalizeProfile } from "@/lib/agent/profile";
import type { VapiClient } from "@/lib/vapi/client";
import { deriveWebhookSecret } from "@/lib/webhooks/secrets";
import {
  goLive,
  pauseAgent,
  type AgentSnapshot,
  type ProvisioningPatch,
  type ProvisioningStore,
} from "./go-live";

const config = {
  publicBaseUrl: "https://app.example.com",
  model: "gpt-test",
  voiceId: "voice-1",
  webhookMasterKey: "m".repeat(48),
};

function setup(overrides: Partial<AgentSnapshot> = {}) {
  const saved: ProvisioningPatch[] = [];
  const store: ProvisioningStore = {
    save: vi.fn(async (_id, patch) => {
      saved.push(patch);
    }),
    claimNumber: vi.fn(async () => ({
      e164: "+27105550100",
      vapiPhoneNumberId: "num-1",
    })),
  };
  const vapi: VapiClient = {
    createAssistant: vi.fn(async () => ({ id: "asst-1" })),
    updateAssistant: vi.fn(async () => undefined),
    deleteAssistant: vi.fn(async () => undefined),
    setNumberAssistant: vi.fn(async () => undefined),
  };
  const agent: AgentSnapshot = {
    id: "agent-1",
    profile: normalizeProfile({
      businessName: "Sunrise Dental",
      businessHours: "Mon-Fri 08:00-17:00",
      services: "General dentistry",
      notifyEmail: "reception@sunrise.co.za",
    }),
    vapiAssistantId: null,
    vapiPhoneNumberId: null,
    phoneNumber: null,
    ...overrides,
  };
  return { agent, store, vapi, saved };
}

describe("goLive", () => {
  it("refuses to go live with an incomplete profile and touches nothing", async () => {
    const { agent, store, vapi } = setup({
      profile: normalizeProfile({ businessName: "Acme" }),
    });
    const result = await goLive(agent, { vapi, store, config });

    expect(result).toMatchObject({ ok: false, reason: "incomplete_profile" });
    expect(vapi.createAssistant).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
  });

  it("creates the assistant, claims a number, attaches it and marks live", async () => {
    const { agent, store, vapi, saved } = setup();
    const result = await goLive(agent, { vapi, store, config });

    expect(result).toEqual({ ok: true, phoneNumber: "+27105550100" });
    expect(vapi.createAssistant).toHaveBeenCalledOnce();
    expect(vapi.setNumberAssistant).toHaveBeenCalledWith("num-1", "asst-1");
    expect(saved[0]).toMatchObject({ status: "provisioning" });
    expect(saved.at(-1)).toMatchObject({
      status: "live",
      phoneNumber: "+27105550100",
      vapiPhoneNumberId: "num-1",
    });
  });

  it("gives Vapi the derived per-agent secret and never stores it", async () => {
    const { agent, store, vapi, saved } = setup();
    await goLive(agent, { vapi, store, config });

    const payload = (vapi.createAssistant as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      server: { headers: { Authorization: string } };
    };
    const secret = payload.server.headers.Authorization.replace("Bearer ", "");
    expect(secret).toBe(deriveWebhookSecret(config.webhookMasterKey, "agent-1"));
    expect(JSON.stringify(saved)).not.toContain(secret);
  });

  it("keeps the same secret when a live agent is updated", async () => {
    const first = setup();
    await goLive(first.agent, { vapi: first.vapi, store: first.store, config });
    const second = setup({ vapiAssistantId: "asst-1" });
    await goLive(second.agent, { vapi: second.vapi, store: second.store, config });

    const secretOf = (call: unknown) =>
      (call as { server: { headers: { Authorization: string } } }).server.headers.Authorization;
    const created = (first.vapi.createAssistant as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const updated = (second.vapi.updateAssistant as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(secretOf(updated)).toBe(secretOf(created));
  });

  it("updates the existing assistant instead of creating a duplicate", async () => {
    const { agent, store, vapi } = setup({ vapiAssistantId: "asst-existing" });
    await goLive(agent, { vapi, store, config });

    expect(vapi.createAssistant).not.toHaveBeenCalled();
    expect(vapi.updateAssistant).toHaveBeenCalledWith("asst-existing", expect.any(Object));
    expect(vapi.setNumberAssistant).toHaveBeenCalledWith("num-1", "asst-existing");
  });

  it("records the assistant id before claiming a number, so failures leave no orphan", async () => {
    const { agent, store, vapi, saved } = setup();
    (store.claimNumber as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("no free phone numbers in the pool"),
    );
    const result = await goLive(agent, { vapi, store, config });

    expect(result).toEqual({
      ok: false,
      reason: "failed",
      message: "no free phone numbers in the pool",
    });
    expect(saved.some((p) => p.vapiAssistantId === "asst-1")).toBe(true);
    expect(saved.at(-1)).toMatchObject({
      status: "error",
      statusDetail: "no free phone numbers in the pool",
    });
  });

  it("reports a Vapi failure and parks the agent in error", async () => {
    const { agent, store, vapi, saved } = setup();
    (vapi.createAssistant as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Vapi POST /assistant failed with 401"),
    );
    const result = await goLive(agent, { vapi, store, config });

    expect(result).toMatchObject({ ok: false, reason: "failed" });
    expect(saved.at(-1)).toMatchObject({ status: "error" });
    expect(vapi.setNumberAssistant).not.toHaveBeenCalled();
  });
});

describe("pauseAgent", () => {
  it("detaches the number and marks the agent paused", async () => {
    const { store, vapi, saved } = setup();
    await pauseAgent({ id: "agent-1", vapiPhoneNumberId: "num-1" }, { vapi, store }, "payment_required");

    expect(vapi.setNumberAssistant).toHaveBeenCalledWith("num-1", null);
    expect(saved.at(-1)).toEqual({ status: "paused", statusDetail: "payment_required" });
  });

  it("still marks paused when the agent never had a number", async () => {
    const { store, vapi, saved } = setup();
    await pauseAgent({ id: "agent-1", vapiPhoneNumberId: null }, { vapi, store });

    expect(vapi.setNumberAssistant).not.toHaveBeenCalled();
    expect(saved.at(-1)).toMatchObject({ status: "paused" });
  });
});
