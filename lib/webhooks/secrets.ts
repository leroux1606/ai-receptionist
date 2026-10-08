import { createHmac } from "node:crypto";
import { timingSafeEqualString } from "@/lib/webhooks/timing-safe";

// Each customer agent gets its own webhook secret, derived as
//   HMAC-SHA256(WEBHOOK_MASTER_KEY, agentId)
// so nothing secret is stored per tenant, there is nothing to rotate when a
// customer edits their agent, and one tenant's secret reveals nothing about
// another's. Rotating WEBHOOK_MASTER_KEY invalidates all secrets; re-save each
// agent (or run the re-sync script) to push the new ones to Vapi.

const MIN_KEY_LENGTH = 32;

function assertKey(masterKey: string): void {
  if (!masterKey || masterKey.length < MIN_KEY_LENGTH) {
    throw new Error(
      `WEBHOOK_MASTER_KEY must be at least ${MIN_KEY_LENGTH} characters (generate one with: openssl rand -base64 48)`,
    );
  }
}

export function deriveWebhookSecret(masterKey: string, agentId: string): string {
  assertKey(masterKey);
  return createHmac("sha256", masterKey).update(`vapi-webhook:${agentId}`).digest("base64url");
}

export function matchesWebhookSecret(
  presented: string | null,
  masterKey: string,
  agentId: string,
): boolean {
  if (!presented) {
    return false;
  }
  return timingSafeEqualString(presented, deriveWebhookSecret(masterKey, agentId));
}

/** Pulls the secret out of `Authorization: Bearer x` or a bare header value. */
export function extractPresentedSecret(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }
  const value = headerValue.startsWith("Bearer ")
    ? headerValue.slice("Bearer ".length)
    : headerValue;
  return value.length > 0 ? value : null;
}
