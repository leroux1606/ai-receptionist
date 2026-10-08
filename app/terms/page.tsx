import Link from "next/link";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "Terms of service" };

// TEMPLATE ONLY. Not legal advice. Have a South African attorney review and
// adapt this before accepting paying customers. See docs/LAUNCH_CHECKLIST.md.
export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        Draft template for review by your attorney before launch. It is not legal advice.
      </p>
      <h1 className="font-heading mt-6 text-3xl tracking-tight">Terms of service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: [date]</p>

      <div className="mt-8 space-y-6 text-sm leading-6">
        <section>
          <h2 className="font-medium">1. The service</h2>
          <p>
            {BRAND.name}, provided by {BRAND.company} (&ldquo;we&rdquo;), answers telephone calls
            for your business using artificial intelligence, takes messages, records appointment
            requests and sends you summaries. It is a tool to help you handle calls, not a
            substitute for your own judgement or for professional advice.
          </p>
        </section>
        <section>
          <h2 className="font-medium">2. Your responsibilities</h2>
          <p>
            You are responsible for the information you give your receptionist and for making
            sure it is accurate and lawful. You must tell your customers, where the law requires,
            that calls are handled by AI and may be recorded. You are responsible for complying
            with the laws that apply to your business and to recording and processing calls,
            including data protection law.
          </p>
        </section>
        <section>
          <h2 className="font-medium">3. Acceptable use</h2>
          <p>
            You may not use the service for unlawful, deceptive or abusive purposes, for emergency
            services, or to harass or mislead callers.
          </p>
        </section>
        <section>
          <h2 className="font-medium">4. Plans, billing and cancellation</h2>
          <p>
            Paid plans are billed monthly in South African rand through our payment provider.
            Included minutes are shown on your plan; extra minutes are billed at the stated rate
            after the month ends. You can cancel at any time and the service continues until the
            end of the period you have paid for. The free trial ends after 14 days or 30
            minutes, whichever comes first.
          </p>
        </section>
        <section>
          <h2 className="font-medium">5. Availability and accuracy</h2>
          <p>
            We work hard to keep the service running but cannot guarantee it will be uninterrupted
            or error free. AI can mishear or misunderstand. You should review call summaries and
            not rely on the service alone for urgent or safety-critical calls.
          </p>
        </section>
        <section>
          <h2 className="font-medium">6. Liability</h2>
          <p>[Limitation of liability clause to be drafted by your attorney.]</p>
        </section>
        <section>
          <h2 className="font-medium">7. Contact</h2>
          <p>
            Questions: <a className="underline" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
          </p>
        </section>
      </div>
      <p className="mt-10 text-sm">
        <Link href="/" className="underline underline-offset-4">Back to home</Link>
      </p>
    </main>
  );
}
