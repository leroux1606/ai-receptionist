import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/app/login/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Welcome back. Your receptionist is on the job.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSupabaseConfigured() ? (
            <LoginForm />
          ) : (
            <p className="text-sm text-muted-foreground">
              Copy <code className="font-mono text-xs">.env.example</code> to{" "}
              <code className="font-mono text-xs">.env.local</code> and add your Supabase
              keys to enable sign-in.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
