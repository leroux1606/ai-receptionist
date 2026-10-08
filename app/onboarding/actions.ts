"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type OnboardingState = { error: string | null };

export async function createBusiness(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const name = String(formData.get("business_name") ?? "").trim();

  if (!name) {
    return { error: "Tell us your business name." };
  }
  if (name.length > 120) {
    return { error: "That name is too long." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("create_organization", {
    p_name: name,
    p_business_name: name,
  });

  // A double-submit or a second tab: they already have a business, carry on.
  if (error && !error.message.includes("already belongs")) {
    return { error: "We could not set up your business. Please try again." };
  }

  redirect("/settings/agent?welcome=1");
}
