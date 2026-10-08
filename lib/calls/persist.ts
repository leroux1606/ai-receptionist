import { createServiceRoleClient } from "@/lib/supabase/service";
import type { MappedCall } from "@/lib/calls/types";

export async function persistMappedCall(
  orgId: string,
  agentId: string,
  mapped: MappedCall,
): Promise<string> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.rpc("persist_call", {
    p_org_id: orgId,
    p_agent_id: agentId,
    p_provider_call_id: mapped.providerCallId,
    p_caller_number: mapped.callerNumber,
    p_caller_name: mapped.callerName,
    p_started_at: mapped.startedAt,
    p_ended_at: mapped.endedAt,
    p_duration_seconds: mapped.durationSeconds,
    p_transcript: mapped.transcript,
    p_summary: mapped.summary,
    p_outcome: mapped.outcome,
    p_ended_reason: mapped.endedReason,
    p_recording_url: mapped.recordingUrl,
    p_raw_payload: mapped.rawPayload,
    p_booking_title: mapped.booking?.title ?? null,
    p_booking_starts_at: mapped.booking?.startsAt ?? null,
    p_booking_ends_at: mapped.booking?.endsAt ?? null,
    p_booking_attendee_name: mapped.booking?.attendeeName ?? null,
    p_booking_attendee_email: mapped.booking?.attendeeEmail ?? null,
    p_booking_attendee_phone: mapped.booking?.attendeePhone ?? null,
    p_booking_notes: mapped.booking?.notes ?? null,
    p_booking_calendar_event_id: mapped.booking?.calendarEventId ?? null,
    p_has_booking: mapped.booking !== null,
  });

  if (error) {
    throw new Error(`Failed to persist call: ${error.message}`);
  }

  return data as string;
}
