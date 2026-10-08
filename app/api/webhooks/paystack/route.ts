import { NextResponse } from "next/server";
import {
  interpretPaystackEvent,
  planCodesFromEnv,
  verifyPaystackSignature,
} from "@/lib/billing/paystack";
import { applyBillingAction } from "@/lib/server/billing";

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 500 });
  }

  // The signature covers the exact bytes, so verify before parsing.
  const raw = await request.text();
  if (!verifyPaystackSignature(raw, request.headers.get("x-paystack-signature"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await applyBillingAction(interpretPaystackEvent(body, planCodesFromEnv(process.env)));
  } catch (error) {
    // 500 makes Paystack retry, which is what we want for a transient failure.
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({});
}
