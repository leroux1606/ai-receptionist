export const CALL_OUTCOMES = [
  "booked",
  "message_taken",
  "callback_requested",
  "transferred",
  "unresolved",
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export type MappedBooking = {
  title: string | null;
  startsAt: string | null;
  endsAt: string | null;
  attendeeName: string | null;
  attendeeEmail: string | null;
  attendeePhone: string | null;
  notes: string | null;
  calendarEventId: string | null;
};

export type MappedCall = {
  providerCallId: string;
  callerNumber: string | null;
  callerName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  transcript: string | null;
  summary: string | null;
  outcome: CallOutcome;
  endedReason: string | null;
  recordingUrl: string | null;
  booking: MappedBooking | null;
  rawPayload: unknown;
};

export type BookingRow = {
  id: string;
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  attendee_name: string | null;
  attendee_email: string | null;
  attendee_phone: string | null;
  notes: string | null;
  calendar_event_id: string | null;
  created_at: string;
};

export type CallRow = {
  id: string;
  provider_call_id: string;
  caller_number: string | null;
  caller_name: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  summary: string | null;
  outcome: CallOutcome | null;
  ended_reason: string | null;
  recording_url: string | null;
  booking_id: string | null;
  created_at: string;
};

export type CallListItem = Omit<CallRow, "transcript">;

export type CallWithBooking = CallRow & {
  booking: BookingRow | null;
};
