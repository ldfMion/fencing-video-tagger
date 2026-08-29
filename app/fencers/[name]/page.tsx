import { Suspense } from "react";
import { connection } from "next/server";
import { FencerAnalyticsShell } from "@/app/fencers/[name]/fencer-analytics-shell";
import { RouteLoading } from "@/components/route-loading";
import { listSessions } from "@/lib/server/session-service";

interface FencerPageProps {
  params: Promise<{ name: string }>;
}

async function FencerPageContent(props: FencerPageProps) {
  await connection();
  const { name } = await props.params;
  const initialSessions = await listSessions();

  return (
    <FencerAnalyticsShell
      fencerName={decodeURIComponent(name)}
      initialSessions={initialSessions}
    />
  );
}

export default function FencerPage(props: FencerPageProps) {
  return (
    <Suspense fallback={<RouteLoading />}>
      <FencerPageContent {...props} />
    </Suspense>
  );
}
