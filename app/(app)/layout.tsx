import { AppHeader } from "@/components/app/app-header";
import { getContext } from "@/lib/org/current";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { org } = await getContext();

  return (
    <>
      <AppHeader businessName={org.name} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </>
  );
}
