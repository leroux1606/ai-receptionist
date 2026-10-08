"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AuthState = {
  error: string | null;
  notice?: string | null;
};

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Invalid email or password." };
  }

  redirect("/dashboard");
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 10) {
    return { error: "Use a password of at least 10 characters." };
  }
  if (formData.get("terms") !== "on") {
    return { error: "Please accept the terms to continue." };
  }

  const supabase = await createServerSupabaseClient();
  const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${appUrl}/auth/callback` },
  });

  if (error) {
    return { error: "We could not create that account. Try a different email or sign in." };
  }

  // With email confirmation on, no session exists until the link is clicked.
  if (!data.session) {
    return {
      error: null,
      notice: "Check your email for a confirmation link to finish signing up.",
    };
  }

  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/");
}
