"use client";

import { useActionState } from "react";
import { saveAgent, type AgentFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FAQ_SLOTS, type BusinessProfile } from "@/lib/agent/profile";

const initialState: AgentFormState = { error: null, notice: null, issues: [], profile: null };

export function AgentForm({
  initial,
  isLive,
}: {
  initial: BusinessProfile;
  isLive: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveAgent, initialState);
  const profile = state.profile ?? initial;

  return (
    <form action={formAction} className="space-y-8" key={state.profile ? "echo" : "initial"}>
      <fieldset className="space-y-4">
        <legend className="font-heading text-lg tracking-tight">About your business</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="business_name">Business name</Label>
            <Input id="business_name" name="business_name" defaultValue={profile.businessName} required maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Type of business</Label>
            <Input id="industry" name="industry" defaultValue={profile.industry} placeholder="dental practice, plumber, salon…" maxLength={200} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="business_hours">Opening hours</Label>
          <Textarea id="business_hours" name="business_hours" defaultValue={profile.businessHours} placeholder={"Mon-Fri 08:00-17:00\nSat 08:00-12:00\nClosed Sundays and public holidays"} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="services">What you do</Label>
          <Textarea id="services" name="services" defaultValue={profile.services} placeholder="List your main services, areas you serve, anything a caller commonly asks about." className="min-h-32" />
          <p className="text-xs text-muted-foreground">
            Your receptionist only states what you write here. Anything else becomes a message for you.
          </p>
        </div>
        <input type="hidden" name="timezone" value={profile.timezone} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-heading text-lg tracking-tight">Common questions</legend>
        <p className="text-sm text-muted-foreground">
          Add the questions callers ask most, with the exact answer you want given. Leave unused rows empty.
        </p>
        {Array.from({ length: FAQ_SLOTS }, (_, i) => (
          <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`faq_q_${i}`} className="text-xs text-muted-foreground">Question {i + 1}</Label>
              <Input id={`faq_q_${i}`} name={`faq_q_${i}`} defaultValue={profile.faqs[i]?.question ?? ""} maxLength={200} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`faq_a_${i}`} className="text-xs text-muted-foreground">Answer {i + 1}</Label>
              <Textarea id={`faq_a_${i}`} name={`faq_a_${i}`} defaultValue={profile.faqs[i]?.answer ?? ""} className="min-h-10" />
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-heading text-lg tracking-tight">Bookings, messages and urgent calls</legend>
        <div className="space-y-2">
          <Label htmlFor="booking_instructions">How should appointments be handled?</Label>
          <Textarea id="booking_instructions" name="booking_instructions" defaultValue={profile.bookingInstructions} placeholder="e.g. Appointments are 30 minutes. Ask for the preferred day and time and say we will confirm by SMS." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="notify_email">Send messages to (email)</Label>
            <Input id="notify_email" name="notify_email" type="email" defaultValue={profile.notifyEmail} autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transfer_number">Transfer urgent calls to (optional)</Label>
            <Input id="transfer_number" name="transfer_number" type="tel" defaultValue={profile.transferNumber} placeholder="+27821234567" />
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm leading-5">
          <input type="checkbox" name="record_calls" defaultChecked={profile.recordCalls} className="mt-1" />
          <span>
            Record calls. Callers are told the call may be recorded. Check what the law requires
            of you before turning this off or on in your industry.
          </span>
        </label>
      </fieldset>

      {state.error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">
          <p className="font-medium text-destructive">{state.error}</p>
          {state.issues.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              {state.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {state.notice ? (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status">
          {state.notice}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="intent" value="save" variant="outline" disabled={pending}>
          {pending ? "Saving…" : isLive ? "Save and update live line" : "Save draft"}
        </Button>
        {!isLive ? (
          <Button type="submit" name="intent" value="live" disabled={pending}>
            {pending ? "Working…" : "Save and go live"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
