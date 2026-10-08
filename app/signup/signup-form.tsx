"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthState = { error: null, notice: null };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  if (state.notice) {
    return (
      <p className="text-sm leading-6" role="status">
        {state.notice}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
        <p className="text-xs text-muted-foreground">At least 10 characters.</p>
      </div>
      <label className="flex items-start gap-2 text-sm leading-5">
        <input type="checkbox" name="terms" className="mt-1" required />
        <span>
          I agree to the{" "}
          <Link href="/terms" className="underline underline-offset-4">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            privacy policy
          </Link>
          , including that calls to my receptionist are handled by AI and may be recorded.
        </span>
      </label>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Start free trial"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
