import { Badge } from "@/components/ui/badge";
import type { CallOutcome } from "@/lib/calls/types";

const LABELS: Record<CallOutcome, string> = {
  booked: "Booked",
  message_taken: "Message",
  callback_requested: "Callback",
  transferred: "Transferred",
  unresolved: "Unresolved",
};

export function OutcomeBadge({ outcome }: { outcome: CallOutcome | null }) {
  if (!outcome) {
    return <Badge variant="outline">Unknown</Badge>;
  }

  const variant = outcome === "booked" ? "default" : "secondary";

  return <Badge variant={variant}>{LABELS[outcome]}</Badge>;
}
