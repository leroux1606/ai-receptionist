import type { MappedCall } from "@/lib/calls/types";

// Emails the business owner a short summary after every call. This is the
// moment the customer sees the value of the product, so it must be clear
// and must never include more than the owner needs.

const OUTCOME_LABEL: Record<MappedCall["outcome"], string> = {
  booked: "Appointment requested",
  message_taken: "Message taken",
  callback_requested: "Callback requested",
  transferred: "Call transferred to you",
  unresolved: "Call ended",
};

export function buildCallEmail(input: {
  businessName: string;
  call: MappedCall;
  dashboardUrl: string;
}): { subject: string; text: string } {
  const { call } = input;
  const who = call.callerName || call.callerNumber || "Unknown caller";
  const lines = [
    `${OUTCOME_LABEL[call.outcome]} - ${who}`,
    "",
    `Caller: ${call.callerName ?? "Not given"}`,
    `Number: ${call.callerNumber ?? "Not available"}`,
    "",
    call.summary ?? "No summary was produced for this call.",
  ];

  if (call.booking) {
    lines.push(
      "",
      "Appointment details:",
      ...(call.booking.title ? [`  ${call.booking.title}`] : []),
      ...(call.booking.startsAt ? [`  When: ${call.booking.startsAt}`] : []),
      ...(call.booking.attendeeName ? [`  Name: ${call.booking.attendeeName}`] : []),
      ...(call.booking.attendeePhone ? [`  Phone: ${call.booking.attendeePhone}`] : []),
      ...(call.booking.attendeeEmail ? [`  Email: ${call.booking.attendeeEmail}`] : []),
      ...(call.booking.notes ? [`  Notes: ${call.booking.notes}`] : []),
    );
  }

  lines.push("", `Full transcript: ${input.dashboardUrl}`);

  return {
    subject: `${OUTCOME_LABEL[call.outcome]}: ${who} (${input.businessName})`,
    text: lines.join("\n"),
  };
}

export async function sendEmail(
  message: { to: string; subject: string; text: string },
  options: { apiKey: string; from: string; fetchImpl?: typeof fetch },
): Promise<void> {
  const doFetch = options.fetchImpl ?? fetch;
  const response = await doFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: options.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email send failed with status ${response.status}`);
  }
}
