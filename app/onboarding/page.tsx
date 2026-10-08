import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (membership) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Let&apos;s set up your receptionist</CardTitle>
          <CardDescription>
            Step 1 of 2. Next you&apos;ll tell it about your business.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
      </Card>
    </main>
  );
}
