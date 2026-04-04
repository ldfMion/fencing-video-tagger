import { connection } from "next/server";
import { FencerAnalyticsShell } from "@/app/fencers/[name]/fencer-analytics-shell";
import { listSessions } from "@/lib/server/session-service";

interface FencerPageProps {
  params: Promise<{ name: string }>;
}

export default async function FencerPage(props: FencerPageProps) {
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
