import {
  CALL_OUTCOMES,
  type CallOutcome,
  type MappedBooking,
  type MappedCall,
} from "@/lib/calls/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function isEndOfCallReport(
  body: unknown,
): body is { message: Record<string, unknown> } {
  return isRecord(body) && isRecord(body.message) && body.message.type === "end-of-call-report";
}

export function mapEndOfCallReport(body: unknown): MappedCall {
  if (!isEndOfCallReport(body)) {
    throw new Error("Not an end-of-call-report payload");
  }

  const message = body.message;
  const call = isRecord(message.call) ? message.call : {};
  const customer = isRecord(call.customer) ? call.customer : {};
  const artifact = isRecord(message.artifact) ? message.artifact : {};
  const recording = isRecord(artifact.recording) ? artifact.recording : {};
  const analysis = isRecord(message.analysis) ? message.analysis : {};
  const structured = extractStructuredData(message);

  const providerCallId = asString(call.id);
  if (!providerCallId) {
    throw new Error("end-of-call-report is missing call.id");
  }

  const startedAt = asString(message.startedAt) ?? asString(call.startedAt);
  const endedAt = asString(message.endedAt) ?? asString(call.endedAt);
  const durationSeconds =
    asNumber(message.durationSeconds) ?? durationFromRange(startedAt, endedAt);

  return {
    providerCallId,
    callerNumber: asString(customer.number) ?? asString(call.customerNumber),
    callerName: asString(structured.caller_name) ?? asString(structured.callerName),
    startedAt,
    endedAt,
    durationSeconds,
    transcript: asString(artifact.transcript) ?? asString(message.transcript),
    summary: asString(analysis.summary) ?? asString(message.summary),
    outcome: parseOutcome(structured.outcome),
    endedReason: asString(message.endedReason) ?? asString(call.endedReason),
    recordingUrl:
      asString(artifact.recordingUrl) ??
      asString(recording.url) ??
      asString(artifact.stereoRecordingUrl),
    booking: mapBooking(structured),
    rawPayload: body,
  };
}

function extractStructuredData(
  message: Record<string, unknown>,
): Record<string, unknown> {
  const analysis = isRecord(message.analysis) ? message.analysis : {};
  const merged: Record<string, unknown> = {
    ...(isRecord(analysis.structuredData) ? analysis.structuredData : {}),
  };

  const artifact = isRecord(message.artifact) ? message.artifact : {};
  const outputs = isRecord(artifact.structuredOutputs)
    ? artifact.structuredOutputs
    : {};

  for (const value of Object.values(outputs)) {
    if (!isRecord(value)) continue;
    const result = isRecord(value.result) ? value.result : value;
    Object.assign(merged, result);
  }

  return merged;
}

function parseOutcome(value: unknown): CallOutcome {
  return CALL_OUTCOMES.includes(value as CallOutcome)
    ? (value as CallOutcome)
    : "unresolved";
}

function mapBooking(structured: Record<string, unknown>): MappedBooking | null {
  const booking = isRecord(structured.booking) ? structured.booking : null;
  if (!booking) {
    return null;
  }

  const mapped: MappedBooking = {
    title: asString(booking.title),
    startsAt: asString(booking.starts_at) ?? asString(booking.startsAt),
    endsAt: asString(booking.ends_at) ?? asString(booking.endsAt),
    attendeeName:
      asString(booking.attendee_name) ?? asString(booking.attendeeName),
    attendeeEmail:
      asString(booking.attendee_email) ?? asString(booking.attendeeEmail),
    attendeePhone:
      asString(booking.attendee_phone) ?? asString(booking.attendeePhone),
    notes: asString(booking.notes),
    calendarEventId:
      asString(booking.calendar_event_id) ?? asString(booking.calendarEventId),
  };

  if (
    !mapped.title &&
    !mapped.startsAt &&
    !mapped.endsAt &&
    !mapped.attendeeName &&
    !mapped.attendeeEmail &&
    !mapped.attendeePhone &&
    !mapped.notes &&
    !mapped.calendarEventId
  ) {
    return null;
  }

  return mapped;
}

function durationFromRange(
  startedAt: string | null,
  endedAt: string | null,
): number | null {
  if (!startedAt || !endedAt) {
    return null;
  }

  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return null;
  }

  return Math.round((end - start) / 1000);
}
