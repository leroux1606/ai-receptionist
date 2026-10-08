import { describe, expect, it } from "vitest";
import { normalizeProfile } from "./profile";
import { buildFirstMessage, buildSystemPrompt } from "./prompt";

const profile = normalizeProfile({
  businessName: "Sunrise Dental",
  industry: "dental practice",
  businessHours: "Mon-Fri 08:00-17:00",
  services: "General dentistry and whitening.",
  notifyEmail: "reception@sunrise.co.za",
  faqs: [{ question: "Do you take medical aid?", answer: "Yes, most schemes." }],
});

describe("buildFirstMessage", () => {
  it("names the business, admits to being virtual and mentions recording", () => {
    const message = buildFirstMessage(profile);
    expect(message).toContain("Sunrise Dental");
    expect(message).toContain("virtual assistant");
    expect(message).toContain("may be recorded");
  });

  it("omits the recording notice when recording is off", () => {
    const message = buildFirstMessage({ ...profile, recordCalls: false });
    expect(message).not.toContain("recorded");
  });
});

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt(profile);

  it("includes the business facts the caller may ask about", () => {
    expect(prompt).toContain("Sunrise Dental");
    expect(prompt).toContain("dental practice");
    expect(prompt).toContain("Mon-Fri 08:00-17:00");
    expect(prompt).toContain("General dentistry and whitening.");
    expect(prompt).toContain("Q: Do you take medical aid?");
    expect(prompt).toContain("A: Yes, most schemes.");
  });

  it("forbids invented answers and requires an honest AI disclosure", () => {
    expect(prompt).toContain("Never make up information");
    expect(prompt).toContain("You are an AI assistant");
  });

  it("never leaves a placeholder behind", () => {
    expect(prompt).not.toMatch(/undefined|null|\[object/);
  });

  it("says it cannot transfer when no transfer number is set", () => {
    expect(prompt).toContain("You cannot transfer calls");
  });

  it("offers transfer only with consent when a number exists", () => {
    const withTransfer = buildSystemPrompt({ ...profile, transferNumber: "+27821234567" });
    expect(withTransfer).toContain("Only transfer when they agree");
    expect(withTransfer).not.toContain("You cannot transfer calls");
  });

  it("omits the approved-answers section when there are no faqs", () => {
    expect(buildSystemPrompt({ ...profile, faqs: [] })).not.toContain("Approved answers");
  });

  it("tells the agent to take a message when hours are missing", () => {
    const sparse = buildSystemPrompt({ ...profile, businessHours: "" });
    expect(sparse).toContain("Do not state opening hours");
  });
});
