import { Badge } from "@/components/ui/badge";
import type { AgentRow } from "@/lib/server/agents";

const LABEL: Record<AgentRow["status"], string> = {
  draft: "Not live yet",
  provisioning: "Setting up…",
  live: "Live and answering",
  paused: "Paused",
  error: "Needs attention",
};

export function AgentStatusBadge({ status }: { status: AgentRow["status"] }) {
  const variant = status === "live" ? "default" : status === "error" ? "destructive" : "secondary";
  return <Badge variant={variant}>{LABEL[status]}</Badge>;
}
