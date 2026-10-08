import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/calls", label: "Calls" },
  { href: "/settings/agent", label: "Receptionist" },
  { href: "/settings/billing", label: "Plan & billing" },
];

export function AppHeader({ businessName }: { businessName: string }) {
  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 py-3 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <span className="font-heading text-sm font-semibold">{businessName}</span>
          <nav aria-label="Main" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <form action={signOut}>
          <Button variant="ghost" size="sm" type="submit">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
