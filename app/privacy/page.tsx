import Link from "next/link";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "Privacy policy" };

// TEMPLATE ONLY. Not legal advice. Have a South African attorney review this
// (POPIA) and update the sub-processor list before launch.
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        Draft template for review by your attorney before launch. It is not legal advice.
      </p>
      <h1 className="font-heading mt-6 text-3xl tracking-tight">Privacy policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: [date]</p>

      <div className="mt-8 space-y-6 text-sm leading-6">
        <section>
          <h2 className="font-medium">Who is responsible</h2>
          <p>
            For your own account data, {BRAND.company} is the responsible party. For the calls
            your receptionist handles, you (our customer) are the responsible party for your
            callers&apos; personal information and we process it on your behalf as an operator.
          </p>
        </section>
        <section>
          <h2 className="font-medium">What we collect</h2>
          <ul className="list-disc pl-5">
            <li>Account details: your email address and business information.</li>
            <li>
              Call data for your business: the caller&apos;s phone number, the name they give,
              a transcript and summary, any appointment details and, if you turn it on, the
              recording.
            </li>
            <li>Billing details are handled by our payment provider; we do not store card numbers.</li>
          </ul>
        </section>
        <section>
          <h2 className="font-medium">Why we use it</h2>
          <p>
            To run the service for you: answering calls, sending you summaries, billing and
            keeping the service secure. We do not sell personal information.
          </p>
        </section>
        <section>
          <h2 className="font-medium">Who we share it with</h2>
          <p>
            Service providers that help us run the service, such as voice and telephony
            (Vapi, Twilio), speech and language processing, database hosting (Supabase), email
            delivery (Resend) and payments (Paystack). [Your attorney should confirm this list,
            the countries data is processed in, and the transfer safeguards.]
          </p>
        </section>
        <section>
          <h2 className="font-medium">How long we keep it</h2>
          <p>[Retention period to be decided, for example call recordings and transcripts for 90 days, unless you delete them sooner.]</p>
        </section>
        <section>
          <h2 className="font-medium">Your rights</h2>
          <p>
            You can ask us to access, correct or delete your information at{" "}
            <a className="underline" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.
          </p>
        </section>
      </div>
      <p className="mt-10 text-sm">
        <Link href="/" className="underline underline-offset-4">Back to home</Link>
      </p>
    </main>
  );
}
