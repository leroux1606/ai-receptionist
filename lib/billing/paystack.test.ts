import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  initializeCheckout,
  interpretPaystackEvent,
  planCodesFromEnv,
  verifyPaystackSignature,
} from "./paystack";

const codes = { starter: "PLN_s", pro: "PLN_p", business: "PLN_b" };

describe("verifyPaystackSignature", () => {
  const body = JSON.stringify({ event: "charge.success" });
  const good = createHmac("sha512", "sk_test").update(body).digest("hex");

  it("accepts the right signature", () => {
    expect(verifyPaystackSignature(body, good, "sk_test")).toBe(true);
  });

  it("rejects a tampered body, a wrong key, or no signature", () => {
    expect(verifyPaystackSignature(body + " ", good, "sk_test")).toBe(false);
    expect(verifyPaystackSignature(body, good, "sk_other")).toBe(false);
    expect(verifyPaystackSignature(body, null, "sk_test")).toBe(false);
    expect(verifyPaystackSignature(body, good, "")).toBe(false);
  });
});

describe("planCodesFromEnv", () => {
  it("reads the three plan codes", () => {
    expect(
      planCodesFromEnv({
        PAYSTACK_PLAN_STARTER: "a",
        PAYSTACK_PLAN_PRO: "b",
        PAYSTACK_PLAN_BUSINESS: "c",
      }),
    ).toEqual({ starter: "a", pro: "b", business: "c" });
  });
});

describe("interpretPaystackEvent", () => {
  const charge = (extra: object = {}) => ({
    event: "charge.success",
    data: {
      customer: { customer_code: "CUS_1" },
      metadata: { org_id: "org-1", plan: "pro" },
      plan: { plan_code: "PLN_p" },
      ...extra,
    },
  });

  it("activates the plan named in our own checkout metadata", () => {
    expect(interpretPaystackEvent(charge(), codes)).toEqual({
      type: "activate",
      orgId: "org-1",
      plan: "pro",
      customerRef: "CUS_1",
    });
  });

  it("ignores a charge whose plan code disagrees with the metadata", () => {
    expect(
      interpretPaystackEvent(charge({ plan: { plan_code: "PLN_b" } }), codes),
    ).toEqual({ type: "ignore" });
  });

  it("ignores charges that are not for one of our checkouts", () => {
    expect(
      interpretPaystackEvent(charge({ metadata: {} }), codes),
    ).toEqual({ type: "ignore" });
    expect(
      interpretPaystackEvent(charge({ metadata: { org_id: "o", plan: "trial" }, plan: {} }), codes),
    ).toEqual({ type: "ignore" });
  });

  it("links the subscription code to the customer", () => {
    expect(
      interpretPaystackEvent(
        {
          event: "subscription.create",
          data: { subscription_code: "SUB_1", customer: { customer_code: "CUS_1" } },
        },
        codes,
      ),
    ).toEqual({ type: "subscription_created", customerRef: "CUS_1", subscriptionRef: "SUB_1" });
  });

  it("flags failed payments and cancellations by customer", () => {
    const customer = { customer_code: "CUS_1" };
    expect(
      interpretPaystackEvent({ event: "invoice.payment_failed", data: { customer } }, codes),
    ).toEqual({ type: "payment_failed", customerRef: "CUS_1" });
    expect(
      interpretPaystackEvent({ event: "subscription.disable", data: { customer } }, codes),
    ).toEqual({ type: "canceled", customerRef: "CUS_1" });
  });

  it("ignores unknown events and malformed bodies", () => {
    expect(interpretPaystackEvent({ event: "transfer.success", data: {} }, codes)).toEqual({ type: "ignore" });
    expect(interpretPaystackEvent(null, codes)).toEqual({ type: "ignore" });
    expect(interpretPaystackEvent("nope", codes)).toEqual({ type: "ignore" });
  });
});

describe("initializeCheckout", () => {
  it("posts the plan and org metadata and returns the hosted checkout url", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: true,
          data: { authorization_url: "https://checkout.paystack.com/x", reference: "ref-1" },
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const result = await initializeCheckout(
      { email: "a@b.co", orgId: "org-1", plan: "starter", planCode: "PLN_s", callbackUrl: "https://app/x" },
      { secretKey: "sk", fetchImpl },
    );

    expect(result).toEqual({ authorizationUrl: "https://checkout.paystack.com/x", reference: "ref-1" });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.paystack.co/transaction/initialize");
    const sent = JSON.parse(init.body as string);
    expect(sent).toMatchObject({
      email: "a@b.co",
      currency: "ZAR",
      plan: "PLN_s",
      metadata: { org_id: "org-1", plan: "starter" },
    });
  });

  it("throws a clear error when Paystack refuses", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ status: false, message: "Invalid key" }), { status: 401 }),
    ) as unknown as typeof fetch;
    await expect(
      initializeCheckout(
        { email: "a@b.co", orgId: "o", plan: "pro", planCode: "p", callbackUrl: "u" },
        { secretKey: "sk", fetchImpl },
      ),
    ).rejects.toThrow("Invalid key");
  });
});
