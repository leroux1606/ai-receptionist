"use client";

import { useActionState } from "react";
import { createBusiness, type OnboardingState } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: OnboardingState = { error: null };

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createBusiness, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="business_name">Business name</Label>
        <Input
          id="business_name"
          name="business_name"
          required
          maxLength={120}
          placeholder="Sunrise Dental"
          autoComplete="organization"
        />
        <p className="text-xs text-muted-foreground">
          This is how your receptionist will greet callers.
        </p>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Setting up…" : "Continue"}
      </Button>
    </form>
  );
}
