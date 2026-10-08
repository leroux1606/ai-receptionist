// Server-side configuration. Read lazily so `next build` and tests work with
// no secrets present; each getter throws a clear message only when used.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

export function getPublicBaseUrl(): string {
  return required("APP_URL").replace(/\/+$/, "");
}

export function getWebhookMasterKey(): string {
  return required("WEBHOOK_MASTER_KEY");
}

export function isVapiConfigured(): boolean {
  return Boolean(process.env.VAPI_API_KEY && process.env.VAPI_VOICE_ID);
}

export function getVapiConfig() {
  return {
    apiKey: required("VAPI_API_KEY"),
    model: process.env.VAPI_MODEL || "gpt-4o-mini",
    voiceId: required("VAPI_VOICE_ID"),
    voiceProvider: process.env.VAPI_VOICE_PROVIDER || "11labs",
  };
}

export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

export function getPaystackSecretKey(): string {
  return required("PAYSTACK_SECRET_KEY");
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}
