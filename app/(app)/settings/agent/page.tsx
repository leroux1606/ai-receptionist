import { AgentStatusBadge } from "@/components/app/agent-status";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getContext } from "@/lib/org/current";
import { profileFromRow } from "@/lib/server/agents";
import { AgentForm } from "./agent-form";
import { pauseMyLine, resumeMyLine } from "./actions";

export const metadata = { title: "Your receptionist" };

export default async function AgentSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const { agent } = await getContext();
  const profile = profileFromRow(agent);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl tracking-tight">Your receptionist</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This is everything your receptionist knows about your business.
          </p>
        </div>
        <AgentStatusBadge status={agent.status} />
      </div>

      {welcome ? (
        <Card>
          <CardHeader>
            <CardTitle>Step 2 of 2: tell it about your business</CardTitle>
            <CardDescription>
              Fill this in, then choose &ldquo;Save and go live&rdquo;. You can change anything later.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {agent.status === "error" && agent.status_detail ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">
          {agent.status_detail}
        </p>
      ) : null}

      {agent.phone_number ? (
        <Card>
          <CardHeader>
            <CardTitle>Your receptionist&apos;s number</CardTitle>
            <CardDescription>
              Forward your business line here. Call it yourself to hear how it sounds.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xl">{agent.phone_number}</p>
            {agent.status === "live" ? (
              <form action={pauseMyLine}>
                <Button type="submit" variant="outline" size="sm">
                  Pause receptionist
                </Button>
              </form>
            ) : agent.status === "paused" ? (
              agent.status_detail?.startsWith("auto:") ? (
                <p className="text-sm text-muted-foreground">
                  Paused because of your plan. See Plan &amp; billing.
                </p>
              ) : (
                <form action={resumeMyLine}>
                  <Button type="submit" size="sm">
                    Resume receptionist
                  </Button>
                </form>
              )
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <AgentForm initial={profile} isLive={agent.status === "live"} />
    </div>
  );
}
