"use server";

import { revalidatePath } from "next/cache";
import {
  FAQ_SLOTS,
  goLiveBlockers,
  normalizeProfile,
  validateProfile,
  type BusinessProfile,
} from "@/lib/agent/profile";
import { decideService } from "@/lib/billing/plans";
import { getVapiConfig, getPublicBaseUrl, getWebhookMasterKey, isVapiConfigured } from "@/lib/config";
import { getContext } from "@/lib/org/current";
import { CUSTOMER_PAUSE_DETAIL } from "@/lib/provisioning/enforce";
import { goLive, pauseAgent, resumeAgent } from "@/lib/provisioning/go-live";
import { createProvisioningStore, loadAgentRow, snapshotFromRow } from "@/lib/server/agents";
import { getOrgMinutesUsed } from "@/lib/server/enforce";
import { createVapiClient } from "@/lib/vapi/client";

export type AgentFormState = {
  error: string | null;
  notice: string | null;
  issues: string[];
  /** Echo of what the user typed, so a failed save does not wipe the form. */
  profile: BusinessProfile | null;
};

const idle: AgentFormState = { error: null, notice: null, issues: [], profile: null };

function readProfile(formData: FormData): BusinessProfile {
  const faqs = Array.from({ length: FAQ_SLOTS }, (_, i) => ({
    question: String(formData.get(`faq_q_${i}`) ?? ""),
    answer: String(formData.get(`faq_a_${i}`) ?? ""),
  }));

  return normalizeProfile({
    businessName: String(formData.get("business_name") ?? ""),
    industry: String(formData.get("industry") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
    businessHours: String(formData.get("business_hours") ?? ""),
    services: String(formData.get("services") ?? ""),
    faqs,
    bookingInstructions: String(formData.get("booking_instructions") ?? ""),
    transferNumber: String(formData.get("transfer_number") ?? ""),
    notifyEmail: String(formData.get("notify_email") ?? ""),
    language: "en",
    recordCalls: formData.get("record_calls") === "on",
  });
}

export async function saveAgent(
  _prev: AgentFormState,
  formData: FormData,
): Promise<AgentFormState> {
  const { supabase, org, agent } = await getContext();
  const profile = readProfile(formData);
  const intent = String(formData.get("intent") ?? "save");

  const issues = validateProfile(profile);
  if (issues.length > 0) {
    return { ...idle, error: "Please fix the highlighted problems.", issues: issues.map((i) => i.message), profile };
  }

  const { error } = await supabase
    .from("agents")
    .update({
      business_name: profile.businessName,
      industry: profile.industry || null,
      timezone: profile.timezone,
      business_hours: profile.businessHours || null,
      services: profile.services || null,
      faqs: profile.faqs,
      booking_instructions: profile.bookingInstructions || null,
      transfer_number: profile.transferNumber || null,
      notify_email: profile.notifyEmail || null,
      language: profile.language,
      record_calls: profile.recordCalls,
    })
    .eq("id", agent.id);

  if (error) {
    return { ...idle, error: "We could not save your changes. Please try again.", profile };
  }

  revalidatePath("/settings/agent");
  revalidatePath("/dashboard");

  // A live line must pick up edits, otherwise the form lies about what callers hear.
  const shouldSync = intent === "live" || agent.status === "live";
  if (!shouldSync) {
    return { ...idle, notice: "Saved.", profile };
  }

  const blockers = goLiveBlockers(profile);
  if (blockers.length > 0) {
    return {
      ...idle,
      error: "Saved, but your receptionist can't go live yet.",
      issues: blockers.map((b) => b.message),
      profile,
    };
  }

  const decision = decideService({
    plan: org.plan,
    status: org.subscription_status,
    trialEndsAt: new Date(org.trial_ends_at),
    usedMinutes: await getOrgMinutesUsed(org),
  });
  if (!decision.allowed) {
    return {
      ...idle,
      error: "Saved, but your account can't take calls right now. Choose a plan on the billing page.",
      profile,
    };
  }

  if (!isVapiConfigured()) {
    return {
      ...idle,
      error: "Saved. Phone lines are not switched on for this service yet; please contact support.",
      profile,
    };
  }

  const fresh = await loadAgentRow(agent.id);
  if (!fresh) {
    return { ...idle, error: "Something went wrong. Please try again.", profile };
  }
  const snapshot = { ...snapshotFromRow(fresh), profile };

  const vapiConfig = getVapiConfig();
  const result = await goLive(snapshot, {
    vapi: createVapiClient({ apiKey: vapiConfig.apiKey }),
    store: createProvisioningStore(),
    config: {
      publicBaseUrl: getPublicBaseUrl(),
      model: vapiConfig.model,
      voiceId: vapiConfig.voiceId,
      voiceProvider: vapiConfig.voiceProvider,
      webhookMasterKey: getWebhookMasterKey(),
    },
  });

  revalidatePath("/settings/agent");
  revalidatePath("/dashboard");

  if (!result.ok) {
    return {
      ...idle,
      error:
        result.reason === "incomplete_profile"
          ? "Your receptionist can't go live yet."
          : "We saved your details but could not switch the line on. Our team has been notified.",
      issues: result.reason === "incomplete_profile" ? result.missing : [],
      profile,
    };
  }

  return {
    ...idle,
    notice:
      intent === "live"
        ? `Your receptionist is live on ${result.phoneNumber}.`
        : "Saved and updated on your live line.",
    profile,
  };
}

export async function pauseMyLine(): Promise<void> {
  const { agent } = await getContext();
  if (agent.status !== "live" || !isVapiConfigured()) return;

  const row = await loadAgentRow(agent.id);
  if (!row) return;
  await pauseAgent(
    snapshotFromRow(row),
    {
      vapi: createVapiClient({ apiKey: getVapiConfig().apiKey }),
      store: createProvisioningStore(),
    },
    CUSTOMER_PAUSE_DETAIL,
  );
  revalidatePath("/settings/agent");
  revalidatePath("/dashboard");
}

export async function resumeMyLine(): Promise<void> {
  const { org, agent } = await getContext();
  if (agent.status !== "paused" || !isVapiConfigured()) return;

  // Customers may un-pause themselves, but not past a billing or trial block.
  const decision = decideService({
    plan: org.plan,
    status: org.subscription_status,
    trialEndsAt: new Date(org.trial_ends_at),
    usedMinutes: await getOrgMinutesUsed(org),
  });
  if (!decision.allowed) return;

  const row = await loadAgentRow(agent.id);
  if (!row) return;
  await resumeAgent(snapshotFromRow(row), {
    vapi: createVapiClient({ apiKey: getVapiConfig().apiKey }),
    store: createProvisioningStore(),
  });
  revalidatePath("/settings/agent");
  revalidatePath("/dashboard");
}
