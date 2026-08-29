import { Suspense } from "react";
import { connection } from "next/server";
import { LibraryPageShell } from "@/app/library-page-shell";
import { RouteLoading } from "@/components/route-loading";
import { listSessions } from "@/lib/server/session-service";

async function LibraryPageContent() {
  await connection();
  const initialSessions = await listSessions();

  return <LibraryPageShell initialSessions={initialSessions} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <LibraryPageContent />
    </Suspense>
  );
}
