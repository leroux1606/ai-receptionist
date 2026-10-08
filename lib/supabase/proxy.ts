import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages anyone can open without signing in.
const PUBLIC_PATHS = ["/", "/login", "/signup", "/privacy", "/terms"];
const PUBLIC_PREFIXES = ["/auth", "/api/webhooks", "/api/cron"];
const AUTH_ONLY_PAGES = ["/login", "/signup"];

function isPublic(path: string): boolean {
  return (
    PUBLIC_PATHS.includes(path) ||
    PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  );
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Machine-to-machine endpoints authenticate themselves.
  if (path.startsWith("/api/webhooks") || path.startsWith("/api/cron")) {
    return NextResponse.next({ request });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    if (isPublic(path)) {
      return NextResponse.next({ request });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  if (!signedIn && !isPublic(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (signedIn && AUTH_ONLY_PAGES.includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
