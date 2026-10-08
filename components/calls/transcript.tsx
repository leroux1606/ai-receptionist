import { ScrollArea } from "@/components/ui/scroll-area";

export function Transcript({ transcript }: { transcript: string | null }) {
  if (!transcript) {
    return (
      <p className="text-sm text-muted-foreground">
        No transcript was stored for this call.
      </p>
    );
  }

  return (
    <ScrollArea className="h-[min(28rem,70vh)] rounded-lg border bg-muted/30">
      <pre className="whitespace-pre-wrap px-4 py-3 font-mono text-[13px] leading-6 text-foreground">
        {transcript}
      </pre>
    </ScrollArea>
  );
}
