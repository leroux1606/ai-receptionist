import Link from "next/link";
import { OutcomeBadge } from "@/components/calls/outcome-badge";
import { Transcript } from "@/components/calls/transcript";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatDateTime,
  formatDuration,
  formatPhone,
} from "@/lib/calls/format";
import type { CallWithBooking } from "@/lib/calls/types";
import { cn } from "@/lib/utils";

export function CallDetail({ call }: { call: CallWithBooking }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <Link href="/calls" className="hover:text-foreground">
              Calls
            </Link>
            <span className="mx-2">/</span>
            {formatPhone(call.caller_number)}
          </p>
          <h1 className="font-heading text-2xl tracking-tight">
            {call.caller_name ?? formatPhone(call.caller_number)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {call.caller_name ? `${formatPhone(call.caller_number)} · ` : ""}
            {formatDateTime(call.started_at)} · {formatDuration(call.duration_seconds)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OutcomeBadge outcome={call.outcome} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Outcome</CardTitle>
            <CardDescription>
              {call.ended_reason ? `Ended: ${call.ended_reason}` : "No end reason recorded"}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-6">
            {call.summary ?? "No summary was stored for this call."}
          </CardContent>
        </Card>

        {call.booking ? (
          <Card>
            <CardHeader>
              <CardTitle>Booking</CardTitle>
              <CardDescription>
                {call.booking.title ?? "Appointment requested during the call"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>{formatDateTime(call.booking.starts_at)}</p>
              {call.booking.attendee_name ? <p>{call.booking.attendee_name}</p> : null}
              {call.booking.attendee_phone ? (
                <p className="text-muted-foreground">{call.booking.attendee_phone}</p>
              ) : null}
              {call.booking.attendee_email ? (
                <p className="text-muted-foreground">{call.booking.attendee_email}</p>
              ) : null}
              {call.booking.notes ? (
                <p className="text-muted-foreground">{call.booking.notes}</p>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Booking</CardTitle>
              <CardDescription>None created on this call</CardDescription>
            </CardHeader>
            <CardContent>
              {call.recording_url ? (
                <a
                  href={call.recording_url}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open recording
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">No recording URL stored.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {call.booking && call.recording_url ? (
        <a
          href={call.recording_url}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
          target="_blank"
          rel="noreferrer"
        >
          Open recording
        </a>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          <Transcript transcript={call.transcript} />
        </CardContent>
      </Card>
    </div>
  );
}
