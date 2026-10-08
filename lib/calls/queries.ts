import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CallListItem, CallWithBooking } from "@/lib/calls/types";

export async function listCalls(limit = 200): Promise<CallListItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("calls")
    .select(
      "id, provider_call_id, caller_number, caller_name, started_at, ended_at, duration_seconds, summary, outcome, ended_reason, recording_url, booking_id, created_at",
    )
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list calls: ${error.message}`);
  }

  return data ?? [];
}

export async function getCall(id: string): Promise<CallWithBooking | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("calls")
    .select(
      "id, provider_call_id, caller_number, caller_name, started_at, ended_at, duration_seconds, transcript, summary, outcome, ended_reason, recording_url, booking_id, created_at, booking:bookings(*)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load call: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const bookingRaw = data.booking;
  const booking = Array.isArray(bookingRaw) ? (bookingRaw[0] ?? null) : bookingRaw;

  return {
    ...data,
    booking,
  };
}
