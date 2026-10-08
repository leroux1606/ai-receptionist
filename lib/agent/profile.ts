// The business profile a customer fills in. This is the single source of
// truth for what their AI receptionist knows and how it behaves.

export const MAX_FAQS = 20;
/** Number of question/answer rows shown in the settings form. */
export const FAQ_SLOTS = 8;
export const MAX_FIELD_LENGTH = 2000;
export const MAX_SHORT_LENGTH = 200;

export const LANGUAGES = {
  en: "English",
} as const;
export type LanguageCode = keyof typeof LANGUAGES;

export type Faq = { question: string; answer: string };

export type BusinessProfile = {
  businessName: string;
  industry: string;
  timezone: string;
  businessHours: string;
  services: string;
  faqs: Faq[];
  bookingInstructions: string;
  /** E.164 number the AI can transfer urgent calls to. Optional. */
  transferNumber: string;
  /** Where message and call summaries are emailed. */
  notifyEmail: string;
  language: LanguageCode;
  recordCalls: boolean;
};

export const EMPTY_PROFILE: BusinessProfile = {
  businessName: "",
  industry: "",
  timezone: "Africa/Johannesburg",
  businessHours: "",
  services: "",
  faqs: [],
  bookingInstructions: "",
  transferNumber: "",
  notifyEmail: "",
  language: "en",
  recordCalls: true,
};

const E164 = /^\+[1-9]\d{6,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Toll-fraud guard: a customer could point "transfer urgent calls" at a
 * premium-rate or foreign number and then ring their own line to run up our
 * bill. Transfers are limited to these country prefixes and exclude South
 * African premium-rate ranges. Widen deliberately, after thinking about fraud.
 */
export const ALLOWED_TRANSFER_PREFIXES = ["+27"];
const BLOCKED_TRANSFER_PREFIXES = ["+27860", "+27861", "+27862", "+27899", "+2790"];

export function isAllowedTransferNumber(value: string): boolean {
  return (
    isValidE164(value) &&
    ALLOWED_TRANSFER_PREFIXES.some((prefix) => value.startsWith(prefix)) &&
    !BLOCKED_TRANSFER_PREFIXES.some((prefix) => value.startsWith(prefix))
  );
}

export function isValidE164(value: string): boolean {
  return E164.test(value);
}

export function isValidEmail(value: string): boolean {
  return EMAIL.test(value);
}

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") {
    return "";
  }
  // Collapse control characters; keep newlines for multi-line fields.
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

/**
 * Normalises untrusted input (form data or stored JSON) into a profile.
 * Never throws; call `validateProfile` to find out what is wrong.
 */
export function normalizeProfile(input: Partial<Record<keyof BusinessProfile, unknown>>): BusinessProfile {
  const faqsRaw = Array.isArray(input.faqs) ? input.faqs : [];
  const faqs: Faq[] = [];
  for (const item of faqsRaw) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const question = clean(record.question, MAX_SHORT_LENGTH);
    const answer = clean(record.answer, MAX_FIELD_LENGTH);
    if (question && answer) {
      faqs.push({ question, answer });
    }
    if (faqs.length >= MAX_FAQS) break;
  }

  const language =
    typeof input.language === "string" && input.language in LANGUAGES
      ? (input.language as LanguageCode)
      : "en";

  return {
    businessName: clean(input.businessName, MAX_SHORT_LENGTH),
    industry: clean(input.industry, MAX_SHORT_LENGTH),
    timezone: clean(input.timezone, 64) || EMPTY_PROFILE.timezone,
    businessHours: clean(input.businessHours, MAX_FIELD_LENGTH),
    services: clean(input.services, MAX_FIELD_LENGTH),
    faqs,
    bookingInstructions: clean(input.bookingInstructions, MAX_FIELD_LENGTH),
    transferNumber: clean(input.transferNumber, 32).replace(/[\s()-]/g, ""),
    notifyEmail: clean(input.notifyEmail, 254).toLowerCase(),
    language,
    recordCalls: input.recordCalls === false ? false : true,
  };
}

export type ProfileIssue = { field: keyof BusinessProfile; message: string };

/** Problems that make the saved values wrong (bad formats). */
export function validateProfile(profile: BusinessProfile): ProfileIssue[] {
  const issues: ProfileIssue[] = [];

  if (!profile.businessName) {
    issues.push({ field: "businessName", message: "Business name is required." });
  }
  if (profile.transferNumber && !isValidE164(profile.transferNumber)) {
    issues.push({
      field: "transferNumber",
      message: "Use international format, for example +27821234567.",
    });
  } else if (profile.transferNumber && !isAllowedTransferNumber(profile.transferNumber)) {
    issues.push({
      field: "transferNumber",
      message:
        "Transfers are only available to standard South African numbers (+27). Premium-rate and foreign numbers are not allowed.",
    });
  }
  if (profile.notifyEmail && !isValidEmail(profile.notifyEmail)) {
    issues.push({ field: "notifyEmail", message: "Enter a valid email address." });
  }
  return issues;
}

/** What is still missing before the agent can answer real calls. */
export function goLiveBlockers(profile: BusinessProfile): ProfileIssue[] {
  const blockers: ProfileIssue[] = [...validateProfile(profile)];
  if (!profile.businessHours) {
    blockers.push({
      field: "businessHours",
      message: "Tell the receptionist your opening hours.",
    });
  }
  if (!profile.services) {
    blockers.push({
      field: "services",
      message: "Describe what your business does so callers get correct answers.",
    });
  }
  if (!profile.notifyEmail) {
    blockers.push({
      field: "notifyEmail",
      message: "Add the email address where you want messages sent.",
    });
  }
  return blockers;
}
