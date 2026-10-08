import { CallList } from "@/components/calls/call-list";
import { listCalls } from "@/lib/calls/queries";

export default async function CallsPage() {
  const calls = await listCalls();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl tracking-tight">Call log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every call your receptionist answers, with the summary, transcript and any appointment request.
        </p>
      </div>
      <CallList calls={calls} />
    </div>
  );
}
