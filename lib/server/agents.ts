import "server-only";
import { normalizeProfile, type BusinessProfile } from "@/lib/agent/profile";
import type { AgentSnapshot, ProvisioningPatch, ProvisioningStore } from "@/lib/provisioning/go-live";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type AgentRow = {
  id: string;
  org_id: string;
  status: "draft" | "provisioning" | "live" | "paused" | "error";
  status_detail: string | null;
  business_name: string;
  industry: string | null;
  timezone: string;
  business_hours: string | null;
  services: string | null;
  faqs: unknown;
  booking_instructions: string | null;
  transfer_number: string | null;
  notify_email: string | null;
  language: string;
  record_calls: boolean;
  vapi_assistant_id: string | null;
  vapi_phone_number_id: string | null;
  phone_number: string | null;
};

export function profileFromRow(row: AgentRow): BusinessProfile {
  return normalizeProfile({
    businessName: row.business_name,
    industry: row.industry,
    timezone: row.timezone,
    businessHours: row.business_hours,
    services: row.services,
    faqs: row.faqs as never,
    bookingInstructions: row.booking_instructions,
    transferNumber: row.transfer_number,
    notifyEmail: row.notify_email,
    language: row.language,
    recordCalls: row.record_calls,
  });
}

export function snapshotFromRow(row: AgentRow): AgentSnapshot {
  return {
    id: row.id,
    profile: profileFromRow(row),
    vapiAssistantId: row.vapi_assistant_id,
    vapiPhoneNumberId: row.vapi_phone_number_id,
    phoneNumber: row.phone_number,
  };
}

export async function loadAgentRow(agentId: string): Promise<AgentRow | null> {
  const { data, error } = await createServiceRoleClient()
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load agent: ${error.message}`);
  }
  return (data as AgentRow | null) ?? null;
}

const COLUMN: Record<keyof ProvisioningPatch, string> = {
  status: "status",
  statusDetail: "status_detail",
  vapiAssistantId: "vapi_assistant_id",
  vapiPhoneNumberId: "vapi_phone_number_id",
  phoneNumber: "phone_number",
};

export function createProvisioningStore(): ProvisioningStore {
  const supabase = createServiceRoleClient();
  return {
    async save(agentId, patch) {
      const update: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(patch)) {
        update[COLUMN[key as keyof ProvisioningPatch]] = value;
      }
      const { error } = await supabase.from("agents").update(update).eq("id", agentId);
      if (error) {
        throw new Error(`Failed to save agent state: ${error.message}`);
      }
    },
    async claimNumber(agentId) {
      const { data, error } = await supabase.rpc("claim_phone_number", {
        p_agent_id: agentId,
      });
      if (error) {
        throw new Error(error.message);
      }
      const row = (data as { e164: string; vapi_phone_number_id: string }[] | null)?.[0];
      if (!row) {
        throw new Error("no free phone numbers in the pool");
      }
      return { e164: row.e164, vapiPhoneNumberId: row.vapi_phone_number_id };
    },
  };
}
