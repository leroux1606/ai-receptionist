import { notFound } from "next/navigation";
import { CallDetail } from "@/components/calls/call-detail";
import { getCall } from "@/lib/calls/queries";

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const call = await getCall(id);

  if (!call) {
    notFound();
  }

  return <CallDetail call={call} />;
}
