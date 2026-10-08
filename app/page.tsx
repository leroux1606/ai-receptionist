import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PAID_PLAN_IDS, PLANS, formatZar } from "@/lib/billing/plans";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Tell it about your business",
    body: "Add your opening hours, services and the answers to your most common questions. It takes about ten minutes.",
  },
  {
    title: "Forward your calls",
    body: "You get a dedicated number. Forward your business line to it when you are busy or closed. You keep your own number.",
  },
  {
    title: "Get a summary of every call",
    body: "Each call lands in your inbox and dashboard with who called, what they wanted and the full transcript.",
  },
];

const CAN_DO = [
  "Answer every call in seconds, day or night",
  "Answer common questions using only the information you provide",
  "Take messages with the caller's name and number",
  "Request appointments and pass the details to you",
  "Transfer urgent calls to you, if you choose",
];

const CANNOT_DO = [
  "It will not invent prices, availability or facts. If it does not know, it takes a message",
  "It does not see your diary. Appointments are requests for you to confirm",
  "It is not a replacement for a person on complex or sensitive calls",
];

const FAQ = [
  {
    q: "Do I need a new phone number?",
    a: "No. You get a separate number for your receptionist and forward your existing line to it. Most phones and providers support forwarding unanswered or all calls.",
  },
  {
    q: "Will callers know it is an AI?",
    a: "Yes. The receptionist introduces itself as a virtual assistant and answers honestly if asked. We think that is the right way to do it, and it builds trust.",
  },
  {
    q: "Are calls recorded?",
    a: "You choose. If recording is on, every caller is told the call may be recorded. You are responsible for meeting the rules that apply to your business.",
  },
  {
    q: "What happens when my free trial ends?",
    a: "Your receptionist stops answering until you choose a plan. We never charge you without you choosing a plan and paying.",
  },
  {
    q: "What if I go over my minutes?",
    a: "Paid plans keep answering. Extra minutes are billed at the rate shown on your plan.",
  },
];

export default function HomePage() {
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <span className="font-heading text-sm font-semibold tracking-tight">{BRAND.name}</span>
          <nav aria-label="Main" className="flex items-center gap-4 text-sm">
            <a href="#pricing" className="hidden text-muted-foreground hover:text-foreground sm:inline">
              Pricing
            </a>
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link href="/signup" className={cn(buttonVariants({ size: "sm" }))}>
              Start free trial
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
          <h1 className="font-heading max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Never miss a customer call again.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            {BRAND.name} is an AI receptionist for small businesses. It answers when you
            can&apos;t, takes messages, requests appointments and emails you a summary of every
            call, for a fraction of the cost of a human receptionist.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }))}>
              Start your free trial
            </Link>
            <span className="text-sm text-muted-foreground">
              14 days · 30 minutes of calls · no card needed
            </span>
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="mx-auto w-full max-w-5xl px-6 py-14">
            <h2 className="font-heading text-2xl tracking-tight">How it works</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Step {index + 1}</span>
                  <h3 className="font-medium">{step.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-6 py-14">
          <h2 className="font-heading text-2xl tracking-tight">What it does, and what it doesn&apos;t</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="font-medium">It will</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                {CAN_DO.map((item) => (
                  <li key={item}>✓ {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-medium">Good to know</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                {CANNOT_DO.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-t bg-muted/30">
          <div className="mx-auto w-full max-w-5xl px-6 py-14">
            <h2 className="font-heading text-2xl tracking-tight">Simple monthly pricing</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              In rand, month to month. Start free, upgrade when you are ready.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {PAID_PLAN_IDS.map((id) => {
                const plan = PLANS[id];
                return (
                  <div key={id} className="rounded-xl border bg-card p-5">
                    <h3 className="font-medium">{plan.label}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>
                    <p className="mt-4 text-3xl font-semibold">
                      {formatZar(plan.priceZarCents)}
                      <span className="text-sm font-normal text-muted-foreground"> / month</span>
                    </p>
                    <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
                      <li>{plan.includedMinutes} minutes of calls included</li>
                      {plan.overageZarCentsPerMinute ? (
                        <li>Extra minutes {formatZar(plan.overageZarCentsPerMinute)} each</li>
                      ) : null}
                      <li>Call summaries by email</li>
                      <li>Dashboard with transcripts</li>
                    </ul>
                  </div>
                );
              })}
            </div>
            <div className="mt-8">
              <Link href="/signup" className={cn(buttonVariants())}>
                Start your free trial
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-3xl px-6 py-14">
          <h2 className="font-heading text-2xl tracking-tight">Questions</h2>
          <dl className="mt-6 space-y-6">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="font-medium">{item.q}</dt>
                <dd className="mt-1 text-sm leading-6 text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {BRAND.company}
          </span>
          <nav aria-label="Legal" className="flex gap-4">
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-foreground">Contact</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
