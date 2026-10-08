import Link from "next/link";
import { OutcomeBadge } from "@/components/calls/outcome-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDateTime,
  formatDuration,
  formatPhone,
} from "@/lib/calls/format";
import type { CallListItem } from "@/lib/calls/types";

export function CallList({
  calls,
  emptyHint,
}: {
  calls: CallListItem[];
  emptyHint?: string;
}) {
  if (calls.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-16 text-center">
        <p className="text-sm font-medium">No calls yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {emptyHint ?? "Calls answered by your receptionist will appear here."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Caller</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead className="hidden lg:table-cell">Summary</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => (
            <TableRow key={call.id} className="relative">
              <TableCell className="whitespace-nowrap text-muted-foreground">
                <Link
                  href={`/calls/${call.id}`}
                  className="absolute inset-0 z-10"
                  aria-label={`Open call from ${formatPhone(call.caller_number)}`}
                />
                {formatDateTime(call.started_at)}
              </TableCell>
              <TableCell className="pointer-events-none font-medium">
                {call.caller_name ?? formatPhone(call.caller_number)}
                {call.caller_name ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {formatPhone(call.caller_number)}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="pointer-events-none">
                <OutcomeBadge outcome={call.outcome} />
              </TableCell>
              <TableCell className="pointer-events-none">
                {formatDuration(call.duration_seconds)}
              </TableCell>
              <TableCell className="pointer-events-none hidden max-w-md truncate text-muted-foreground lg:table-cell">
                {call.summary ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
