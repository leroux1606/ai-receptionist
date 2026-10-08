// One place to rename the product. Set NEXT_PUBLIC_BRAND_NAME and
// NEXT_PUBLIC_SUPPORT_EMAIL in the environment; no code changes needed.
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "Answerline",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com",
  company: process.env.NEXT_PUBLIC_COMPANY_NAME || "Your Company (Pty) Ltd",
};
