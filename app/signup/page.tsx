import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignupForm } from "@/app/signup/signup-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Start your free trial" };

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Start your free trial</CardTitle>
          <CardDescription>
            14 days, 30 minutes of calls, no card needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSupabaseConfigured() ? (
            <SignupForm />
          ) : (
            <p className="text-sm text-muted-foreground">
              Sign-up is not available until Supabase is configured.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
