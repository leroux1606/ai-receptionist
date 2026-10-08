import { describe, expect, it } from "vitest";
import {
  EMPTY_PROFILE,
  MAX_FAQS,
  goLiveBlockers,
  isAllowedTransferNumber,
  normalizeProfile,
  validateProfile,
} from "./profile";

const complete = normalizeProfile({
  businessName: "Sunrise Dental",
  businessHours: "Mon-Fri 08:00-17:00",
  services: "General dentistry, whitening, check-ups.",
  notifyEmail: "Reception@Sunrise.co.za ",
});

describe("normalizeProfile", () => {
  it("trims, lowercases the email and applies defaults", () => {
    expect(complete.notifyEmail).toBe("reception@sunrise.co.za");
    expect(complete.timezone).toBe("Africa/Johannesburg");
    expect(complete.language).toBe("en");
    expect(complete.recordCalls).toBe(true);
  });

  it("strips spaces from phone numbers and control characters from text", () => {
    const profile = normalizeProfile({
      businessName: "Acme\u0000 Plumbing",
      transferNumber: "+27 82 123 4567",
    });
    expect(profile.businessName).toBe("Acme Plumbing");
    expect(profile.transferNumber).toBe("+27821234567");
  });

  it("drops incomplete faqs and caps the list", () => {
    const faqs = Array.from({ length: MAX_FAQS + 5 }, (_, i) => ({
      question: `Q${i}`,
      answer: `A${i}`,
    }));
    const profile = normalizeProfile({
      faqs: [{ question: "no answer", answer: "" }, ...faqs, "junk", null],
    });
    expect(profile.faqs).toHaveLength(MAX_FAQS);
    expect(profile.faqs[0].question).toBe("Q0");
  });

  it("falls back to English for unknown languages", () => {
    expect(normalizeProfile({ language: "klingon" }).language).toBe("en");
  });

  it("only turns recording off when explicitly false", () => {
    expect(normalizeProfile({ recordCalls: false }).recordCalls).toBe(false);
    expect(normalizeProfile({}).recordCalls).toBe(true);
  });

  it("returns a full profile for empty input", () => {
    expect(normalizeProfile({})).toEqual(EMPTY_PROFILE);
  });
});

describe("validateProfile", () => {
  it("accepts a good profile", () => {
    expect(validateProfile(complete)).toEqual([]);
  });

  it("flags bad phone numbers and emails", () => {
    const issues = validateProfile({
      ...complete,
      transferNumber: "0821234567",
      notifyEmail: "not-an-email",
    });
    expect(issues.map((i) => i.field).sort()).toEqual(["notifyEmail", "transferNumber"]);
  });
});

describe("goLiveBlockers", () => {
  it("is empty for a complete profile", () => {
    expect(goLiveBlockers(complete)).toEqual([]);
  });

  it("lists what is missing", () => {
    const fields = goLiveBlockers(
      normalizeProfile({ businessName: "Acme" }),
    ).map((b) => b.field);
    expect(fields).toEqual(["businessHours", "services", "notifyEmail"]);
  });
});

describe("transfer number fraud guard", () => {
  it("allows ordinary South African mobile and landline numbers", () => {
    expect(isAllowedTransferNumber("+27821234567")).toBe(true);
    expect(isAllowedTransferNumber("+27215550123")).toBe(true);
  });

  it("blocks foreign and premium-rate destinations", () => {
    expect(isAllowedTransferNumber("+447911123456")).toBe(false);
    expect(isAllowedTransferNumber("+12025550123")).toBe(false);
    expect(isAllowedTransferNumber("+27900123456")).toBe(false);
    expect(isAllowedTransferNumber("+27860123456")).toBe(false);
    expect(isAllowedTransferNumber("+27899123456")).toBe(false);
  });

  it("is reported as a validation issue with a clear message", () => {
    const issues = validateProfile({ ...complete, transferNumber: "+447911123456" });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("South African");
  });
});
