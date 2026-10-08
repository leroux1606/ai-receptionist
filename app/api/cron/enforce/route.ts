import { NextResponse } from "next/server";
import { timingSafeEqualString } from "@/lib/webhooks/timing-safe";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { enforceServiceForOrg } from "@/lib/server/enforce";

// Hourly job (see vercel.json). Catches time-based changes no webhook will
// announce, such as a free trial running out of days.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const presented = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !timingSafeEqualString(presented, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("agents")
    .select("org_id")
    .in("status", ["live", "paused"]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = { paused: 0, resumed: 0, failed: 0 };
  for (const row of (data ?? []) as { org_id: string }[]) {
    try {
      const outcome = await enforceServiceForOrg(row.org_id);
      if (outcome === "paused") result.paused += 1;
      if (outcome === "resumed") result.resumed += 1;
    } catch (error) {
      result.failed += 1;
      console.error("enforce failed for org", row.org_id, error);
    }
  }
  return NextResponse.json(result);
}
