import { NextResponse } from "next/server";
import { buildCallEmail, sendEmail } from "@/lib/notify/email";
import { persistMappedCall } from "@/lib/calls/persist";
import { getPublicBaseUrl, getWebhookMasterKey, isEmailConfigured } from "@/lib/config";
import { enforceServiceForOrg } from "@/lib/server/enforce";
import { loadAgentRow } from "@/lib/server/agents";
import { isEndOfCallReport, mapEndOfCallReport } from "@/lib/webhooks/vapi";
import { extractPresentedSecret, matchesWebhookSecret } from "@/lib/webhooks/secrets";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;

  let masterKey: string;
  try {
    masterKey = getWebhookMasterKey();
  } catch {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 500 });
  }

  // Authenticate before touching the database, and answer unknown agents
  // exactly like bad secrets so ids cannot be probed.
  const presented = extractPresentedSecret(
    request.headers.get("authorization") ?? request.headers.get("x-vapi-secret"),
  );
  if (!UUID.test(agentId) || !matchesWebhookSecret(presented, masterKey, agentId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isEndOfCallReport(body)) {
    return NextResponse.json({});
  }

  try {
    const agent = await loadAgentRow(agentId);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mapped = mapEndOfCallReport(body);
    const callId = await persistMappedCall(agent.org_id, agent.id, mapped);

    // Best effort from here: the call is already saved. Failures are logged,
    // and return 200 so Vapi does not retry and double-send the email.
    if (agent.notify_email && isEmailConfigured()) {
      try {
        const { subject, text } = buildCallEmail({
          businessName: agent.business_name,
          call: mapped,
          dashboardUrl: `${getPublicBaseUrl()}/calls/${callId}`,
        });
        await sendEmail(
          { to: agent.notify_email, subject, text },
          { apiKey: process.env.RESEND_API_KEY!, from: process.env.EMAIL_FROM! },
        );
      } catch (error) {
        console.error("call email failed", error);
      }
    }

    try {
      await enforceServiceForOrg(agent.org_id);
    } catch (error) {
      console.error("service enforcement failed", error);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({});
}
