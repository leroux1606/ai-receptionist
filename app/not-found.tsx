import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-heading text-2xl tracking-tight">Call not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        That call is not in the log, or you do not have access.
      </p>
      <Link href="/calls" className="mt-6 text-sm underline-offset-4 hover:underline">
        Back to calls
      </Link>
    </main>
  );
}
